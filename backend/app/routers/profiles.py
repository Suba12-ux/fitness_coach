"""HTTP-эндпоинты постоянного профиля пользователя."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_db
from app.db.models.training import UserProfile
from app.db.models.user import User
from app.schemas.profile import ProfileData, ProfileResponse
from app.services import profiles as profile_service
from app.services.time import as_aware_utc

router = APIRouter(prefix="/profile", tags=["profile"])


def _to_response(profile: UserProfile) -> ProfileResponse:
    return ProfileResponse(
        goal=profile.goal,
        age=profile.age,
        weight_kg=profile.weight_kg,
        height_cm=profile.height_cm,
        experience_level=profile.experience_level,
        days_per_week=profile.days_per_week,
        minutes_per_session=profile.minutes_per_session,
        limitations=list(profile.limitations or []),
        created_at=as_aware_utc(profile.created_at),
        updated_at=as_aware_utc(profile.updated_at),
    )


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Профиль ещё не заполнен.",
    )


@router.get("", response_model=ProfileResponse)
async def read_profile(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    profile = await profile_service.get_profile(session, user.id)
    if profile is None:
        raise _not_found()
    return _to_response(profile)


@router.put("", response_model=ProfileResponse)
async def replace_profile(
    body: ProfileData,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    profile = await profile_service.upsert_profile(
        session, user.id, body.model_dump()
    )
    return _to_response(profile)


@router.patch("", response_model=ProfileResponse)
async def patch_profile(
    body: ProfileData,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    profile = await profile_service.update_profile(
        session, user.id, body.model_dump(exclude_unset=True)
    )
    if profile is None:
        raise _not_found()
    return _to_response(profile)
