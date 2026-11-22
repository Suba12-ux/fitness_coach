"""Проверки HTTP-эндпоинтов FastAPI (фоновое выполнение)."""

import asyncio
import os
import tempfile

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app import api
from app.api import create_app
from app.db.repositories import workflow_repository


def _full_data() -> dict:
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


def _make_client():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_async_engine(f"sqlite+aiosqlite:///{path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)
    app = create_app(session_factory=factory, engine=engine)
    return TestClient(app), engine, factory, path


def _register(client, email: str = "user@example.com") -> dict:
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


def _seed_runs(factory, statuses, user_id: str) -> list[str]:
    async def seed() -> list[str]:
        run_ids = []
        async with factory() as session:
            for index, status in enumerate(statuses):
                run = await workflow_repository.create_run(
                    session,
                    request=f"Запуск {index}",
                    user_data={"goal": "сила"},
                    status=status,
                    user_id=user_id,
                )
                run_ids.append(run.id)
        return run_ids

    return asyncio.run(seed())


def test_health() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_create_workflow_queued(monkeypatch) -> None:
    async def fake_enqueue(run_id: str) -> None:
        return None

    monkeypatch.setattr(api, "enqueue_workflow", fake_enqueue)

    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client)
            created = client.post(
                "/workflow",
                json={
                    "request": "Подготовь план тренировок.",
                    "user_data": _full_data(),
                },
            )
            assert created.status_code == 202
            body = created.json()
            assert body["status"] == "queued"
            assert body["run_id"]

            loaded = client.get(f"/workflow/{body['run_id']}")
            assert loaded.status_code == 200
            assert loaded.json()["status"] == "queued"
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_enqueue_failure_returns_503(monkeypatch) -> None:
    async def fake_enqueue(run_id: str) -> None:
        raise ConnectionError("redis down")

    monkeypatch.setattr(api, "enqueue_workflow", fake_enqueue)

    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client)
            response = client.post(
                "/workflow",
                json={
                    "request": "Подготовь план тренировок.",
                    "user_data": _full_data(),
                },
            )
        assert response.status_code == 503
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_get_missing_run_404() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client)
            response = client.get("/workflow/does-not-exist")
        assert response.status_code == 404
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_ready_reports_degraded_without_redis(monkeypatch) -> None:
    # Redis может быть запущен локально (например, из docker compose),
    # поэтому недоступность подменяем явно, а не полагаемся на окружение.
    def broken_from_url(*args, **kwargs):
        raise ConnectionError("redis down")

    monkeypatch.setattr("redis.asyncio.from_url", broken_from_url)

    client, engine, factory, path = _make_client()
    try:
        with client:
            response = client.get("/ready")
        assert response.status_code == 503
        assert response.json()["status"] == "degraded"
        assert response.json()["checks"]["database"] == "ok"
        assert response.json()["checks"]["redis"].startswith("error")
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_list_workflows_returns_total_and_limit() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            user = _register(client)
            seed_ids = _seed_runs(
                factory, ["completed", "failed", "queued"], user["id"]
            )
            all_runs = client.get("/workflow")
            limited = client.get("/workflow", params={"limit": 2})
            filtered = client.get("/workflow", params={"status": "failed"})

        assert all_runs.status_code == 200
        body = all_runs.json()
        assert body["total"] == 3
        assert {item["run_id"] for item in body["items"]} == set(seed_ids)

        assert limited.status_code == 200
        assert len(limited.json()["items"]) == 2
        assert limited.json()["total"] == 3

        assert filtered.status_code == 200
        assert filtered.json()["total"] == 1
        assert filtered.json()["items"][0]["status"] == "failed"
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_get_workflow_includes_timestamps_and_user_data(monkeypatch) -> None:
    async def fake_enqueue(run_id: str) -> None:
        return None

    monkeypatch.setattr(api, "enqueue_workflow", fake_enqueue)

    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client)
            created = client.post(
                "/workflow",
                json={"request": "План на неделю", "user_data": _full_data()},
            )
            body = client.get(f"/workflow/{created.json()['run_id']}").json()

        assert body["user_data"] == _full_data()
        assert body["created_at"]
        assert body["started_at"] is None
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_cors_preflight_allows_dev_origin() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            response = client.options(
                "/workflow",
                headers={
                    "Origin": "http://localhost:5173",
                    "Access-Control-Request-Method": "POST",
                },
            )
        assert response.status_code == 200
        assert (
            response.headers["access-control-allow-origin"]
            == "http://localhost:5173"
        )
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_workflow_requires_auth() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            created = client.post(
                "/workflow",
                json={"request": "План", "user_data": _full_data()},
            )
            listed = client.get("/workflow")
            opened = client.get("/workflow/anything")

        assert created.status_code == 401
        assert listed.status_code == 401
        assert opened.status_code == 401
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_history_isolated_between_users(monkeypatch) -> None:
    async def fake_enqueue(run_id: str) -> None:
        return None

    monkeypatch.setattr(api, "enqueue_workflow", fake_enqueue)

    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client, "first@example.com")
            created = client.post(
                "/workflow",
                json={"request": "План первого", "user_data": _full_data()},
            )
            run_id = created.json()["run_id"]

            second = TestClient(client.app)
            with second:
                _register(second, "second@example.com")
                listed = second.get("/workflow")
                opened = second.get(f"/workflow/{run_id}")

            assert listed.status_code == 200
            assert listed.json()["total"] == 0
            assert opened.status_code == 404
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_legacy_run_without_owner_is_hidden() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client)

            async def seed() -> str:
                async with factory() as session:
                    run = await workflow_repository.create_run(
                        session,
                        request="Старый запуск",
                        user_data={},
                        status="completed",
                    )
                    return run.id

            run_id = asyncio.run(seed())

            assert client.get("/workflow").json()["total"] == 0
            assert client.get(f"/workflow/{run_id}").status_code == 404
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)
