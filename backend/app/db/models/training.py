"""Модели профиля, программ, плановых и фактических тренировок."""

import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class UserProfile(Base):
    """Постоянный профиль пользователя (один на аккаунт)."""

    __tablename__ = "user_profiles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    goal: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    height_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    experience_level: Mapped[Optional[str]] = mapped_column(
        String(16), nullable=True
    )
    days_per_week: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    minutes_per_session: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    limitations: Mapped[List[str]] = mapped_column(
        JSON, nullable=False, default=list
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )


class TrainingProgram(Base):
    """Сохранённая тренировочная программа пользователя."""

    __tablename__ = "training_programs"
    __table_args__ = (
        # Не более одной активной программы на пользователя.
        Index(
            "uq_training_programs_active",
            "user_id",
            unique=True,
            sqlite_where=text("status = 'active'"),
            postgresql_where=text("status = 'active'"),
        ),
        # Один запуск сохраняется в программу не более одного раза.
        Index(
            "uq_training_programs_source_run",
            "user_id",
            "source_run_id",
            unique=True,
            sqlite_where=text("source_run_id IS NOT NULL"),
            postgresql_where=text("source_run_id IS NOT NULL"),
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    goal: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    assumptions: Mapped[List[str]] = mapped_column(
        JSON, nullable=False, default=list
    )
    limitations: Mapped[List[str]] = mapped_column(
        JSON, nullable=False, default=list
    )
    source_run_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("workflow_runs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )


class PlannedWorkout(Base):
    """Запланированная тренировка внутри программы (план, не факт)."""

    __tablename__ = "planned_workouts"
    __table_args__ = (
        UniqueConstraint(
            "program_id",
            "position",
            name="uq_planned_workouts_program_position",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid
    )
    program_id: Mapped[str] = mapped_column(
        ForeignKey("training_programs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    day: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_min: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    scheduled_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True
    )
    exercises: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )


class WorkoutSession(Base):
    """Фактическая попытка выполнить тренировку."""

    __tablename__ = "workout_sessions"
    __table_args__ = (
        Index(
            "ix_workout_sessions_user_started", "user_id", "started_at"
        ),
        Index(
            "uq_workout_sessions_open_planned",
            "user_id",
            "planned_workout_id",
            unique=True,
            sqlite_where=text(
                "status = 'in_progress' AND planned_workout_id IS NOT NULL"
            ),
            postgresql_where=text(
                "status = 'in_progress' AND planned_workout_id IS NOT NULL"
            ),
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    program_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("training_programs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    planned_workout_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("planned_workouts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="in_progress", index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    perceived_exertion: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )


class ExerciseResult(Base):
    """Фактические показатели упражнения в рамках тренировки."""

    __tablename__ = "exercise_results"
    __table_args__ = (
        UniqueConstraint(
            "workout_session_id",
            "position",
            name="uq_exercise_results_session_position",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid
    )
    workout_session_id: Mapped[str] = mapped_column(
        ForeignKey("workout_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    planned: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class WorkoutSet(Base):
    """Один фактический подход упражнения."""

    __tablename__ = "workout_sets"
    __table_args__ = (
        UniqueConstraint(
            "exercise_result_id",
            "position",
            name="uq_workout_sets_exercise_position",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid
    )
    exercise_result_id: Mapped[str] = mapped_column(
        ForeignKey("exercise_results.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    duration_sec: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    distance_m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    skipped: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
