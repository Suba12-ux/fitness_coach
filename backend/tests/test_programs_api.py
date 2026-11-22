"""Проверки API сохранённых программ."""

from fastapi.testclient import TestClient

from tests.helpers import register_user, sample_plan, seed_completed_run


def _create_program(
    client: TestClient, run_id: str, **body
) -> dict:
    payload = {"run_id": run_id, **body}
    return client.post("/programs", json=payload)


def test_programs_require_auth(api_env) -> None:
    client, _ = api_env

    assert client.get("/programs").status_code == 401
    assert client.post("/programs", json={"run_id": "x"}).status_code == 401
    assert client.get("/programs/x").status_code == 401
    assert client.patch("/programs/x", json={"name": "n"}).status_code == 401
    assert client.delete("/programs/x").status_code == 401


def test_create_program_from_completed_run(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    run_id = seed_completed_run(factory, user["id"])

    response = _create_program(client, run_id, name="Силовая программа")

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Силовая программа"
    assert body["status"] == "active"
    assert body["source_run_id"] == run_id
    assert body["planned_workouts_count"] == 2
    assert body["goal"] == "сила"
    assert body["assumptions"] == ["тестовый план"]
    assert len(body["workouts"]) == 2
    first = body["workouts"][0]
    assert first["title"] == "Силовая тренировка"
    assert first["exercises"][0]["name"] == "Приседания"
    assert first["exercises"][0]["planned"] == {"sets": 3, "reps": 10}
    assert first["completed_sessions_count"] == 0


def test_create_program_uses_goal_as_default_name(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    run_id = seed_completed_run(factory, user["id"])

    body = _create_program(client, run_id).json()

    assert body["name"] == "сила"


def test_create_program_is_idempotent(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    run_id = seed_completed_run(factory, user["id"])

    first = _create_program(client, run_id)
    second = _create_program(client, run_id, name="Другое имя")

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["name"] == first.json()["name"]
    assert client.get("/programs").json()["total"] == 1


def test_create_program_from_unfinished_run_conflicts(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    run_id = seed_completed_run(factory, user["id"], status="running")

    response = _create_program(client, run_id)

    assert response.status_code == 409


def test_create_program_from_foreign_run_returns_404(api_env) -> None:
    client, factory = api_env
    register_user(client, "first@example.com")

    second_client = TestClient(client.app)
    with second_client:
        second = register_user(second_client, "second@example.com")
        run_id = seed_completed_run(factory, second["id"])
        response = _create_program(client, run_id)

    assert response.status_code == 404


def test_legacy_plan_is_saved_without_exercises(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    run_id = seed_completed_run(
        factory,
        user["id"],
        plan={
            "goal": "выносливость",
            "sessions": [
                {
                    "day": "Среда",
                    "activity": "Кардио-тренировка",
                    "duration_min": 30,
                }
            ],
        },
    )

    body = _create_program(client, run_id).json()

    assert body["workouts"][0]["exercises"] == []


def test_only_one_active_program(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    first_run = seed_completed_run(factory, user["id"])
    second_run = seed_completed_run(factory, user["id"])

    first = _create_program(client, first_run).json()
    second = _create_program(client, second_run).json()

    first_after = client.get(f"/programs/{first['id']}").json()
    active = client.get("/programs", params={"status": "active"}).json()
    archived = client.get("/programs", params={"status": "archived"}).json()

    assert second["status"] == "active"
    assert first_after["status"] == "archived"
    assert active["total"] == 1
    assert active["items"][0]["id"] == second["id"]
    assert archived["total"] == 1
    assert archived["items"][0]["id"] == first["id"]


def test_create_inactive_program_keeps_current_active(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    first_run = seed_completed_run(factory, user["id"])
    second_run = seed_completed_run(factory, user["id"])

    first = _create_program(client, first_run).json()
    second = _create_program(client, second_run, activate=False).json()

    assert second["status"] == "archived"
    assert (
        client.get(f"/programs/{first['id']}").json()["status"] == "active"
    )


def test_activate_archives_previous_program(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    first_run = seed_completed_run(factory, user["id"])
    second_run = seed_completed_run(factory, user["id"])

    first = _create_program(client, first_run).json()
    second = _create_program(client, second_run).json()

    activated = client.patch(
        f"/programs/{first['id']}", json={"status": "active"}
    )

    assert activated.status_code == 200
    assert activated.json()["status"] == "active"
    assert (
        client.get(f"/programs/{second['id']}").json()["status"]
        == "archived"
    )


def test_patch_program_name_and_description(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    run_id = seed_completed_run(factory, user["id"])
    program = _create_program(client, run_id).json()

    response = client.patch(
        f"/programs/{program['id']}",
        json={"name": "Новая программа", "description": "Описание"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Новая программа"
    assert response.json()["description"] == "Описание"


def test_patch_requires_a_change(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    run_id = seed_completed_run(factory, user["id"])
    program = _create_program(client, run_id).json()

    assert (
        client.patch(f"/programs/{program['id']}", json={}).status_code
        == 422
    )
    assert (
        client.patch(
            f"/programs/{program['id']}", json={"status": "deleted"}
        ).status_code
        == 422
    )


def test_delete_archives_program(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    run_id = seed_completed_run(factory, user["id"])
    program = _create_program(client, run_id).json()

    deleted = client.delete(f"/programs/{program['id']}")

    assert deleted.status_code == 204
    assert (
        client.get(f"/programs/{program['id']}").json()["status"]
        == "archived"
    )


def test_program_list_pagination(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    for _ in range(3):
        run_id = seed_completed_run(factory, user["id"])
        _create_program(client, run_id, activate=False)

    page = client.get("/programs", params={"limit": 2, "offset": 0}).json()
    second = client.get("/programs", params={"limit": 2, "offset": 2}).json()

    assert page["total"] == 3
    assert len(page["items"]) == 2
    assert len(second["items"]) == 1


def test_programs_isolated_between_users(api_env) -> None:
    client, factory = api_env
    register_user(client, "first@example.com")
    first_user = client.get("/auth/me").json()
    run_id = seed_completed_run(factory, first_user["id"])
    program = _create_program(client, run_id).json()

    second = TestClient(client.app)
    with second:
        register_user(second, "second@example.com")

        assert second.get("/programs").json()["total"] == 0
        assert second.get(f"/programs/{program['id']}").status_code == 404
        assert (
            second.patch(
                f"/programs/{program['id']}", json={"name": "чужое"}
            ).status_code
            == 404
        )
        assert (
            second.delete(f"/programs/{program['id']}").status_code == 404
        )


def test_planned_values_are_snapshot_of_plan(api_env) -> None:
    client, factory = api_env
    user = register_user(client)
    plan = sample_plan()
    run_id = seed_completed_run(factory, user["id"], plan=plan)

    program = _create_program(client, run_id).json()

    assert program["workouts"][1]["exercises"][0]["planned"] == {
        "duration_min": 20
    }
