"""Сквозной сценарий: план -> программа -> тренировка -> история."""

import asyncio

from fastapi.testclient import TestClient

from app.agents.profile_agent import ProfileAgent
from app.agents.safety_checker import SafetyChecker
from app.agents.supervisor import Supervisor
from app.agents.training_agent import TrainingAgent
from app.db.repositories import workflow_repository
from app.llm.mock import MockLLMProvider
from app.schemas.results import PlanStatus
from tests.helpers import register_user


def _user_data() -> dict:
    return {
        "goal": "общая физическая форма",
        "age": 30,
        "weight_kg": 75.0,
        "height_cm": 178.0,
        "experience_level": "beginner",
        "days_per_week": 3,
        "minutes_per_session": 45,
        "limitations": [],
    }


def test_full_training_flow(api_env) -> None:
    client, factory = api_env
    user = register_user(client)

    profile = client.put("/profile", json=_user_data())
    assert profile.status_code == 200

    supervisor = Supervisor(
        profile_agent=ProfileAgent(),
        training_agent=TrainingAgent(),
        safety_checker=SafetyChecker(),
        llm=MockLLMProvider(),
    )
    state = asyncio.run(
        supervisor.run_async("Подготовь план тренировок.", _user_data())
    )
    assert state.status == PlanStatus.DONE
    assert state.final_answer["plan"]["sessions"][0]["exercises"]

    async def save_run() -> str:
        async with factory() as session:
            run = await workflow_repository.create_run(
                session,
                request="Подготовь план тренировок.",
                user_data=_user_data(),
                status="completed",
                state=state.model_dump(mode="json"),
                user_id=user["id"],
            )
            return run.id

    run_id = asyncio.run(save_run())

    created = client.post(
        "/programs", json={"run_id": run_id, "name": "Основная программа"}
    )
    assert created.status_code == 201, created.text
    program = created.json()
    assert program["workouts"][0]["exercises"]

    planned = program["workouts"][0]
    started = client.post(
        "/workouts", json={"planned_workout_id": planned["id"]}
    )
    assert started.status_code == 201, started.text
    workout = started.json()
    assert len(workout["exercises"]) == len(planned["exercises"])

    exercise_name = workout["exercises"][0]["name"]
    saved = client.put(
        f"/workouts/{workout['id']}/exercises",
        json={
            "exercises": [
                {
                    "name": exercise_name,
                    "sets": [
                        {"reps": 10, "weight_kg": 40.0},
                        {"reps": 8, "weight_kg": 45.0},
                    ],
                }
            ]
        },
    )
    assert saved.status_code == 200, saved.text

    finished = client.patch(
        f"/workouts/{workout['id']}",
        json={
            "status": "completed",
            "comment": "первая тренировка",
            "perceived_exertion": 7,
        },
    )
    assert finished.status_code == 200
    assert finished.json()["status"] == "completed"

    stats = client.get("/workouts/stats").json()
    assert stats["completed_total"] == 1

    progress = client.get(
        "/workouts/progress", params={"exercise": exercise_name}
    ).json()
    assert len(progress) == 1
    assert progress[0]["top_weight_kg"] == 45.0

    refreshed = client.get(f"/programs/{program['id']}").json()
    assert refreshed["workouts"][0]["completed_sessions_count"] == 1
    assert refreshed["workouts"][0]["last_completed_at"]

    history = client.get("/workouts").json()
    assert history["total"] == 1
    assert history["items"][0]["id"] == workout["id"]

    second = TestClient(client.app)
    with second:
        register_user(second, "second@example.com")
        assert second.get("/programs").json()["total"] == 0
        assert second.get("/workouts").json()["total"] == 0
        assert second.get(f"/programs/{program['id']}").status_code == 404
        assert second.get(f"/workouts/{workout['id']}").status_code == 404
