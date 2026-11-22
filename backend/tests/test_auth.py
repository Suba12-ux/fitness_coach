"""Проверки регистрации, входа и управления сессиями."""

import asyncio
import os
import tempfile
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api import create_app
from app.db.repositories import auth_repository
from app.security.passwords import hash_password, verify_password
from app.security.tokens import hash_session_token

DEFAULT_PASSWORD = "password123"


def _make_client():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_async_engine(f"sqlite+aiosqlite:///{path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)
    app = create_app(session_factory=factory, engine=engine)
    return TestClient(app), engine, factory, path


def _register(
    client: TestClient,
    email: str = "user@example.com",
    password: str = DEFAULT_PASSWORD,
    remember_me: bool = False,
):
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "remember_me": remember_me,
        },
    )


def _login(
    client: TestClient,
    email: str = "user@example.com",
    password: str = DEFAULT_PASSWORD,
    remember_me: bool = False,
):
    return client.post(
        "/auth/login",
        json={
            "email": email,
            "password": password,
            "remember_me": remember_me,
        },
    )


def test_password_hash_roundtrip() -> None:
    encoded = hash_password(DEFAULT_PASSWORD)

    assert encoded.startswith("scrypt$")
    assert verify_password(DEFAULT_PASSWORD, encoded)
    assert not verify_password("wrong-password", encoded)
    assert not verify_password(DEFAULT_PASSWORD, "broken")


def test_register_sets_httponly_cookie_and_me() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            response = _register(client)
            me = client.get("/auth/me")

        assert response.status_code == 201
        body = response.json()
        assert body["email"] == "user@example.com"
        assert "password_hash" not in body

        cookie = response.headers["set-cookie"].lower()
        assert "httponly" in cookie
        assert "samesite=lax" in cookie
        assert "max-age" not in cookie

        assert me.status_code == 200
        assert me.json()["email"] == "user@example.com"
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_register_normalizes_email_and_conflicts() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            first = _register(client, "  User@Example.COM ")
            duplicate = _register(client, "user@example.com")

        assert first.status_code == 201
        assert first.json()["email"] == "user@example.com"
        assert duplicate.status_code == 409
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_register_validates_email_and_password() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            bad_email = _register(client, "not-an-email")
            short_password = _register(client, "short@example.com", "short")

        assert bad_email.status_code == 422
        assert short_password.status_code == 422
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_login_and_remember_me_cookie() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client)
            client.post("/auth/logout")

            remembered = _login(client, remember_me=True)
            wrong = _login(client, password="wrong-password")

        assert remembered.status_code == 200
        assert "max-age=" in remembered.headers["set-cookie"].lower()
        assert wrong.status_code == 401
        assert wrong.json()["detail"] == "Неверный email или пароль."
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_me_requires_session() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            response = client.get("/auth/me")
        assert response.status_code == 401
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_logout_revokes_current_session() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client)
            logout = client.post("/auth/logout")
            me = client.get("/auth/me")

        assert logout.status_code == 204
        assert "sensei_session=" in logout.headers["set-cookie"]
        assert me.status_code == 401
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_session_list_and_revoke_other_device() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client)

            second = TestClient(client.app)
            with second:
                assert _login(second).status_code == 200

                sessions = client.get("/auth/sessions")
                assert sessions.status_code == 200
                records = sessions.json()
                assert len(records) == 2
                assert sum(1 for item in records if item["is_current"]) == 1

                other = next(
                    item for item in records if not item["is_current"]
                )
                revoked = client.delete(f"/auth/sessions/{other['id']}")
                assert revoked.status_code == 204
                assert second.get("/auth/me").status_code == 401
                assert client.get("/auth/me").status_code == 200

            assert (
                client.delete("/auth/sessions/does-not-exist").status_code == 404
            )
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_logout_all_revokes_every_session() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client)

            second = TestClient(client.app)
            with second:
                assert _login(second).status_code == 200

                logout_all = client.post("/auth/logout-all")

                assert logout_all.status_code == 204
                assert client.get("/auth/me").status_code == 401
                assert second.get("/auth/me").status_code == 401
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_change_password() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client)

            second = TestClient(client.app)
            with second:
                assert _login(second).status_code == 200

                wrong = client.post(
                    "/auth/password",
                    json={
                        "current_password": "wrong-password",
                        "new_password": "new-password-123",
                    },
                )
                same = client.post(
                    "/auth/password",
                    json={
                        "current_password": DEFAULT_PASSWORD,
                        "new_password": DEFAULT_PASSWORD,
                    },
                )
                changed = client.post(
                    "/auth/password",
                    json={
                        "current_password": DEFAULT_PASSWORD,
                        "new_password": "new-password-123",
                    },
                )

                assert wrong.status_code == 400
                assert same.status_code == 400
                assert changed.status_code == 204
                assert client.get("/auth/me").status_code == 200
                assert second.get("/auth/me").status_code == 401

            client.post("/auth/logout")
            old_login = _login(client)
            new_login = _login(client, password="new-password-123")

        assert old_login.status_code == 401
        assert new_login.status_code == 200
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_expired_session_is_rejected() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client)
            token = client.cookies.get("sensei_session")
            assert token

            async def expire() -> None:
                async with factory() as session:
                    record = await auth_repository.get_session_by_token_hash(
                        session, hash_session_token(token)
                    )
                    assert record is not None
                    record.expires_at = datetime.now(timezone.utc) - timedelta(
                        seconds=5
                    )
                    await session.commit()

            asyncio.run(expire())

            assert client.get("/auth/me").status_code == 401
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)


def test_login_rate_limit() -> None:
    client, engine, factory, path = _make_client()
    try:
        with client:
            _register(client, "limited@example.com")
            client.post("/auth/logout")

            statuses = [
                _login(
                    client, "limited@example.com", "wrong-password"
                ).status_code
                for _ in range(10)
            ]
            blocked = _login(client, "limited@example.com", "wrong-password")

        assert statuses == [401] * 10
        assert blocked.status_code == 429
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)
