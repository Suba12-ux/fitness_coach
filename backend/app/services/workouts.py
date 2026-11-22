"""РЎРµСЂРІРёСЃ С„Р°РєС‚РёС‡РµСЃРєРёС… С‚СЂРµРЅРёСЂРѕРІРѕРє Рё СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ СѓРїСЂР°Р¶РЅРµРЅРёР№."""

from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from pydantic import ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.training import (
    ExerciseResult,
    PlannedWorkout,
    TrainingProgram,
    WorkoutSession,
    WorkoutSet,
)
from app.schemas.programs import ProgramExerciseContent
from app.schemas.workouts import (
    ExerciseNameStat,
    ExerciseProgressPoint,
    ExerciseResultPayload,
    ExerciseResultView,
    ProgramStat,
    WorkoutCreateRequest,
    WorkoutDetail,
    WorkoutSetView,
    WorkoutStats,
    WorkoutSummary,
)
from app.services.time import as_aware_utc

TERMINAL_STATUSES = {"completed", "cancelled", "skipped"}


class WorkoutNotFound(Exception):
    """РўСЂРµРЅРёСЂРѕРІРєР° РЅРµ СЃСѓС‰РµСЃС‚РІСѓРµС‚ РёР»Рё РїСЂРёРЅР°РґР»РµР¶РёС‚ РґСЂСѓРіРѕРјСѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ."""


class WorkoutSourceNotFound(Exception):
    """РџР»Р°РЅРѕРІР°СЏ С‚СЂРµРЅРёСЂРѕРІРєР° РёР»Рё РїСЂРѕРіСЂР°РјРјР° РЅРµРґРѕСЃС‚СѓРїРЅР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ."""


class WorkoutConflict(Exception):
    """РћРїРµСЂР°С†РёСЏ РЅРµРґРѕРїСѓСЃС‚РёРјР° РґР»СЏ С‚РµРєСѓС‰РµРіРѕ СЃС‚Р°С‚СѓСЃР° С‚СЂРµРЅРёСЂРѕРІРєРё."""


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _next_day(value: date) -> datetime:
    return datetime.combine(
        value + timedelta(days=1), time.min, tzinfo=timezone.utc
    )


