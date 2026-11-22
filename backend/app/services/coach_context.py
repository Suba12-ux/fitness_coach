"""Сборка контекста профиля и истории для будущих агентов.

Сервис только читает данные и не вызывает LLM.
"""

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.training import (
    ExerciseResult,
    PlannedWorkout,
    TrainingProgram,
    WorkoutSession,
    WorkoutSet,
)
from app.schemas.coach import (
    CoachContext,
    CoachExerciseSummary,
    CoachProfile,
    CoachProgramSummary,
    CoachWorkoutSummary,
)
from app.services import profiles as profile_service
from app.services import workouts as workout_service
from app.services.time import as_aware_utc


async def _active_program_summary(
    session: AsyncSession, user_id: str
) -> Optional[CoachProgramSummary]:
    result = await session.execute(
        select(TrainingProgram).where(
            TrainingProgram.user_id == user_id,
            TrainingProgram.status == "active",
        )
    )
    program = result.scalars().first()
    if program is None:
        return None

    workouts_count = await session.scalar(
        select(func.count())
        .select_from(PlannedWorkout)
        .where(PlannedWorkout.program_id == program.id)
    )
    return CoachProgramSummary(
        program_id=program.id,
        name=program.name,
        goal=program.goal,
        workouts_count=int(workouts_count or 0),
    )


async def _recent_workouts(
    session: AsyncSession, user_id: str, limit: int
) -> list[CoachWorkoutSummary]:
    completion = func.coalesce(
        WorkoutSession.finished_at, WorkoutSession.started_at
    )
    result = await session.execute(
        select(WorkoutSession)
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == "completed",
        )
        .order_by(completion.desc())
        .limit(limit)
    )
    sessions = list(result.scalars().all())
    if not sessions:
        return []

    ids = [session.id for session in sessions]
    aggregate_rows = await session.execute(
        select(
            ExerciseResult.workout_session_id,
            ExerciseResult.name,
            func.count(WorkoutSet.id),
            func.max(WorkoutSet.weight_kg),
            func.sum(WorkoutSet.reps),
        )
        .select_from(ExerciseResult)
        .outerjoin(
            WorkoutSet, WorkoutSet.exercise_result_id == ExerciseResult.id
        )
        .where(ExerciseResult.workout_session_id.in_(ids))
        .group_by(ExerciseResult.workout_session_id, ExerciseResult.name)
        .order_by(ExerciseResult.workout_session_id, ExerciseResult.name)
    )

    by_workout = {}
    for workout_id, name, sets_count, top_weight, total_reps in (
        aggregate_rows.all()
    ):
        by_workout.setdefault(workout_id, []).append(
            CoachExerciseSummary(
                name=name,
                sets_count=int(sets_count or 0),
                top_weight_kg=(
                    float(top_weight) if top_weight is not None else None
                ),
                total_reps=int(total_reps or 0),
            )
        )

    return [
        CoachWorkoutSummary(
            workout_id=session.id,
            title=session.title,
            completed_at=as_aware_utc(
                session.finished_at or session.started_at
            ),
            comment=session.comment,
            exercises=by_workout.get(session.id, []),
        )
        for session in sessions
    ]


async def build_context(
    session: AsyncSession, user_id: str, *, recent_limit: int = 5
) -> CoachContext:
    """Собрать компактный контекст без побочных эффектов."""
    profile = await profile_service.get_profile(session, user_id)
    stats = await workout_service.compute_stats(session, user_id)

    return CoachContext(
        profile=(
            CoachProfile(
                goal=profile.goal,
                experience_level=profile.experience_level,
                days_per_week=profile.days_per_week,
                minutes_per_session=profile.minutes_per_session,
                limitations=list(profile.limitations or []),
            )
            if profile is not None
            else None
        ),
        active_program=await _active_program_summary(session, user_id),
        recent_workouts=await _recent_workouts(
            session, user_id, recent_limit
        ),
        completed_total=stats.completed_total,
        completed_last_7_days=stats.completed_last_7_days,
        completed_last_30_days=stats.completed_last_30_days,
        generated_at=workout_service.utcnow(),
    )
