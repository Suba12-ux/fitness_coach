"""HTTP-СЌРЅРґРїРѕРёРЅС‚С‹ С„Р°РєС‚РёС‡РµСЃРєРёС… С‚СЂРµРЅРёСЂРѕРІРѕРє."""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_db
from app.db.models.user import User
from app.schemas.workouts import (
    ExerciseNameList,
    ExerciseProgressPoint,
    WorkoutCreateRequest,
    WorkoutDetail,
    WorkoutExercisesRequest,
    WorkoutList,
    WorkoutStats,
    WorkoutUpdateRequest,
)
from app.services import workouts as workout_service

router = APIRouter(prefix="/workouts", tags=["workouts"])


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=http_status.HTTP_404_NOT_FOUND,
        detail="РўСЂРµРЅРёСЂРѕРІРєР° РЅРµ РЅР°Р№РґРµРЅР°.",
    )


async def _require_workout(session, workout_id: str, user_id: str):
    workout = await workout_service.get_workout_for_user(
        session, workout_id, user_id
    )
    if workout is None:
        raise _not_found()
    return workout


@router.post(
    "",
    response_model=WorkoutDetail,
    status_code=http_status.HTTP_201_CREATED,
)
async def start_workout(
    body: WorkoutCreateRequest,
    response: Response,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> WorkoutDetail:
    try:
        workout, created = await workout_service.start_workout(
            session, user.id, body
        )
    except workout_service.WorkoutSourceNotFound as exc:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail=str(exc)
        )

    if not created:
        response.status_code = http_status.HTTP_200_OK
    return await workout_service.build_detail(session, workout)


@router.get("", response_model=WorkoutList)
async def list_workouts(
    status: Optional[str] = Query(None),
    program_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None, alias="from"),
    date_to: Optional[date] = Query(None, alias="to"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> WorkoutList:
    workouts, total = await workout_service.list_workouts_for_user(
        session,
        user.id,
        status=status,
        program_id=program_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return WorkoutList(
        items=[
            workout_service.to_summary(workout) for workout in workouts
        ],
        total=total,
    )


@router.get("/stats", response_model=WorkoutStats)
async def workout_stats(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> WorkoutStats:
    return await workout_service.compute_stats(session, user.id)


@router.get("/exercises", response_model=ExerciseNameList)
async def workout_exercise_names(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ExerciseNameList:
    items = await workout_service.list_exercise_names(session, user.id)
    return ExerciseNameList(items=items)


@router.get("/progress", response_model=list[ExerciseProgressPoint])
async def workout_progress(
    exercise: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[ExerciseProgressPoint]:
    return await workout_service.exercise_progress(
        session, user.id, exercise, limit=limit
    )


@router.get("/{workout_id}", response_model=WorkoutDetail)
async def get_workout(
    workout_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> WorkoutDetail:
    workout = await _require_workout(session, workout_id, user.id)
    return await workout_service.build_detail(session, workout)


@router.patch("/{workout_id}", response_model=WorkoutDetail)
async def patch_workout(
    workout_id: str,
    body: WorkoutUpdateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> WorkoutDetail:
    workout = await _require_workout(session, workout_id, user.id)
    try:
        workout = await workout_service.update_workout(
            session, workout, body.model_dump(exclude_unset=True)
        )
    except workout_service.WorkoutConflict as exc:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)
        )
    return await workout_service.build_detail(session, workout)


@router.put("/{workout_id}/exercises", response_model=WorkoutDetail)
async def replace_workout_exercises(
    workout_id: str,
    body: WorkoutExercisesRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> WorkoutDetail:
    workout = await _require_workout(session, workout_id, user.id)
    try:
        workout = await workout_service.replace_exercises(
            session, workout, body.exercises
        )
    except workout_service.WorkoutConflict as exc:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)
        )
    return await workout_service.build_detail(session, workout)

