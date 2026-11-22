"""Проверки LLM-провайдеров: Mock и DeepSeek (с подменённым HTTP)."""

import asyncio
import json

import httpx
import pytest

from app.llm.base import LLMError
from app.llm.deepseek import DeepSeekProvider
from app.llm.mock import MockLLMProvider
from app.schemas.llm import TaskPlan
from app.schemas.tasks import TaskType


def _valid_plan() -> dict:
    return {
        "goal": "снижение веса",
        "tasks": [
            {"id": "profile", "type": "profile", "depends_on": []},
            {"id": "training", "type": "training", "depends_on": ["profile"]},
            {"id": "safety", "type": "safety", "depends_on": ["profile"]},
        ],
    }


def _messages() -> list:
    return [
        {"role": "system", "content": "plan"},
        {
            "role": "user",
            "content": json.dumps(
                {"request": "Хочу похудеть", "user_data": {"goal": "снижение веса"}}
            ),
        },
    ]


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _ok_handler(plan: dict = _valid_plan()):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(plan)}}]},
        )

    return handler


# ---------------------------------------------------------------- Mock


def test_mock_returns_task_plan() -> None:
    provider = MockLLMProvider()
    data = asyncio.run(provider.generate(_messages(), response_schema=TaskPlan))

    plan = TaskPlan.model_validate(data)
    assert plan.goal == "снижение веса"
    assert [spec.type for spec in plan.tasks] == [
        TaskType.PROFILE,
        TaskType.TRAINING,
        TaskType.SAFETY,
    ]
    assert plan.tasks[1].depends_on == ["profile"]


def test_mock_rejects_unsupported_schema() -> None:
    provider = MockLLMProvider()
    with pytest.raises(LLMError):
        asyncio.run(provider.generate(_messages(), response_schema=dict))


# ---------------------------------------------------------------- DeepSeek


def test_deepseek_returns_parsed_plan() -> None:
    provider = DeepSeekProvider(
        api_key="test-key",
        model="deepseek-chat",
        client=_client(_ok_handler()),
    )
    data = asyncio.run(provider.generate(_messages(), response_schema=TaskPlan))

    assert TaskPlan.model_validate(data).goal == "снижение веса"


def test_deepseek_raises_on_bad_json() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "not-json"}}]},
        )

    provider = DeepSeekProvider(
        api_key="test-key",
        model="deepseek-chat",
        client=_client(handler),
    )
    with pytest.raises(LLMError):
        asyncio.run(provider.generate(_messages()))


def test_deepseek_raises_on_non_200() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "unauthorized"})

    provider = DeepSeekProvider(
        api_key="test-key",
        model="deepseek-chat",
        client=_client(handler),
    )
    with pytest.raises(LLMError):
        asyncio.run(provider.generate(_messages()))


def test_deepseek_retries_then_succeeds(monkeypatch) -> None:
    async def _no_sleep(_: float) -> None:
        return None

    monkeypatch.setattr(asyncio, "sleep", _no_sleep)

    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if calls["count"] == 1:
            return httpx.Response(503, json={"error": "unavailable"})
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(_valid_plan())}}]},
        )

    provider = DeepSeekProvider(
        api_key="test-key",
        model="deepseek-chat",
        max_retries=3,
        client=_client(handler),
    )
    data = asyncio.run(provider.generate(_messages(), response_schema=TaskPlan))

    assert TaskPlan.model_validate(data).goal == "снижение веса"
    assert calls["count"] == 2


def test_deepseek_gives_up_after_retries(monkeypatch) -> None:
    async def _no_sleep(_: float) -> None:
        return None

    monkeypatch.setattr(asyncio, "sleep", _no_sleep)

    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        return httpx.Response(500, json={"error": "boom"})

    provider = DeepSeekProvider(
        api_key="test-key",
        model="deepseek-chat",
        max_retries=3,
        client=_client(handler),
    )
    with pytest.raises(LLMError):
        asyncio.run(provider.generate(_messages()))

    assert calls["count"] == 3
