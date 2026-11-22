"""FastAPI-приложение: запуск workflow в фоне и чтение состояния."""

from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.auth.dependencies import get_current_user
from app.auth.router import router as auth_router
from app.config import settings
from app.db.models.user import User
from app.db.repositories import workflow_repository
from app.db.session import AsyncSessionLocal, async_engine, create_all
from app.queue import enqueue_workflow
from app.routers.profiles import router as profile_router
from app.routers.programs import router as programs_router
from app.routers.workouts import router as workouts_router
from app.schemas.api import (
    WorkflowList,
    WorkflowListItem,
    WorkflowRequest,
    WorkflowResponse,
)

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def _to_response(
    run_id: str,
    request: str,
    status: str,
    final_answer: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    *,
    user_data: Optional[Dict[str, Any]] = None,
    created_at: Optional[datetime] = None,
    started_at: Optional[datetime] = None,
    finished_at: Optional[datetime] = None,
) -> WorkflowResponse:
    final = final_answer or {}
    missing = final.get("missing_data")
    if not isinstance(missing, list):
        missing = []
    return WorkflowResponse(
        run_id=run_id,
        status=status,
        request=request,
        final_answer=final,
        missing_data=missing,
        error=error or final.get("error"),
        user_data=user_data or {},
        created_at=created_at,
        started_at=started_at,
        finished_at=finished_at,
    )


def create_app(session_factory=None, engine=None) -> FastAPI:
    """Собрать приложение; в тестах можно передать свои сессию и движок."""
    sf = session_factory or AsyncSessionLocal
    eng = engine or async_engine

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # В dev/test — быстрый фолбэк create_all; в production схему создаёт Alembic.
        if settings.app_env in ("development", "test"):
            await create_all(eng)
        yield

    app = FastAPI(title="Sensei AI Fitness Coach", lifespan=lifespan)
    app.state.session_factory = sf

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(profile_router)
    app.include_router(programs_router)
    app.include_router(workouts_router)

    @app.get("/health")
    def health() -> Dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready")
    async def ready() -> JSONResponse:
        checks: Dict[str, str] = {}

        try:
            async with sf() as session:
                await session.execute(text("SELECT 1"))
            checks["database"] = "ok"
        except Exception as exc:  # noqa: BLE001 — внешняя зависимость
            checks["database"] = f"error: {exc}"

        try:
            import redis.asyncio as aioredis

            client = aioredis.from_url(settings.redis_url)
            await client.ping()
            await client.aclose()
            checks["redis"] = "ok"
        except Exception as exc:  # noqa: BLE001 — внешняя зависимость
            checks["redis"] = f"error: {exc}"

        healthy = all(value == "ok" for value in checks.values())
        return JSONResponse(
            status_code=200 if healthy else 503,
            content={"status": "ok" if healthy else "degraded", "checks": checks},
        )

    @app.post("/workflow", response_model=WorkflowResponse, status_code=202)
    async def create_workflow(
        body: WorkflowRequest, user: User = Depends(get_current_user)
    ) -> WorkflowResponse:
        async with sf() as session:
            run = await workflow_repository.create_run(
                session,
                request=body.request,
                user_data=body.user_data,
                status="queued",
                user_id=user.id,
            )
            run_id = run.id
            created_at = run.created_at

        try:
            await enqueue_workflow(run_id)
        except Exception as exc:  # noqa: BLE001 — Redis недоступен
            async with sf() as session:
                await workflow_repository.update_run(
                    session,
                    run_id,
                    status="failed",
                    error=f"Не удалось поставить задачу в очередь: {exc}",
                )
            raise HTTPException(
                status_code=503, detail="Очередь задач недоступна."
            )

        return _to_response(
            run_id,
            body.request,
            "queued",
            user_data=body.user_data,
            created_at=created_at,
        )

    @app.get("/workflow", response_model=WorkflowList)
    async def list_workflows(
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0),
        status: Optional[str] = Query(None),
        user: User = Depends(get_current_user),
    ) -> WorkflowList:
        async with sf() as session:
            runs = await workflow_repository.list_runs_for_user(
                session, user.id, limit=limit, offset=offset, status=status
            )
            total = await workflow_repository.count_runs_for_user(
                session, user.id, status=status
            )

        return WorkflowList(
            items=[
                WorkflowListItem(
                    run_id=run.id,
                    status=run.status,
                    request=run.request,
                    created_at=run.created_at,
                    finished_at=run.finished_at,
                    error=run.error,
                )
                for run in runs
            ],
            total=total,
        )

    @app.get("/workflow/{run_id}", response_model=WorkflowResponse)
    async def get_workflow(
        run_id: str, user: User = Depends(get_current_user)
    ) -> WorkflowResponse:
        async with sf() as session:
            run = await workflow_repository.get_run_for_user(
                session, run_id, user.id
            )
            if run is None:
                raise HTTPException(status_code=404, detail="Запуск не найден.")
            return _to_response(
                run.id,
                run.request,
                run.status,
                run.state.get("final_answer"),
                error=run.error,
                user_data=run.user_data,
                created_at=run.created_at,
                started_at=run.started_at,
                finished_at=run.finished_at,
            )

    # Собранный фронтенд (если он есть) раздаётся с того же адреса.
    # Монтируется последним, чтобы не перекрывать API-роуты.
    if FRONTEND_DIST.is_dir():
        app.mount(
            "/",
            StaticFiles(directory=str(FRONTEND_DIST), html=True),
            name="frontend",
        )

    return app


app = create_app()
