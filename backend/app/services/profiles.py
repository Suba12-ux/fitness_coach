"""Сервис постоянного профиля пользователя."""

from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.training import UserProfile


async def get_profile(
    session: AsyncSession, user_id: str
) -> Optional[UserProfile]:
    result = await session.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def upsert_profile(
    session: AsyncSession, user_id: str, values: Dict[str, Any]
) -> UserProfile:
    """Создать профиль или полностью обновить существующий."""
    profile = await get_profile(session, user_id)
    if profile is None:
        profile = UserProfile(user_id=user_id, **values)
        session.add(profile)
    else:
        for key, value in values.items():
            setattr(profile, key, value)

    await session.commit()
    await session.refresh(profile)
    return profile


async def update_profile(
    session: AsyncSession, user_id: str, values: Dict[str, Any]
) -> Optional[UserProfile]:
    """Частично обновить профиль; None, если профиля ещё нет."""
    profile = await get_profile(session, user_id)
    if profile is None:
        return None

    for key, value in values.items():
        setattr(profile, key, value)

    await session.commit()
    await session.refresh(profile)
    return profile
