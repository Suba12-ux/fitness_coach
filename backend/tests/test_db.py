"""Проверки персистентности запусков (асинхронный SQLAlchemy)."""

import asyncio
import os
import tempfile

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.repositories import workflow_repository as repo
from app.schemas.results import PlanState, PlanStatus


async def _setup():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_async_engine(f"sqlite+aiosqlite:///{path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, factory, path


def test_save_and_get_run() -> None:
    async def scenario() -> None:
        engine, factory, path = await _setup()
        try:
            state = PlanState(
                request="Подготовь план тренировок.",
                status=PlanStatus.DONE,
                final_answer={"plan": {"goal": "цель"}, "warnings": []},
            )
            async with factory() as session:
                run = await repo.create_run(
                    session,
                    request="Подготовь план тренировок.",
                    user_data={"age": 30},
                    status="done",
                    state=state.model_dump(mode="json"),
                )
                run_id = run.id

            async with factory() as session:
                loaded = await repo.get_run(session, run_id)

            assert loaded is not None
            assert loaded.status == "done"
            assert loaded.state["final_answer"]["plan"]["goal"] == "цель"
            assert loaded.user_data == {"age": 30}
        finally:
            await engine.dispose()
            if os.path.exists(path):
                os.remove(path)

    asyncio.run(scenario())


def test_update_run_status() -> None:
    async def scenario() -> None:
        engine, factory, path = await _setup()
        try:
            async with factory() as session:
                run = await repo.create_run(
                    session,
                    request="запрос",
                    user_data={},
                    status="queued",
                )
                run_id = run.id

            async with factory() as session:
                updated = await repo.update_run(
                    session, run_id, status="running"
                )

            assert updated is not None
            assert updated.status == "running"
        finally:
            await engine.dispose()
            if os.path.exists(path):
                os.remove(path)

    asyncio.run(scenario())


def test_get_missing_run_returns_none() -> None:
    async def scenario() -> None:
        engine, factory, path = await _setup()
        try:
            async with factory() as session:
                assert await repo.get_run(session, "missing-id") is None
        finally:
            await engine.dispose()
            if os.path.exists(path):
                os.remove(path)

    asyncio.run(scenario())
