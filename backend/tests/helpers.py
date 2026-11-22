"""Хелперы для API-тестов."""

import asyncio
from typing import Any, Dict, Optional

from fastapi.testclient import TestClient

from app.db.repositories import workflow_repository


def register_user(
    client: TestClient, email: str = "user@example.com"
) -> Dict[str, Any]:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "password123",
            "remember_me": True,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def sample_plan() -> Dict[str, Any]:
    return {
        "goal": "сила",
        "sessions": [
            {
                "day": "Понедельник",
                "activity": "Силовая тренировка",
                "duration_min": 45,
                "exercises": [
                    {"name": "Приседания", "sets": 3, "reps": 10},
                    {"name": "Планка", "sets": 3, "duration_min": 1},
                ],
            },
            {
                "day": "Среда",
                "activity": "Кардио-тренировка",
                "duration_min": 30,
                "exercises": [{"name": "Бег", "duration_min": 20}],
            },
        ],
        "assumptions": ["тестовый план"],
        "limitations": [],
    }


def seed_completed_run(
    factory,
    user_id: str,
    plan: Optional[Dict[str, Any]] = None,
    *,
    status: str = "completed",
) -> str:
    """Создать запуск с готовым планом напрямую в БД."""
    final_answer = {
        "profile": {"goal": "сила"},
        "plan": plan if plan is not None else sample_plan(),
        "safety": {"issues": []},
        "warnings": [],
    }

    async def seed() -> str:
        async with factory() as session:
            run = await workflow_repository.create_run(
                session,
                request="Подготовь план",
                user_data={"goal": "сила"},
                status=status,
                state={"final_answer": final_answer},
                user_id=user_id,
            )
            return run.id

    return asyncio.run(seed())
