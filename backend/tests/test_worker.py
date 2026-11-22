"""Проверки фоновой задачи Worker (без Redis)."""

import asyncio
import os
import tempfile

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.repositories import workflow_repository as repo
from app.schemas.results import PlanState, PlanStatus
from app.workers.jobs import run_workflow_job


async def _setup():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_async_engine(f"sqlite+aiosqlite:///{path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, factory, path


def _done_state() -> PlanState:
    return PlanState(
        request="запрос",
        status=PlanStatus.DONE,
        final_answer={"plan": {"goal": "цель"}},
    )


def test_job_completes_run() -> None:
    async def scenario() -> None:
        engine, factory, path = await _setup()
        try:
            async def runner(request, user_data) -> PlanState:
                return _done_state()

            async with factory() as session:
                run = await repo.create_run(
                    session, request="запрос", user_data={}, status="queued"
                )
                run_id = run.id

            result = await run_workflow_job(
                None, run_id, session_factory=factory, workflow_runner=runner
            )
            assert result == "completed"

            async with factory() as session:
                loaded = await repo.get_run(session, run_id)

            assert loaded.status == "completed"
            assert loaded.finished_at is not None
            assert loaded.state["final_answer"]["plan"]["goal"] == "цель"
        finally:
            await engine.dispose()
            if os.path.exists(path):
                os.remove(path)

    asyncio.run(scenario())


def test_job_fails_on_exception() -> None:
    async def scenario() -> None:
        engine, factory, path = await _setup()
        try:
            async def runner(request, user_data) -> PlanState:
                raise RuntimeError("сломалось")

            async with factory() as session:
                run = await repo.create_run(
                    session, request="запрос", user_data={}, status="queued"
                )
                run_id = run.id

            result = await run_workflow_job(
                None, run_id, session_factory=factory, workflow_runner=runner
            )
            assert result == "failed"

            async with factory() as session:
                loaded = await repo.get_run(session, run_id)

            assert loaded.status == "failed"
            assert "RuntimeError" in loaded.error
        finally:
            await engine.dispose()
            if os.path.exists(path):
                os.remove(path)

    asyncio.run(scenario())


def test_job_skips_terminal_run() -> None:
    async def scenario() -> None:
        engine, factory, path = await _setup()
        try:
            called = {"count": 0}

            async def runner(request, user_data) -> PlanState:
                called["count"] += 1
                return _done_state()

            async with factory() as session:
                run = await repo.create_run(
                    session,
                    request="запрос",
                    user_data={},
                    status="completed",
                )
                run_id = run.id

            result = await run_workflow_job(
                None, run_id, session_factory=factory, workflow_runner=runner
            )
            assert result == "skipped"
            assert called["count"] == 0
        finally:
            await engine.dispose()
            if os.path.exists(path):
                os.remove(path)

    asyncio.run(scenario())


def test_job_returns_not_found() -> None:
    async def scenario() -> None:
        engine, factory, path = await _setup()
        try:
            result = await run_workflow_job(
                None, "missing", session_factory=factory, workflow_runner=lambda *a: None
            )
            assert result == "not_found"
        finally:
            await engine.dispose()
            if os.path.exists(path):
                os.remove(path)

    asyncio.run(scenario())
