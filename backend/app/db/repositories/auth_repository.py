"""Репозиторий пользователей и серверных сессий."""

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User, UserSession


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def create_user(
    session: AsyncSession, *, email: str, password_hash: str
) -> User:
    user = User(email=email, password_hash=password_hash)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def get_user_by_email(
    session: AsyncSession, email: str
) -> Optional[User]:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(
    session: AsyncSession, user_id: str
) -> Optional[User]:
    return await session.get(User, user_id)


async def update_password_hash(
    session: AsyncSession, user: User, password_hash: str
) -> User:
    user.password_hash = password_hash
    await session.commit()
    await session.refresh(user)
    return user


async def create_session(
    session: AsyncSession,
    *,
    user_id: str,
    token_hash: str,
    expires_at: datetime,
    user_agent: Optional[str],
    persistent: bool,
) -> UserSession:
    now = utcnow()
    record = UserSession(
        user_id=user_id,
        token_hash=token_hash,
        user_agent=user_agent,
        persistent=persistent,
        created_at=now,
        last_used_at=now,
        expires_at=expires_at,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return record


async def get_session_by_token_hash(
    session: AsyncSession, token_hash: str
) -> Optional[UserSession]:
    result = await session.execute(
        select(UserSession).where(UserSession.token_hash == token_hash)
    )
    return result.scalar_one_or_none()


async def get_user_session(
    session: AsyncSession, session_id: str, user_id: str
) -> Optional[UserSession]:
    result = await session.execute(
        select(UserSession).where(
            UserSession.id == session_id, UserSession.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def touch_session(
    session: AsyncSession, record: UserSession, *, now: datetime
) -> None:
    record.last_used_at = now
    await session.commit()


async def delete_session_by_id(
    session: AsyncSession, session_id: str
) -> bool:
    result = await session.execute(
        delete(UserSession).where(UserSession.id == session_id)
    )
    await session.commit()
    return bool(result.rowcount)


async def delete_session_by_token_hash(
    session: AsyncSession, token_hash: str
) -> bool:
    result = await session.execute(
        delete(UserSession).where(UserSession.token_hash == token_hash)
    )
    await session.commit()
    return bool(result.rowcount)


async def list_sessions(
    session: AsyncSession, user_id: str, *, now: datetime
) -> List[UserSession]:
    result = await session.execute(
        select(UserSession)
        .where(
            UserSession.user_id == user_id,
            UserSession.expires_at > now,
        )
        .order_by(UserSession.created_at.desc(), UserSession.id.desc())
    )
    return list(result.scalars().all())


async def delete_user_sessions(
    session: AsyncSession, user_id: str
) -> int:
    result = await session.execute(
        delete(UserSession).where(UserSession.user_id == user_id)
    )
    await session.commit()
    return int(result.rowcount or 0)


async def delete_expired_sessions(
    session: AsyncSession, *, now: datetime
) -> int:
    result = await session.execute(
        delete(UserSession).where(UserSession.expires_at <= now)
    )
    await session.commit()
    return int(result.rowcount or 0)
