"""Проверка Alembic-миграций на чистой базе."""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]

NEW_TABLES = {
    "user_profiles",
    "training_programs",
    "planned_workouts",
    "workout_sessions",
    "exercise_results",
    "workout_sets",
}


def _run_alembic(db_path: Path, *args: str) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    env["APP_ENV"] = "test"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=str(BACKEND_ROOT),
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def _tables(db_path: Path) -> set[str]:
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    return {row[0] for row in rows}


def test_migration_upgrade_and_downgrade(tmp_path: Path) -> None:
    db_path = tmp_path / "migrations.db"

    _run_alembic(db_path, "upgrade", "head")
    tables = _tables(db_path)
    assert {"users", "user_sessions", "workflow_runs"} <= tables
    assert NEW_TABLES <= tables

    _run_alembic(db_path, "downgrade", "base")
    remaining = _tables(db_path)
    assert not (NEW_TABLES & remaining)
    assert "users" not in remaining
