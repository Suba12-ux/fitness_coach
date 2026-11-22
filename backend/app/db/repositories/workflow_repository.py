"""Репозиторий запусков workflow."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.workflow import WorkflowRun


async def create_run(
    session: AsyncSession,
    *,
    request: str,
    user_data: Dict[str, Any],
    status: str = "queued",
    state: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None,
) -> WorkflowRun:
    """Создать запись запуска и вернуть её."""
    run = WorkflowRun(
        request=request,
        user_id=user_id,
        user_data=user_data,
        status=status,
        state=state or {},
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)
    return run


async def get_run(session: AsyncSession, run_id: str) -> Optional[WorkflowRun]:
    """Вернуть запись по идентификатору или None."""
    return await session.get(WorkflowRun, run_id)


async def get_run_for_user(
    session: AsyncSession, run_id: str, user_id: str
) -> Optional[WorkflowRun]:
    """Вернуть запуск только если он принадлежит пользователю."""
    result = await session.execute(
        select(WorkflowRun).where(
            WorkflowRun.id == run_id, WorkflowRun.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def list_runs(
    session: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None,
) -> List[WorkflowRun]:
    """Вернуть страницу запусков, свежие сверху."""
    statement = select(WorkflowRun)
    if status:
        statement = statement.where(WorkflowRun.status == status)
    statement = (
        statement.order_by(
            WorkflowRun.created_at.desc(), WorkflowRun.id.desc()
        )
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(statement)
    return list(result.scalars().all())


async def count_runs(
    session: AsyncSession, *, status: Optional[str] = None
) -> int:
    """Посчитать количество запусков (опционально — по статусу)."""
    statement = select(func.count()).select_from(WorkflowRun)
    if status:
        statement = statement.where(WorkflowRun.status == status)
    result = await session.execute(statement)
    return int(result.scalar_one())


async def list_runs_for_user(
    session: AsyncSession,
    user_id: str,
    *,
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None,
) -> List[WorkflowRun]:
    """Страница запусков конкретного пользователя."""
    statement = select(WorkflowRun).where(WorkflowRun.user_id == user_id)
    if status:
        statement = statement.where(WorkflowRun.status == status)
    statement = (
        statement.order_by(
            WorkflowRun.created_at.desc(), WorkflowRun.id.desc()
        )
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(statement)
    return list(result.scalars().all())


async def count_runs_for_user(
    session: AsyncSession, user_id: str, *, status: Optional[str] = None
) -> int:
    """Количество запусков пользователя."""
    statement = (
        select(func.count())
        .select_from(WorkflowRun)
        .where(WorkflowRun.user_id == user_id)
    )
    if status:
        statement = statement.where(WorkflowRun.status == status)
    result = await session.execute(statement)
    return int(result.scalar_one())


async def update_run(
    session: AsyncSession,
    run_id: str,
    *,
    status: Optional[str] = None,
    state: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    started_at: Optional[datetime] = None,
    finished_at: Optional[datetime] = None,
) -> Optional[WorkflowRun]:
    """Обновить поля запуска; вернуть обновлённую запись или None."""
    run = await session.get(WorkflowRun, run_id)
    if run is None:
        return None

    if status is not None:
        run.status = status
    if state is not None:
        run.state = state
    if error is not None:
        run.error = error
    if started_at is not None:
        run.started_at = started_at
    if finished_at is not None:
        run.finished_at = finished_at

    await session.commit()
    await session.refresh(run)
    return run


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
