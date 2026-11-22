"""DeepSeek-провайдер через OpenAI-совместимый API.

Использует асинхронные HTTP-запросы (httpx) без внешнего SDK. Обрабатывает
сетевые ошибки, HTTP-ошибки и невалидный JSON. Модель и base URL задаются
конфигурацией.
"""

import asyncio
import json
from typing import Any, Dict, List, Optional, Type

import httpx
from pydantic import BaseModel

from app.llm.base import LLMError, Message

_RETRYABLE_STATUSES = {429, 500, 502, 503, 504}


class DeepSeekProvider:
    """Вызывает DeepSeek chat/completions и валидирует ответ по схеме."""

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str = "https://api.deepseek.com",
        timeout: float = 30.0,
        max_retries: int = 3,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._max_retries = max(1, max_retries)
        self._client = client

    async def generate(
        self,
        messages: List[Message],
        response_schema: Optional[Type[BaseModel]] = None,
    ) -> Any:
        payload = {
            "model": self._model,
            "messages": messages,
            "temperature": 0,
            "stream": False,
        }
        if response_schema is not None:
            payload["response_format"] = {"type": "json_object"}

        last_error: Optional[Exception] = None
        for attempt in range(self._max_retries):
            try:
                response = await self._request(payload)
                status = response.status_code
                if status in _RETRYABLE_STATUSES:
                    last_error = LLMError(
                        f"DeepSeek вернул статус {status}: {response.text[:200]}"
                    )
                    if attempt < self._max_retries - 1:
                        await asyncio.sleep(self._backoff(attempt))
                        continue
                    raise last_error
                if status != 200:
                    raise LLMError(
                        f"DeepSeek вернул статус {status}: {response.text[:200]}"
                    )

                data = self._parse_content(response.json())
                if response_schema is not None:
                    data = response_schema.model_validate(data).model_dump()
                return data
            except httpx.HTTPError as exc:
                last_error = exc
                if attempt < self._max_retries - 1:
                    await asyncio.sleep(self._backoff(attempt))
                    continue
                break

        raise LLMError(f"DeepSeek недоступен: {last_error}")

    async def _request(self, payload: Dict[str, Any]) -> httpx.Response:
        if self._client is not None:
            return await self._client.post(
                f"{self._base_url}/chat/completions",
                json=payload,
                headers=self._headers(),
            )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            return await client.post(
                f"{self._base_url}/chat/completions",
                json=payload,
                headers=self._headers(),
            )

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _parse_content(data: Dict[str, Any]) -> Any:
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError(f"Неожиданный формат ответа DeepSeek: {exc}") from exc
        return DeepSeekProvider._loads_json(content)

    @staticmethod
    def _loads_json(content: str) -> Any:
        text = content.strip()
        if text.startswith("```"):
            # Снять markdown-ограждение, если модель его добавила.
            lines = text.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise LLMError(f"DeepSeek вернул не-JSON: {exc}") from exc

    @staticmethod
    def _backoff(attempt: int) -> float:
        return min(2.0 ** attempt, 8.0)
