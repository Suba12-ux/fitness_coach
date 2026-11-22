"""Сервис программ: нормализация плана, сохранение и чтение программ."""

from typing import Any, Dict, List, Optional, Tuple

from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.training import (
    PlannedWorkout,
    TrainingProgram,
    WorkoutSession,
)
from app.db.models.workflow import WorkflowRun
from app.schemas.programs import (
    PlannedWorkoutView,
    ProgramContent,
    ProgramCreateRequest,
    ProgramDetail,
    ProgramExerciseContent,
    ProgramSummary,
    ProgramWorkoutContent,
)
from app.schemas.results import TrainingExercise, TrainingPlan
from app.services.time import as_aware_utc


class ProgramSourceNotFound(Exception):
    """Запуск не существует или принадлежит другому пользователю."""


class ProgramSourceNotReady(Exception):
    """Запуск не завершён или не содержит плана."""


class ProgramContentInvalid(Exception):
    """План запуска не удалось преобразовать в программу."""


# ------------------------------------------------------------------ нормализация
def _planned_payload(exercise: TrainingExercise) -> Dict[str, Any]:
    """Снимок предписания без пустых полей."""
    values = {
        "sets": exercise.sets,
        "reps": exercise.reps,
        "weight_kg": exercise.weight_kg,
        "duration_min": exercise.duration_min,
    }
    return {key: value for key, value in values.items() if value is not None}


def normalize_plan(plan: TrainingPlan) -> ProgramContent:
    """Привести план агента к структуре программы.

    Планы старых запусков не содержат упражнений: такие тренировки
    сохраняются без упражнений, ничего не выдумывая.
    """
    workouts = []
    for session_index, session in enumerate(plan.sessions, start=1):
        exercises = [
            ProgramExerciseContent(
                name=exercise.name.strip(),
                position=exercise_index,
                planned=_planned_payload(exercise),
                notes=exercise.notes,
            )
            for exercise_index, exercise in enumerate(
                session.exercises, start=1
            )
        ]
        workouts.append(
            ProgramWorkoutContent(
                position=session_index,
                day=session.day,
                title=session.activity,
                duration_min=session.duration_min,
                exercises=exercises,
            )
        )

    return ProgramContent(
        goal=plan.goal,
        assumptions=list(plan.assumptions),
        limitations=list(plan.limitations),
        workouts=workouts,
    )


