"""Асинхронные движок и фабрика сессий."""

from collections.abc import AsyncIterator
from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings
from app.db.base import Base


def build_engine(url: Optional[str] = None) -> AsyncEngine:
    """Создать асинхронный движок по URL (по умолчанию из настроек)."""
    return create_async_engine(url or settings.database_url, pool_pre_ping=True)


def build_session_factory(
    url: Optional[str] = None,
) -> async_sessionmaker[AsyncSession]:
    """Создать фабрику асинхронных сессий."""
    return async_sessionmaker(bind=build_engine(url), expire_on_commit=False)


async_engine = build_engine()
AsyncSessionLocal = build_session_factory()


async def create_all(engine: Optional[AsyncEngine] = None) -> None:
    """Создать таблицы (для тестов и локальной отладки; в бою — Alembic)."""
    target = engine or async_engine
    async with target.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Зависимость FastAPI для получения сессии."""
    async with AsyncSessionLocal() as session:
        yield session
