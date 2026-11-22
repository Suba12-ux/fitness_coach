"""Точка сборки и запуска оркестрации."""

import asyncio
from typing import Any, Dict, Optional, Tuple

from app.agents.profile_agent import ProfileAgent
from app.agents.safety_checker import SafetyChecker
from app.agents.supervisor import Supervisor
from app.agents.training_agent import TrainingAgent
from app.config import settings
from app.db.repositories import workflow_repository
from app.db.session import AsyncSessionLocal
from app.llm.factory import get_llm
from app.schemas.results import PlanState


def build_supervisor(max_retries: Optional[int] = None) -> Supervisor:
    """Собрать Supervisor с агентами и LLM-провайдером по настройкам."""
    return Supervisor(
        profile_agent=ProfileAgent(),
        training_agent=TrainingAgent(),
        safety_checker=SafetyChecker(),
        llm=get_llm(),
        max_retries=max_retries if max_retries is not None else settings.max_retries,
        timeout_seconds=settings.agent_timeout_seconds,
    )


def run_workflow(
    request: str,
    user_data: Dict[str, Any],
    max_retries: Optional[int] = None,
) -> PlanState:
    """Запустить процесс синхронно и вернуть итоговое состояние."""
    return asyncio.run(run_workflow_async(request, user_data, max_retries))


async def run_workflow_async(
    request: str,
    user_data: Dict[str, Any],
    max_retries: Optional[int] = None,
) -> PlanState:
    """Асинхронный вариант для использования внутри event loop."""
    return await build_supervisor(max_retries).run_async(
        request=request, user_data=user_data
    )


def run_workflow_persisted(
    request: str,
    user_data: Dict[str, Any],
    max_retries: Optional[int] = None,
) -> Tuple[PlanState, str]:
    """Синхронный запуск с сохранением в БД; вернуть (state, run_id)."""
    return asyncio.run(
        run_workflow_persisted_async(request, user_data, max_retries)
    )


async def run_workflow_persisted_async(
    request: str,
    user_data: Dict[str, Any],
    max_retries: Optional[int] = None,
) -> Tuple[PlanState, str]:
    """Асинхронный запуск с сохранением результата."""
    state = await run_workflow_async(request, user_data, max_retries)
    async with AsyncSessionLocal() as session:
        run = await workflow_repository.create_run(
            session,
            request=request,
            user_data=user_data,
            status=state.status.value,
            state=state.model_dump(mode="json"),
        )
        return state, run.id