async def get_workout_for_user(
    session: AsyncSession, workout_id: str, user_id: str
) -> Optional[WorkoutSession]:
    result = await session.execute(
        select(WorkoutSession).where(
            WorkoutSession.id == workout_id,
            WorkoutSession.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def list_workouts_for_user(
    session: AsyncSession,
    user_id: str,
    *,
    status: Optional[str] = None,
    program_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[WorkoutSession], int]:
    filters = [WorkoutSession.user_id == user_id]
    if status:
        filters.append(WorkoutSession.status == status)
    if program_id:
        filters.append(WorkoutSession.program_id == program_id)
    if date_from:
        filters.append(
            WorkoutSession.started_at
            >= datetime.combine(
                date_from, time.min, tzinfo=timezone.utc
            )
        )
    if date_to:
        filters.append(WorkoutSession.started_at < _next_day(date_to))

    total = await session.scalar(
        select(func.count()).select_from(WorkoutSession).where(*filters)
    )
    result = await session.execute(
        select(WorkoutSession)
        .where(*filters)
        .order_by(
            WorkoutSession.started_at.desc(), WorkoutSession.id.desc()
        )
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all()), int(total or 0)


async def _exercise_rows(
    session: AsyncSession, workout_id: str
) -> List[ExerciseResult]:
    result = await session.execute(
        select(ExerciseResult)
        .where(ExerciseResult.workout_session_id == workout_id)
        .order_by(ExerciseResult.position)
    )
    return list(result.scalars().all())


async def _set_rows(
    session: AsyncSession, exercise_ids: List[str]
) -> Dict[str, List[WorkoutSet]]:
    if not exercise_ids:
        return {}
    result = await session.execute(
        select(WorkoutSet)
        .where(WorkoutSet.exercise_result_id.in_(exercise_ids))
        .order_by(WorkoutSet.position)
    )
    by_exercise: Dict[str, List[WorkoutSet]] = {}
    for record in result.scalars().all():
        by_exercise.setdefault(record.exercise_result_id, []).append(record)
    return by_exercise


def to_summary(workout: WorkoutSession) -> WorkoutSummary:
    return WorkoutSummary(
        id=workout.id,
        title=workout.title,
        status=workout.status,
        program_id=workout.program_id,
        planned_workout_id=workout.planned_workout_id,
        started_at=as_aware_utc(workout.started_at),
        finished_at=as_aware_utc(workout.finished_at),
        created_at=as_aware_utc(workout.created_at),
    )


async def build_detail(
    session: AsyncSession, workout: WorkoutSession
) -> WorkoutDetail:
    exercises = await _exercise_rows(session, workout.id)
    sets = await _set_rows(session, [row.id for row in exercises])

    views = [
        ExerciseResultView(
            id=row.id,
            name=row.name,
            position=row.position,
            planned=row.planned,
            comment=row.comment,
            sets=[
                WorkoutSetView(
                    id=item.id,
                    position=item.position,
                    reps=item.reps,
                    weight_kg=item.weight_kg,
                    duration_sec=item.duration_sec,
                    distance_m=item.distance_m,
                    skipped=item.skipped,
                )
                for item in sets.get(row.id, [])
            ],
        )
        for row in exercises
    ]

    summary = to_summary(workout)
    return WorkoutDetail(
        **summary.model_dump(),
        perceived_exertion=workout.perceived_exertion,
        comment=workout.comment,
        exercises=views,
    )


def _parse_planned_exercises(raw: Any) -> List[ProgramExerciseContent]:
    parsed: List[ProgramExerciseContent] = []
    for item in raw or []:
        try:
            parsed.append(ProgramExerciseContent.model_validate(item))
        except ValidationError:
            continue
    return sorted(parsed, key=lambda exercise: exercise.position)


async def _planned_workout_for_user(
    session: AsyncSession, planned_workout_id: str, user_id: str
) -> PlannedWorkout:
    result = await session.execute(
        select(PlannedWorkout)
        .join(
            TrainingProgram,
            PlannedWorkout.program_id == TrainingProgram.id,
        )
        .where(
            PlannedWorkout.id == planned_workout_id,
            TrainingProgram.user_id == user_id,
        )
    )
    workout = result.scalar_one_or_none()
    if workout is None:
        raise WorkoutSourceNotFound("РџР»Р°РЅРѕРІР°СЏ С‚СЂРµРЅРёСЂРѕРІРєР° РЅРµ РЅР°Р№РґРµРЅР°.")
    return workout


async def _open_session_for_planned(
    session: AsyncSession, user_id: str, planned_workout_id: str
) -> Optional[WorkoutSession]:
    result = await session.execute(
        select(WorkoutSession).where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.planned_workout_id == planned_workout_id,
            WorkoutSession.status == "in_progress",
        )
    )
    return result.scalar_one_or_none()


async def start_workout(
    session: AsyncSession, user_id: str, body: WorkoutCreateRequest
) -> Tuple[WorkoutSession, bool]:
    """РЎРѕР·РґР°С‚СЊ С‚СЂРµРЅРёСЂРѕРІРєСѓ; РІРµСЂРЅСѓС‚СЊ (Р·Р°РїРёСЃСЊ, СЃРѕР·РґР°РЅР° Р»Рё РЅРѕРІР°СЏ)."""
    planned_exercises: List[ProgramExerciseContent] = []
    program_id = body.program_id
    title = body.title

    if body.planned_workout_id:
        planned = await _planned_workout_for_user(
            session, body.planned_workout_id, user_id
        )
        existing = await _open_session_for_planned(
            session, user_id, planned.id
        )
        if existing is not None:
            return existing, False

        program_id = planned.program_id
        title = title or planned.title
        planned_exercises = _parse_planned_exercises(planned.exercises)
    elif program_id:
        program = await session.execute(
            select(TrainingProgram).where(
                TrainingProgram.id == program_id,
                TrainingProgram.user_id == user_id,
            )
        )
        if program.scalar_one_or_none() is None:
            raise WorkoutSourceNotFound("РџСЂРѕРіСЂР°РјРјР° РЅРµ РЅР°Р№РґРµРЅР°.")

    workout = WorkoutSession(
        user_id=user_id,
        program_id=program_id,
        planned_workout_id=body.planned_workout_id,
        title=title or "РўСЂРµРЅРёСЂРѕРІРєР°",
        status="in_progress",
        started_at=utcnow(),
    )
    session.add(workout)
    await session.flush()

    for position, exercise in enumerate(planned_exercises, start=1):
        session.add(
            ExerciseResult(
                workout_session_id=workout.id,
                name=exercise.name,
                position=position,
                planned=exercise.planned or {},
            )
        )

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        if body.planned_workout_id:
            existing = await _open_session_for_planned(
                session, user_id, body.planned_workout_id
            )
            if existing is not None:
                return existing, False
        raise

    await session.refresh(workout)
    return workout, True


async def replace_exercises(
    session: AsyncSession,
    workout: WorkoutSession,
    exercises: List[ExerciseResultPayload],
) -> WorkoutSession:
    """РџРѕР»РЅРѕСЃС‚СЊСЋ Р·Р°РјРµРЅРёС‚СЊ СѓРїСЂР°Р¶РЅРµРЅРёСЏ Рё РїРѕРґС…РѕРґС‹ РЅРµР·Р°РІРµСЂС€С‘РЅРЅРѕР№ С‚СЂРµРЅРёСЂРѕРІРєРё."""
    if workout.status != "in_progress":
        raise WorkoutConflict(
            "РР·РјРµРЅСЏС‚СЊ СЂРµР·СѓР»СЊС‚Р°С‚С‹ РјРѕР¶РЅРѕ С‚РѕР»СЊРєРѕ Сѓ РЅРµР·Р°РІРµСЂС€С‘РЅРЅРѕР№ С‚СЂРµРЅРёСЂРѕРІРєРё."
        )

    existing = await _exercise_rows(session, workout.id)
    planned_by_name = {
        row.name: row.planned for row in existing if row.planned
    }
    existing_ids = [row.id for row in existing]

    if existing_ids:
        await session.execute(
            delete(WorkoutSet).where(
                WorkoutSet.exercise_result_id.in_(existing_ids)
            )
        )
        await session.execute(
            delete(ExerciseResult).where(
                ExerciseResult.workout_session_id == workout.id
            )
        )

    rows: List[Tuple[ExerciseResult, ExerciseResultPayload]] = []
    for position, payload in enumerate(exercises, start=1):
        # Плановый снимок берём только из сохранённой тренировки,
        # клиент не может перезаписать исходный план.
        planned = planned_by_name.get(payload.name)
        row = ExerciseResult(
            workout_session_id=workout.id,
            name=payload.name,
            position=position,
            planned=planned,
            comment=payload.comment,
        )
        session.add(row)
        rows.append((row, payload))

    await session.flush()

    for row, payload in rows:
        for set_position, item in enumerate(payload.sets, start=1):
            if item.skipped:
                reps = weight_kg = duration_sec = distance_m = None
            else:
                reps = item.reps
                weight_kg = item.weight_kg
                duration_sec = item.duration_sec
                distance_m = item.distance_m
            session.add(
                WorkoutSet(
                    exercise_result_id=row.id,
                    position=set_position,
                    reps=reps,
                    weight_kg=weight_kg,
                    duration_sec=duration_sec,
                    distance_m=distance_m,
                    skipped=item.skipped,
                )
            )

    await session.commit()
    await session.refresh(workout)
    return workout


async def compute_stats(
    session: AsyncSession, user_id: str
) -> WorkoutStats:
    """Простая статистика по завершённым тренировкам."""
    now = utcnow()
    completion = func.coalesce(
        WorkoutSession.finished_at, WorkoutSession.started_at
    )

    async def count_since(delta: Optional[timedelta] = None) -> int:
        filters = [
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == "completed",
        ]
        if delta is not None:
            filters.append(completion >= now - delta)
        value = await session.scalar(
            select(func.count()).select_from(WorkoutSession).where(*filters)
        )
        return int(value or 0)

    total = await count_since()
    last_7 = await count_since(timedelta(days=7))
    last_30 = await count_since(timedelta(days=30))

    program_rows = await session.execute(
        select(
            TrainingProgram.id,
            TrainingProgram.name,
            func.count(WorkoutSession.id),
        )
        .select_from(WorkoutSession)
        .join(
            TrainingProgram,
            WorkoutSession.program_id == TrainingProgram.id,
        )
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == "completed",
        )
        .group_by(TrainingProgram.id, TrainingProgram.name)
        .order_by(func.count(WorkoutSession.id).desc())
    )
    by_program = [
        ProgramStat(
            program_id=program_id,
            name=name,
            completed_count=int(count),
        )
        for program_id, name, count in program_rows.all()
    ]

    date_rows = await session.execute(
        select(completion)
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == "completed",
        )
        .order_by(completion.desc())
        .limit(10)
    )
    recent_dates = [
        value
        for value in (
            as_aware_utc(item) for item in date_rows.scalars().all()
        )
        if value is not None
    ]

    return WorkoutStats(
        completed_total=total,
        completed_last_7_days=last_7,
        completed_last_30_days=last_30,
        by_program=by_program,
        recent_dates=recent_dates,
    )


