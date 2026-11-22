"""Отдельный Worker-процесс (ARQ + Redis)."""

import asyncio
import logging

from arq import Worker

from app.config import settings
from app.queue import redis_settings
from app.workers.jobs import run_workflow_job


class WorkerSettings:
    """Конфигурация Worker для `arq`."""

    functions = [run_workflow_job]
    redis_settings = redis_settings()
    max_tries = settings.worker_max_tries
    job_timeout = settings.worker_job_timeout_seconds


def configure_logging() -> None:
    """Настроить вывод логов: без этого ARQ пишет в никуда (в т.ч. в Docker)."""
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s %(levelname)s [worker] %(name)s: %(message)s",
    )


async def main() -> None:
    configure_logging()
    logging.getLogger(__name__).info(
        "Worker запускается: redis=%s, max_tries=%s, job_timeout=%ss",
        settings.redis_url,
        settings.worker_max_tries,
        settings.worker_job_timeout_seconds,
    )
    worker = Worker(
        functions=WorkerSettings.functions,
        redis_settings=WorkerSettings.redis_settings,
        max_tries=WorkerSettings.max_tries,
        job_timeout=WorkerSettings.job_timeout,
    )
    await worker.async_run()


if __name__ == "__main__":
    asyncio.run(main())
