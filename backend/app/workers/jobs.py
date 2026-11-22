"""Фоновые задачи Worker."""

from typing import Callable, Optional

from app.db.repositories import workflow_repository as repo
from app.db.session import AsyncSessionLocal
from app.schemas.results import PlanStatus
from app.services.workflow import run_workflow_async

_TERMINAL = {"completed", "failed", "cancelled"}

_STATUS_MAP = {
    PlanStatus.DONE: "completed",
    PlanStatus.NEEDS_INFO: "needs_info",
    PlanStatus.ERROR: "failed",
    PlanStatus.RUNNING: "running",
    PlanStatus.PENDING: "queued",
}


def _map_status(plan_status: PlanStatus) -> str:
    return _STATUS_MAP.get(plan_status, "failed")


async def run_workflow_job(
    ctx,
    run_id: str,
    session_factory=AsyncSessionLocal,
    workflow_runner: Callable = run_workflow_async,
) -> str:
    """Выполнить workflow для сохранённого запуска.

    session_factory и workflow_runner — точки подмены для тестов.
    """
    async with session_factory() as session:
        run = await repo.get_run(session, run_id)
        if run is None:
            return "not_found"
        if run.status in _TERMINAL:
            return "skipped"
        await repo.update_run(
            session,
            run_id,
            status="running",
            error=None,
            started_at=repo.utcnow(),
        )

    try:
        state = await workflow_runner(run.request, run.user_data)
        status = _map_status(state.status)
        error = (state.final_answer or {}).get("error")
        async with session_factory() as session:
            await repo.update_run(
                session,
                run_id,
                status=status,
                state=state.model_dump(mode="json"),
                error=error,
                finished_at=repo.utcnow(),
            )
        return status
    except Exception as exc:
        async with session_factory() as session:
            await repo.update_run(
                session,
                run_id,
                status="failed",
                error=f"{type(exc).__name__}: {exc}",
                finished_at=repo.utcnow(),
            )
        return "failed"
