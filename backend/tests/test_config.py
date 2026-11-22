"""Проверки приоритета настроек Secure-cookie."""

import os
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _effective_secure(**overrides: str) -> str:
    env = os.environ.copy()
    env.pop("APP_ENV", None)
    env.pop("AUTH_COOKIE_SECURE", None)
    env.update(overrides)
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from app.config import settings; "
            "print(settings.auth_cookie_secure_effective)",
        ],
        cwd=str(BACKEND_ROOT),
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def test_secure_cookie_defaults_to_true_in_production() -> None:
    assert _effective_secure(APP_ENV="production") == "True"


def test_secure_cookie_can_be_disabled_explicitly() -> None:
    assert _effective_secure(APP_ENV="production", AUTH_COOKIE_SECURE="false") == "False"


def test_secure_cookie_is_off_by_default_in_development() -> None:
    assert _effective_secure(APP_ENV="development") == "False"
