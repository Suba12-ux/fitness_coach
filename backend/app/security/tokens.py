"""Генерация сессионных токенов и хеширование для хранения."""

import hashlib
import secrets

TOKEN_BYTES = 32


def new_session_token() -> str:
    """Случайный токен для HttpOnly cookie (256 бит энтропии)."""
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_session_token(token: str) -> str:
    """SHA-256 от токена — только это значение попадает в базу."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
