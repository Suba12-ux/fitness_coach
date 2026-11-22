"""Проверки API постоянного профиля."""

from tests.helpers import register_user


def _profile_payload() -> dict:
    return {
        "goal": "набор силы",
        "age": 30,
        "weight_kg": 75.5,
        "height_cm": 178,
        "experience_level": "beginner",
        "days_per_week": 3,
        "minutes_per_session": 45,
        "limitations": ["колено"],
    }


def test_profile_requires_auth(api_env) -> None:
    client, _ = api_env

    assert client.get("/profile").status_code == 401
    assert client.put("/profile", json=_profile_payload()).status_code == 401
    assert client.patch("/profile", json={"goal": "сила"}).status_code == 401


def test_get_missing_profile_returns_404(api_env) -> None:
    client, _ = api_env
    register_user(client)

    response = client.get("/profile")

    assert response.status_code == 404


def test_put_creates_profile(api_env) -> None:
    client, _ = api_env
    register_user(client)

    created = client.put("/profile", json=_profile_payload())
    loaded = client.get("/profile")

    assert created.status_code == 200
    assert loaded.status_code == 200
    body = loaded.json()
    assert body["goal"] == "набор силы"
    assert body["experience_level"] == "beginner"
    assert body["limitations"] == ["колено"]
    assert body["created_at"]
    assert body["updated_at"]


def test_put_replaces_all_fields(api_env) -> None:
    client, _ = api_env
    register_user(client)
    client.put("/profile", json=_profile_payload())

    replaced = client.put("/profile", json={"goal": "выносливость"})

    assert replaced.status_code == 200
    body = replaced.json()
    assert body["goal"] == "выносливость"
    assert body["age"] is None
    assert body["limitations"] == []


def test_patch_updates_only_given_fields(api_env) -> None:
    client, _ = api_env
    register_user(client)
    client.put("/profile", json=_profile_payload())

    patched = client.patch("/profile", json={"days_per_week": 4})

    assert patched.status_code == 200
    body = patched.json()
    assert body["days_per_week"] == 4
    assert body["goal"] == "набор силы"
    assert body["age"] == 30


def test_patch_missing_profile_returns_404(api_env) -> None:
    client, _ = api_env
    register_user(client)

    assert client.patch("/profile", json={"goal": "сила"}).status_code == 404


def test_profile_validation_rejects_bad_values(api_env) -> None:
    client, _ = api_env
    register_user(client)

    too_young = client.put("/profile", json={"age": 5})
    too_many_days = client.put("/profile", json={"days_per_week": 9})
    unknown = client.put("/profile", json={"favorite_color": "red"})
    long_limitation = client.put(
        "/profile", json={"limitations": ["x" * 201]}
    )

    assert too_young.status_code == 422
    assert too_many_days.status_code == 422
    assert unknown.status_code == 422
    assert long_limitation.status_code == 422


def test_profile_limitations_are_trimmed_and_deduplicated(api_env) -> None:
    client, _ = api_env
    register_user(client)

    response = client.put(
        "/profile",
        json={"limitations": [" колено ", "колено", "", "спина"]},
    )

    assert response.status_code == 200
    assert response.json()["limitations"] == ["колено", "спина"]


def test_profiles_isolated_between_users(api_env) -> None:
    client, _ = api_env
    register_user(client, "first@example.com")
    client.put("/profile", json={"goal": "сила первого"})

    from fastapi.testclient import TestClient

    second = TestClient(client.app)
    with second:
        register_user(second, "second@example.com")
        assert second.get("/profile").status_code == 404

        second.put("/profile", json={"goal": "цель второго"})
        assert second.get("/profile").json()["goal"] == "цель второго"

    assert client.get("/profile").json()["goal"] == "сила первого"
