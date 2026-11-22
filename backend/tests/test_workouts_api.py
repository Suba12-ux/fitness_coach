"""Проверки API фактических тренировок и результатов."""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from tests.helpers import register_user, seed_completed_run


def _program_with_workouts(client, factory, user_id):
    run_id = seed_completed_run(factory, user_id)
    response = client.post("/programs", json={"run_id": run_id})
    assert response.status_code == 201, response.text
    return response.json()


def _start_planned(client, program: dict) -> dict:
    planned_id = program["workouts"][0]["id"]
    response = client.post(
        "/workouts", json={"planned_workout_id": planned_id}
    )
    assert response.status_code == 201, response.text
    return response.json()


def _sample_sets() -> list:
    return [
        {"reps": 10, "weight_kg": 40.0},
        {"reps": 8, "weight_kg": 45.0},
        {"skipped": True},
    ]


def test_workouts_require_auth(api_env) -> None:
    client, _ = api_env

    assert client.post("/workouts", json={"title": "x"}).status_code == 401
    assert client.get("/workouts").status_code == 401
    assert client.get("/workouts/x").status_code == 401
    assert client.patch("/workouts/x", json={"comment": "x"}).status_code == 401
    assert client.put("/workouts/x/exercises", json={}).status_code == 401


def test_start_workout_from_plan_prefills_exercises(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    program = _program_with_workouts(client, factory, user["id"])

    workout = _start_planned(client, program)

    assert workout["status"] == "in_progress"
    assert workout["planned_workout_id"] == program["workouts"][0]["id"]
    assert workout["program_id"] == program["id"]
    assert workout["title"] == "Силовая тренировка"
    assert len(workout["exercises"]) == 2
    assert workout["exercises"][0]["name"] == "Приседания"
    assert workout["exercises"][0]["planned"] == {"sets": 3, "reps": 10}
    assert workout["exercises"][0]["sets"] == []


def test_repeated_start_returns_existing_session(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    program = _program_with_workouts(client, factory, user["id"])
    planned_id = program["workouts"][0]["id"]

    first = client.post(
        "/workouts", json={"planned_workout_id": planned_id}
    )
    second = client.post(
        "/workouts", json={"planned_workout_id": planned_id}
    )

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert client.get("/workouts").json()["total"] == 1


def test_start_standalone_workout(api_env) -> None:
    client, _ = api_env
    register_user(client)

    response = client.post(
        "/workouts", json={"title": "Своя тренировка"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Своя тренировка"
    assert body["program_id"] is None
    assert body["planned_workout_id"] is None
    assert body["exercises"] == []


def test_start_workout_requires_source(api_env) -> None:
    client, _ = api_env
    register_user(client)

    assert client.post("/workouts", json={}).status_code == 422
    assert (
        client.post("/workouts", json={"title": "   "}).status_code == 422
    )


def test_start_workout_with_program(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    program = _program_with_workouts(client, factory, user["id"])

    response = client.post(
        "/workouts",
        json={"title": "Свободная", "program_id": program["id"]},
    )

    assert response.status_code == 201
    assert response.json()["program_id"] == program["id"]


def test_start_workout_with_foreign_program_returns_404(api_env) -> None:
    client, factory = api_env
    register_user(client, "first@example.com")

    second = TestClient(client.app)
    with second:
        other = register_user(second, "second@example.com")
        program = _program_with_workouts(second, factory, other["id"])
        foreign_planned = program["workouts"][0]["id"]

        by_program = client.post(
            "/workouts",
            json={"title": "Чужая", "program_id": program["id"]},
        )
        by_planned = client.post(
            "/workouts", json={"planned_workout_id": foreign_planned}
        )

    assert by_program.status_code == 404
    assert by_planned.status_code == 404


def test_save_exercise_results(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    program = _program_with_workouts(client, factory, user["id"])
    workout = _start_planned(client, program)

    response = client.put(
        f"/workouts/{workout['id']}/exercises",
        json={
            "exercises": [
                {
                    "name": "Приседания",
                    "comment": "легко",
                    "sets": _sample_sets(),
                },
                {"name": "Планка", "sets": [{"duration_sec": 60}]},
            ]
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    first = body["exercises"][0]
    assert first["position"] == 1
    assert first["comment"] == "легко"
    assert [item["position"] for item in first["sets"]] == [1, 2, 3]
    assert first["sets"][0]["reps"] == 10
    assert first["sets"][0]["weight_kg"] == 40.0
    assert first["sets"][2]["skipped"] is True
    assert first["sets"][2]["reps"] is None
    assert first["planned"] == {"sets": 3, "reps": 10}
    assert body["exercises"][1]["planned"] == {"sets": 3, "duration_min": 1}


def test_replace_exercises_does_not_duplicate(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    program = _program_with_workouts(client, factory, user["id"])
    workout = _start_planned(client, program)

    client.put(
        f"/workouts/{workout['id']}/exercises",
        json={
            "exercises": [
                {"name": "Приседания", "sets": [{"reps": 10}]}
            ]
        },
    )
    replaced = client.put(
        f"/workouts/{workout['id']}/exercises",
        json={
            "exercises": [
                {"name": "Планка", "sets": [{"duration_sec": 30}]}
            ]
        },
    )

    assert replaced.status_code == 200
    exercises = replaced.json()["exercises"]
    assert len(exercises) == 1
    assert exercises[0]["name"] == "Планка"
    assert exercises[0]["planned"] is None


def test_planned_snapshot_cannot_be_overwritten(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    program = _program_with_workouts(client, factory, user["id"])
    workout = _start_planned(client, program)

    client.put(
        f"/workouts/{workout['id']}/exercises",
        json={
            "exercises": [
                {"name": "Приседания", "sets": [{"reps": 5}]}
            ]
        },
    )
    forbidden = client.put(
        f"/workouts/{workout['id']}/exercises",
        json={
            "exercises": [
                {
                    "name": "Приседания",
                    "planned": {"sets": 99},
                    "sets": [{"reps": 5}],
                }
            ]
        },
    )
    detail = client.get(f"/workouts/{workout['id']}").json()

    assert forbidden.status_code == 422
    assert detail["exercises"][0]["planned"] == {"sets": 3, "reps": 10}


def test_invalid_set_values_rejected(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    program = _program_with_workouts(client, factory, user["id"])
    workout = _start_planned(client, program)
    url = f"/workouts/{workout['id']}/exercises"

    empty_set = client.put(
        url, json={"exercises": [{"name": "Приседания", "sets": [{}]}]}
    )
    weight_only = client.put(
        url,
        json={
            "exercises": [
                {"name": "Приседания", "sets": [{"weight_kg": 40}]}
            ]
        },
    )
    negative_reps = client.put(
        url,
        json={
            "exercises": [
                {"name": "Приседания", "sets": [{"reps": -1}]}
            ]
        },
    )

    assert empty_set.status_code == 422
    assert weight_only.status_code == 422
    assert negative_reps.status_code == 422


def test_finish_workout_and_lock_results(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    program = _program_with_workouts(client, factory, user["id"])
    workout = _start_planned(client, program)
    client.put(
        f"/workouts/{workout['id']}/exercises",
        json={"exercises": [{"name": "Приседания", "sets": [{"reps": 10}]}]},
    )

    finished = client.patch(
        f"/workouts/{workout['id']}",
        json={"status": "completed", "perceived_exertion": 7},
    )
    locked = client.put(
        f"/workouts/{workout['id']}/exercises",
        json={"exercises": []},
    )
    reopened = client.patch(
        f"/workouts/{workout['id']}", json={"status": "in_progress"}
    )
    repeated = client.patch(
        f"/workouts/{workout['id']}", json={"status": "completed"}
    )

    assert finished.status_code == 200
    assert finished.json()["status"] == "completed"
    assert finished.json()["finished_at"]
    assert finished.json()["perceived_exertion"] == 7
    assert locked.status_code == 409
    assert reopened.status_code == 409
    assert repeated.status_code == 200


def test_patch_comment_and_validation(api_env) -> None:
    client, _ = api_env
    register_user(client)
    workout = client.post(
        "/workouts", json={"title": "Своя"}
    ).json()

    updated = client.patch(
        f"/workouts/{workout['id']}",
        json={"comment": "хорошо", "perceived_exertion": 8},
    )
    too_much = client.patch(
        f"/workouts/{workout['id']}", json={"perceived_exertion": 11}
    )

    assert updated.status_code == 200
    assert updated.json()["comment"] == "хорошо"
    assert updated.json()["perceived_exertion"] == 8
    assert too_much.status_code == 422


def test_workout_history_filters_and_pagination(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    program = _program_with_workouts(client, factory, user["id"])
    for title in ("Первая", "Вторая", "Третья"):
        client.post(
            "/workouts",
            json={"title": title, "program_id": program["id"]},
        )

    all_workouts = client.get("/workouts").json()
    page = client.get("/workouts", params={"limit": 2}).json()
    by_program = client.get(
        "/workouts", params={"program_id": program["id"]}
    ).json()
    by_status = client.get(
        "/workouts", params={"status": "in_progress"}
    ).json()
    today = datetime.now(timezone.utc).date()
    recent = client.get(
        "/workouts", params={"from": today.isoformat()}
    ).json()
    older = client.get(
        "/workouts",
        params={"to": (today - timedelta(days=1)).isoformat()},
    ).json()

    assert all_workouts["total"] == 3
    assert len(page["items"]) == 2
    assert by_program["total"] == 3
    assert by_status["total"] == 3
    assert recent["total"] == 3
    assert older["total"] == 0
    assert all_workouts["items"][0]["title"] == "Третья"


def test_workouts_isolated_between_users(api_env) -> None:
    client, factory = api_env
    user = register_user(client, "first@example.com")
    program = _program_with_workouts(client, factory, user["id"])
    workout = _start_planned(client, program)

    second = TestClient(client.app)
    with second:
        register_user(second, "second@example.com")

        assert second.get("/workouts").json()["total"] == 0
        assert second.get(f"/workouts/{workout['id']}").status_code == 404
        assert (
            second.patch(
                f"/workouts/{workout['id']}", json={"comment": "чужое"}
            ).status_code
            == 404
        )
        assert (
            second.put(
                f"/workouts/{workout['id']}/exercises",
                json={"exercises": []},
            ).status_code
            == 404
        )