# ------------------------------------------------------------------ чтение
async def get_program_for_user(
    session: AsyncSession, program_id: str, user_id: str
) -> Optional[TrainingProgram]:
    result = await session.execute(
        select(TrainingProgram).where(
            TrainingProgram.id == program_id,
            TrainingProgram.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def get_program_by_source_run(
    session: AsyncSession, user_id: str, run_id: str
) -> Optional[TrainingProgram]:
    result = await session.execute(
        select(TrainingProgram).where(
            TrainingProgram.user_id == user_id,
            TrainingProgram.source_run_id == run_id,
        )
    )
    return result.scalar_one_or_none()


async def list_programs_for_user(
    session: AsyncSession,
    user_id: str,
    *,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[TrainingProgram], Dict[str, int], int]:
    filters = [TrainingProgram.user_id == user_id]
    if status:
        filters.append(TrainingProgram.status == status)

    total = await session.scalar(
        select(func.count()).select_from(TrainingProgram).where(*filters)
    )
    result = await session.execute(
        select(TrainingProgram)
        .where(*filters)
        .order_by(
            TrainingProgram.created_at.desc(), TrainingProgram.id.desc()
        )
        .limit(limit)
        .offset(offset)
    )
    programs = list(result.scalars().all())

    counts: Dict[str, int] = {}
    if programs:
        rows = await session.execute(
            select(PlannedWorkout.program_id, func.count())
            .where(
                PlannedWorkout.program_id.in_(
                    [program.id for program in programs]
                )
            )
            .group_by(PlannedWorkout.program_id)
        )
        counts = {program_id: count for program_id, count in rows.all()}

    return programs, counts, int(total or 0)


async def planned_workouts_for_program(
    session: AsyncSession, program_id: str
) -> List[PlannedWorkout]:
    result = await session.execute(
        select(PlannedWorkout)
        .where(PlannedWorkout.program_id == program_id)
        .order_by(PlannedWorkout.position)
    )
    return list(result.scalars().all())


def _exercise_views(raw: Any) -> List[ProgramExerciseContent]:
    views: List[ProgramExerciseContent] = []
    for item in raw or []:
        try:
            views.append(ProgramExerciseContent.model_validate(item))
        except ValidationError:
            continue
    return sorted(views, key=lambda exercise: exercise.position)


async def _workout_views(
    session: AsyncSession, user_id: str, workouts: List[PlannedWorkout]
) -> List[PlannedWorkoutView]:
    if not workouts:
        return []

    result = await session.execute(
        select(WorkoutSession).where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.planned_workout_id.in_(
                [workout.id for workout in workouts]
            ),
        )
    )
    sessions = list(result.scalars().all())

    by_workout: Dict[str, List[WorkoutSession]] = {}
    for record in sessions:
        by_workout.setdefault(record.planned_workout_id or "", []).append(
            record
        )

    views: List[PlannedWorkoutView] = []
    for workout in workouts:
        related = by_workout.get(workout.id, [])
        completed = [
            record for record in related if record.status == "completed"
        ]
        in_progress = next(
            (
                record
                for record in related
                if record.status == "in_progress"
            ),
            None,
        )
        completed_times = [
            as_aware_utc(record.finished_at or record.started_at)
            for record in completed
        ]
        views.append(
            PlannedWorkoutView(
                id=workout.id,
                position=workout.position,
                day=workout.day,
                title=workout.title,
                description=workout.description,
                duration_min=workout.duration_min,
                scheduled_date=workout.scheduled_date,
                exercises=_exercise_views(workout.exercises),
                completed_sessions_count=len(completed),
                last_completed_at=max(
                    [value for value in completed_times if value],
                    default=None,
                ),
                in_progress_session_id=(
                    in_progress.id if in_progress else None
                ),
            )
        )
    return views


def to_summary(
    program: TrainingProgram, planned_workouts_count: int = 0
) -> ProgramSummary:
    return ProgramSummary(
        id=program.id,
        name=program.name,
        description=program.description,
        goal=program.goal,
        status=program.status,
        source_run_id=program.source_run_id,
        planned_workouts_count=planned_workouts_count,
        created_at=as_aware_utc(program.created_at),
        updated_at=as_aware_utc(program.updated_at),
    )


async def build_detail(
    session: AsyncSession, program: TrainingProgram, user_id: str
) -> ProgramDetail:
    workouts = await planned_workouts_for_program(session, program.id)
    views = await _workout_views(session, user_id, workouts)
    summary = to_summary(program, len(workouts))
    return ProgramDetail(
        **summary.model_dump(),
        assumptions=list(program.assumptions or []),
        limitations=list(program.limitations or []),
        workouts=views,
    )


# ------------------------------------------------------------------ запись
async def _archive_active_programs(
    session: AsyncSession, user_id: str, *, exclude_id: Optional[str] = None
) -> None:
    statement = update(TrainingProgram).where(
        TrainingProgram.user_id == user_id,
        TrainingProgram.status == "active",
    )
    if exclude_id is not None:
        statement = statement.where(TrainingProgram.id != exclude_id)
    await session.execute(statement.values(status="archived"))


def _default_name(content: ProgramContent) -> str:
    if content.goal and content.goal.strip():
        return content.goal.strip()
    return "Тренировочная программа"


async def create_program_from_run(
    session: AsyncSession, user_id: str, body: ProgramCreateRequest
) -> Tuple[TrainingProgram, bool]:
    """Сохранить программу из запуска; вернуть (программа, создана ли)."""
    existing = await get_program_by_source_run(session, user_id, body.run_id)
    if existing is not None:
        return existing, False

    run = await session.get(WorkflowRun, body.run_id)
    if run is None or run.user_id != user_id:
        raise ProgramSourceNotFound("Запуск не найден.")
    if run.status != "completed":
        raise ProgramSourceNotReady("Запуск ещё не завершён.")

    plan_data = (run.state or {}).get("final_answer", {}).get("plan")
    if not isinstance(plan_data, dict):
        raise ProgramSourceNotReady("В запуске нет готового плана.")

    try:
        content = normalize_plan(TrainingPlan.model_validate(plan_data))
    except ValidationError as exc:
        raise ProgramContentInvalid(
            f"План запуска не соответствует формату: {exc}"
        ) from exc

    if not content.workouts:
        raise ProgramContentInvalid("В плане нет ни одной тренировки.")

    if body.activate:
        await _archive_active_programs(session, user_id)

    name = (body.name or "").strip() or _default_name(content)
    program = TrainingProgram(
        user_id=user_id,
        name=name,
        description=body.description,
        goal=content.goal,
        assumptions=content.assumptions,
        limitations=content.limitations,
        source_run_id=run.id,
        status="active" if body.activate else "archived",
    )
    session.add(program)
    await session.flush()

    session.add_all(
        [
            PlannedWorkout(
                program_id=program.id,
                position=workout.position,
                day=workout.day,
                title=workout.title,
                description=workout.description,
                duration_min=workout.duration_min,
                exercises=[
                    exercise.model_dump()
                    for exercise in workout.exercises
                ],
            )
            for workout in content.workouts
        ]
    )

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await get_program_by_source_run(
            session, user_id, body.run_id
        )
        if existing is not None:
            return existing, False
        raise

    await session.refresh(program)
    return program, True


async def update_program(
    session: AsyncSession,
    program: TrainingProgram,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
) -> TrainingProgram:
    if name is not None:
        program.name = name.strip() or program.name
    if description is not None:
        program.description = description
    if status is not None:
        if status == "active":
            await _archive_active_programs(
                session, program.user_id, exclude_id=program.id
            )
        program.status = status

    await session.commit()
    await session.refresh(program)
    return program


async def archive_program(
    session: AsyncSession, program: TrainingProgram
) -> None:
    program.status = "archived"
    await session.commit()
