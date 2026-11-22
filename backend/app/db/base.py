"""Базовый декларативный класс моделей."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Общий базовый класс для всех моделей."""
