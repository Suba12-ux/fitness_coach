"""Установка и очистка cookie с сессией."""

from fastapi import Response

from app.config import settings


def set_session_cookie(response: Response, token: str, *, persistent: bool) -> None:
    """Поставить HttpOnly-cookie; без «Запомнить меня» — до закрытия браузера."""
    max_age = settings.auth_session_ttl_days * 24 * 60 * 60 if persistent else None
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=settings.auth_cookie_secure_effective,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
        httponly=True,
        secure=settings.auth_cookie_secure_effective,
        samesite="lax",
    )
