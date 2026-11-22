"""Зависимости FastAPI для текущего пользователя и сессии."""

from datetime import datetime, timedelta, timezone
from typing import AsyncIterator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models.user import User, UserSession
from app.db.repositories import auth_repository
from app.security.tokens import hash_session_token

_TOUCH_INTERVAL = timedelta(seconds=60)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Требуется вход в аккаунт.",
        headers={"WWW-Authenticate": "Cookie"},
    )


def _as_aware(value: datetime) -> datetime:
    """SQLite возвращает naive datetime даже при timezone=True."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    factory = request.app.state.session_factory
    async with factory() as session:
        yield session


async def get_current_session(
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> UserSession:
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise _unauthorized()

    record = await auth_repository.get_session_by_token_hash(
        session, hash_session_token(token)
    )
    now = datetime.now(timezone.utc)

    if record is None:
        raise _unauthorized()

    expires_at = _as_aware(record.expires_at)
    if expires_at <= now:
        await auth_repository.delete_session_by_id(session, record.id)
        raise _unauthorized()

    last_used_at = _as_aware(record.last_used_at)
    if now - last_used_at >= _TOUCH_INTERVAL:
        await auth_repository.touch_session(session, record, now=now)

    return record


async def get_current_user(
    current_session: UserSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db),
) -> User:
    user = await auth_repository.get_user_by_id(
        session, current_session.user_id
    )
    if user is None:
        await auth_repository.delete_session_by_id(session, current_session.id)
        raise _unauthorized()
    return user


def client_host(request: Request) -> str:
    return request.client.host if request.client else "unknown"
