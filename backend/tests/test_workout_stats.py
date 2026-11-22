"""Проверки статистики и динамики тренировок."""

from fastapi.testclient import TestClient

from tests.helpers import register_user, seed_completed_run


def _program(client, factory, user_id) -> dict:
    run_id = seed_completed_run(factory, user_id)
    response = client.post("/programs", json={"run_id": run_id})
    assert response.status_code == 201, response.text
    return response.json()


def _complete_workout(client, program: dict, sets: list) -> str:
    planned_id = program["workouts"][0]["id"]
    workout = client.post(
        "/workouts", json={"planned_workout_id": planned_id}
    ).json()
    saved = client.put(
        f"/workouts/{workout['id']}/exercises",
        json={"exercises": [{"name": "Приседания", "sets": sets}]},
    )
    assert saved.status_code == 200, saved.text
    finished = client.patch(
        f"/workouts/{workout['id']}", json={"status": "completed"}
    )
    assert finished.status_code == 200, finished.text
    return workout["id"]


def test_stats_require_auth(api_env) -> None:
    client, _ = api_env

    assert client.get("/workouts/stats").status_code == 401
    assert client.get("/workouts/exercises").status_code == 401
    assert client.get("/workouts/progress", params={"exercise": "x"}).status_code == 401


def test_stats_and_progress(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    program = _program(client, factory, user["id"])

    _complete_workout(
        client,
        program,
        [
            {"reps": 10, "weight_kg": 40.0},
            {"reps": 8, "weight_kg": 45.0},
        ],
    )
    _complete_workout(client, program, [{"reps": 10, "weight_kg": 50.0}])

    stats = client.get("/workouts/stats").json()
    names = client.get("/workouts/exercises").json()["items"]
    progress = client.get(
        "/workouts/progress", params={"exercise": "Приседания"}
    ).json()

    assert stats["completed_total"] == 2
    assert stats["completed_last_7_days"] == 2
    assert stats["completed_last_30_days"] == 2
    assert len(stats["recent_dates"]) == 2
    assert stats["by_program"] == [
        {
            "program_id": program["id"],
            "name": program["name"],
            "completed_count": 2,
        }
    ]

    assert names == [{"name": "Приседания", "completed_sessions": 2}]

    assert len(progress) == 2
    assert progress[0]["top_weight_kg"] == 45.0
    assert progress[0]["total_reps"] == 18
    assert progress[0]["total_volume_kg"] == 760.0
    assert progress[1]["top_weight_kg"] == 50.0


def test_stats_ignore_unfinished_workouts(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    program = _program(client, factory, user["id"])
    planned_id = program["workouts"][0]["id"]
    client.post("/workouts", json={"planned_workout_id": planned_id})

    stats = client.get("/workouts/stats").json()

    assert stats["completed_total"] == 0
    assert stats["by_program"] == []
    assert client.get("/workouts/exercises").json()["items"] == []


def test_stats_isolated_between_users(api_env) -> None:
    client, factory = api_env
    user = register_user(client, "first@example.com")
    program = _program(client, factory, user["id"])
    _complete_workout(client, program, [{"reps": 10, "weight_kg": 40.0}])

    second = TestClient(client.app)
    with second:
        register_user(second, "second@example.com")

        stats = second.get("/workouts/stats").json()
        names = second.get("/workouts/exercises").json()["items"]
        progress = second.get(
            "/workouts/progress", params={"exercise": "Приседания"}
        ).json()

    assert stats["completed_total"] == 0
    assert names == []
    assert progress == []
