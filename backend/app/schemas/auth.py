"""Схемы регистрации, входа и управления сессиями."""

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_EMAIL_MAX_LENGTH = 320


def normalize_email(value: str) -> str:
    """Привести email к нижнему регистру и проверить формат."""
    email = value.strip().lower()
    if len(email) > _EMAIL_MAX_LENGTH or not _EMAIL_RE.fullmatch(email):
        raise ValueError("Введите корректный email.")
    return email


def validate_new_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Пароль должен содержать не менее 8 символов.")
    if len(value) > 128:
        raise ValueError("Пароль должен содержать не более 128 символов.")
    if not value.strip():
        raise ValueError("Пароль не может состоять только из пробелов.")
    return value


class RegisterRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = False

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        return validate_new_password(value)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=256)
    remember_me: bool = False

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return normalize_email(value)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        return validate_new_password(value)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    created_at: Optional[datetime] = None


class SessionResponse(BaseModel):
    id: str
    user_agent: Optional[str] = None
    created_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_current: bool = False
