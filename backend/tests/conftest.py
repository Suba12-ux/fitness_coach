"""Общие фикстуры для API-тестов."""

import asyncio
import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api import create_app


@pytest.fixture()
def api_env():
    """Тестовый клиент на временной SQLite и фабрика сессий."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_async_engine(f"sqlite+aiosqlite:///{path}")
    factory = async_sessionmaker(engine, expire_on_commit=False)
    app = create_app(session_factory=factory, engine=engine)
    client = TestClient(app)
    try:
        with client:
            yield client, factory
    finally:
        asyncio.run(engine.dispose())
        if os.path.exists(path):
            os.remove(path)
