"""Очередь фоновых задач на ARQ + Redis."""

from arq import create_pool
from arq.connections import RedisSettings

from app.config import settings


def redis_settings() -> RedisSettings:
    """Настройки подключения к Redis из конфигурации."""
    return RedisSettings.from_dsn(settings.redis_url)


async def enqueue_workflow(run_id: str) -> None:
    """Поставить задачу workflow в очередь (идемпотентно по run_id)."""
    redis = await create_pool(redis_settings())
    try:
        await redis.enqueue_job(
            "run_workflow_job",
            run_id,
            _job_id=f"workflow:{run_id}",
        )
    finally:
        await redis.aclose()
