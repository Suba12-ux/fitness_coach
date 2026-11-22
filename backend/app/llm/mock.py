"""Детерминированный LLM-провайдер без внешних вызовов."""

import json
from typing import Any, Dict, List, Optional, Type

from pydantic import BaseModel

from app.llm.base import LLMError, Message
from app.schemas.llm import TaskPlan, TaskSpec
from app.schemas.tasks import TaskType

_GOAL_MAP = (
    ("похуд", "снижение веса"),
    ("вес", "снижение веса"),
    ("марафон", "подготовка к марафону"),
    ("триатлон", "подготовка к триатлону"),
    ("сила", "развитие силы"),
    ("выносливость", "развитие выносливости"),
    ("рекорд", "развитие силы"),
    ("соревнов", "подготовка к соревнованиям"),
)


class MockLLMProvider:
    """Возвращает план по правилам: не выдумывает данные, только структуру."""

    async def generate(
        self,
        messages: List[Message],
        response_schema: Optional[Type[BaseModel]] = None,
    ) -> Any:
        request, user_data = self._parse_payload(messages)

        if response_schema is TaskPlan:
            return TaskPlan(
                goal=self._extract_goal(request, user_data),
                tasks=[
                    TaskSpec(id="profile", type=TaskType.PROFILE),
                    TaskSpec(
                        id="training",
                        type=TaskType.TRAINING,
                        depends_on=["profile"],
                    ),
                    TaskSpec(
                        id="safety",
                        type=TaskType.SAFETY,
                        depends_on=["profile"],
                    ),
                ],
            ).model_dump()

        raise LLMError("MockLLMProvider поддерживает только schema=TaskPlan.")

    @staticmethod
    def _parse_payload(messages: List[Message]) -> tuple[str, Dict[str, Any]]:
        user_text = ""
        for message in reversed(messages):
            if message.get("role") == "user":
                user_text = message.get("content", "")
                break

        try:
            payload = json.loads(user_text)
            if isinstance(payload, dict):
                return (
                    str(payload.get("request", "")),
                    dict(payload.get("user_data") or {}),
                )
        except (json.JSONDecodeError, TypeError):
            pass

        return user_text, {}

    @staticmethod
    def _extract_goal(request: str, user_data: Dict[str, Any]) -> str:
        goal = (user_data or {}).get("goal")
        if isinstance(goal, str) and goal.strip():
            return goal.strip()

        lowered = (request or "").lower()
        for hint, mapped in _GOAL_MAP:
            if hint in lowered:
                return mapped

        return ""
