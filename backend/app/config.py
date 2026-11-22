"""Настройки приложения из переменных окружения."""

import os
from dataclasses import dataclass


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    """Конфигурация, переопределяемая через переменные окружения."""

    # Приложение
    app_env: str = os.getenv("APP_ENV", "development")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    # База данных (PostgreSQL по умолчанию в бою; SQLite — удобный локальный фолбэк)
    database_url: str = os.getenv(
        "DATABASE_URL", "sqlite+aiosqlite:///./sensei.db"
    )

    # Redis / очередь
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Домены, которым разрешены запросы к API из браузера
    cors_origins: str = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    )

    # Аутентификация и сессии
    auth_cookie_name: str = os.getenv("AUTH_COOKIE_NAME", "sensei_session")
    auth_cookie_secure: bool = _env_bool("AUTH_COOKIE_SECURE", False)
    auth_session_ttl_days: int = max(1, _env_int("AUTH_SESSION_TTL_DAYS", 7))
    auth_login_rate_limit: int = _env_int("AUTH_LOGIN_RATE_LIMIT", 10)
    auth_login_rate_window_seconds: int = _env_int(
        "AUTH_LOGIN_RATE_WINDOW_SECONDS", 900
    )

    @property
    def auth_cookie_secure_effective(self) -> bool:
        """Secure-cookie обязателен в production и включается флагом локально."""
        return self.auth_cookie_secure or self.app_env == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    # LLM
    llm_provider: str = os.getenv("LLM_PROVIDER", "mock")
    deepseek_api_key: str | None = os.getenv("DEEPSEEK_API_KEY") or None
    deepseek_model: str | None = os.getenv("DEEPSEEK_MODEL") or None
    deepseek_base_url: str = os.getenv(
        "DEEPSEEK_BASE_URL", "https://api.deepseek.com"
    )
    llm_timeout_seconds: float = _env_float("LLM_TIMEOUT_SECONDS", 30.0)
    llm_max_retries: int = _env_int("LLM_MAX_RETRIES", 3)

    # Выполнение агентов
    max_retries: int = _env_int("SENSEI_MAX_RETRIES", 3)
    agent_timeout_seconds: float = _env_float("SENSEI_AGENT_TIMEOUT_SECONDS", 10.0)

    # Worker
    worker_job_timeout_seconds: int = _env_int("WORKER_JOB_TIMEOUT_SECONDS", 300)
    worker_max_tries: int = _env_int("WORKER_MAX_TRIES", 3)


settings = Settings()
