"""Фабрика LLM-провайдеров по настройкам."""

from app.config import settings
from app.llm.base import LLMError, LLMProvider
from app.llm.deepseek import DeepSeekProvider
from app.llm.mock import MockLLMProvider


def get_llm() -> LLMProvider:
    """Вернуть провайдер согласно LLM_PROVIDER."""
    provider = settings.llm_provider.lower()

    if provider == "mock":
        return MockLLMProvider()

    if provider == "deepseek":
        if not settings.deepseek_api_key:
            raise LLMError(
                "Для LLM_PROVIDER=deepseek необходимо задать DEEPSEEK_API_KEY."
            )
        if not settings.deepseek_model:
            raise LLMError(
                "Для LLM_PROVIDER=deepseek необходимо задать DEEPSEEK_MODEL."
            )
        return DeepSeekProvider(
            api_key=settings.deepseek_api_key,
            model=settings.deepseek_model,
            base_url=settings.deepseek_base_url,
            timeout=settings.llm_timeout_seconds,
            max_retries=settings.llm_max_retries,
        )

    raise LLMError(f"Неизвестный LLM-провайдер: {settings.llm_provider}")
