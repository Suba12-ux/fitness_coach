"""Абстракция LLM-провайдера."""

from typing import Any, Dict, List, Optional, Protocol, Type

from pydantic import BaseModel

Message = Dict[str, str]


class LLMError(Exception):
    """Ошибка работы LLM-провайдера или невалидный ответ."""


class LLMProvider(Protocol):
    """Провайдер генерирует структурированный ответ по сообщениям."""

    async def generate(
        self,
        messages: List[Message],
        response_schema: Optional[Type[BaseModel]] = None,
    ) -> Any:
        """Вернуть данные (dict), валидные по response_schema, либо LLMError."""
        ...
