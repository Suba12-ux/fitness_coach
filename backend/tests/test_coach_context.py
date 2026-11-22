"""Проверки read-only контекста для будущих агентов."""

import asyncio

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.db.models.training import WorkoutSession
from app.services.coach_context import build_context
from tests.helpers import register_user, seed_completed_run


def _load(factory, user_id: str, recent_limit: int = 5):
    async def scenario():
        async with factory() as session:
            return await build_context(
                session, user_id, recent_limit=recent_limit
            )

    return asyncio.run(scenario())


def test_context_contains_profile_program_and_workouts(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    client.put(
        "/profile",
        json={
            "goal": "сила",
            "experience_level": "beginner",
            "days_per_week": 3,
            "minutes_per_session": 45,
            "limitations": ["колено"],
        },
    )
    run_id = seed_completed_run(factory, user["id"])
    program = client.post("/programs", json={"run_id": run_id}).json()

    planned_id = program["workouts"][0]["id"]
    workout = client.post(
        "/workouts", json={"planned_workout_id": planned_id}
    ).json()
    client.put(
        f"/workouts/{workout['id']}/exercises",
        json={
            "exercises": [
                {
                    "name": "Приседания",
                    "sets": [
                        {"reps": 10, "weight_kg": 40.0},
                        {"reps": 8, "weight_kg": 45.0},
                    ],
                }
            ]
        },
    )
    client.patch(
        f"/workouts/{workout['id']}",
        json={"status": "completed", "comment": "хорошо"},
    )

    context = _load(factory, user["id"])

    assert context.profile is not None
    assert context.profile.goal == "сила"
    assert context.profile.limitations == ["колено"]
    assert context.active_program is not None
    assert context.active_program.program_id == program["id"]
    assert context.active_program.workouts_count == 2
    assert context.completed_total == 1
    assert context.completed_last_7_days == 1

    assert len(context.recent_workouts) == 1
    recent = context.recent_workouts[0]
    assert recent.workout_id == workout["id"]
    assert recent.comment == "хорошо"
    assert recent.exercises[0].name == "Приседания"
    assert recent.exercises[0].sets_count == 2
    assert recent.exercises[0].top_weight_kg == 45.0
    assert recent.exercises[0].total_reps == 18


def test_context_is_read_only(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    run_id = seed_completed_run(factory, user["id"])
    program = client.post("/programs", json={"run_id": run_id}).json()
    planned_id = program["workouts"][0]["id"]
    workout = client.post(
        "/workouts", json={"planned_workout_id": planned_id}
    ).json()
    client.patch(
        f"/workouts/{workout['id']}", json={"status": "completed"}
    )

    first = _load(factory, user["id"])
    second = _load(factory, user["id"])

    async def count_sessions() -> int:
        async with factory() as session:
            return int(
                await session.scalar(
                    select(func.count()).select_from(WorkoutSession)
                )
                or 0
            )

    assert asyncio.run(count_sessions()) == 1
    assert first.completed_total == second.completed_total == 1
    assert [item.workout_id for item in first.recent_workouts] == [
        item.workout_id for item in second.recent_workouts
    ]


def test_context_isolated_between_users(api_env) -> None:
    client, factory = api_env
    register_user(client, "first@example.com")

    second_client = TestClient(client.app)
    with second_client:
        second = register_user(second_client, "second@example.com")
        context = _load(factory, second["id"])

    assert context.profile is None
    assert context.active_program is None
    assert context.recent_workouts == []
    assert context.completed_total == 0