async def list_exercise_names(
    session: AsyncSession, user_id: str
) -> List[ExerciseNameStat]:
    sessions_count = func.count(
        func.distinct(ExerciseResult.workout_session_id)
    )
    rows = await session.execute(
        select(ExerciseResult.name, sessions_count)
        .select_from(ExerciseResult)
        .join(
            WorkoutSession,
            ExerciseResult.workout_session_id == WorkoutSession.id,
        )
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == "completed",
        )
        .group_by(ExerciseResult.name)
        .order_by(sessions_count.desc(), ExerciseResult.name)
        .limit(200)
    )
    return [
        ExerciseNameStat(name=name, completed_sessions=int(count))
        for name, count in rows.all()
    ]


async def exercise_progress(
    session: AsyncSession, user_id: str, exercise: str, limit: int = 20
) -> List[ExerciseProgressPoint]:
    """Динамика упражнения только по подходам с указанным весом."""
    completion = func.coalesce(
        WorkoutSession.finished_at, WorkoutSession.started_at
    )
    volume = func.sum(WorkoutSet.reps * WorkoutSet.weight_kg)

    rows = await session.execute(
        select(
            completion,
            func.max(WorkoutSet.weight_kg),
            func.sum(WorkoutSet.reps),
            volume,
        )
        .select_from(WorkoutSession)
        .join(
            ExerciseResult,
            ExerciseResult.workout_session_id == WorkoutSession.id,
        )
        .join(
            WorkoutSet,
            WorkoutSet.exercise_result_id == ExerciseResult.id,
        )
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == "completed",
            ExerciseResult.name == exercise,
            WorkoutSet.skipped.is_(False),
            WorkoutSet.weight_kg.is_not(None),
        )
        .group_by(completion)
        .order_by(completion)
        .limit(limit)
    )

    points: List[ExerciseProgressPoint] = []
    for date_value, top_weight, total_reps, total_volume in rows.all():
        normalized = as_aware_utc(date_value)
        if normalized is None:
            continue
        points.append(
            ExerciseProgressPoint(
                date=normalized,
                top_weight_kg=float(top_weight or 0),
                total_reps=int(total_reps or 0),
                total_volume_kg=round(float(total_volume or 0), 1),
            )
        )
    return points


async def update_workout(
    session: AsyncSession,
    workout: WorkoutSession,
    values: Dict[str, Any],
) -> WorkoutSession:
    """РћР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ, РєРѕРјРјРµРЅС‚Р°СЂРёР№ Рё СЃР°РјРѕС‡СѓРІСЃС‚РІРёРµ."""
    new_status = values.get("status")
    if new_status is not None:
        if (
            workout.status in TERMINAL_STATUSES
            and new_status != workout.status
        ):
            raise WorkoutConflict(
                "Р—Р°РІРµСЂС€С‘РЅРЅСѓСЋ С‚СЂРµРЅРёСЂРѕРІРєСѓ РЅРµР»СЊР·СЏ РїРµСЂРµРѕС‚РєСЂС‹С‚СЊ."
            )
        workout.status = new_status
        if new_status in TERMINAL_STATUSES:
            if workout.finished_at is None:
                workout.finished_at = utcnow()
        elif new_status == "in_progress":
            workout.finished_at = None

    if "comment" in values:
        workout.comment = values["comment"]
    if "perceived_exertion" in values:
        workout.perceived_exertion = values["perceived_exertion"]

    await session.commit()
    await session.refresh(workout)
    return workout

