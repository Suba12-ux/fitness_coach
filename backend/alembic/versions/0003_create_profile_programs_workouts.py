"""create profile, programs, planned and actual workouts

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("goal", sa.String(length=255), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("height_cm", sa.Float(), nullable=True),
        sa.Column("experience_level", sa.String(length=16), nullable=True),
        sa.Column("days_per_week", sa.Integer(), nullable=True),
        sa.Column("minutes_per_session", sa.Integer(), nullable=True),
        sa.Column("limitations", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_profiles_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_user_profiles_user_id", "user_profiles", ["user_id"], unique=True
    )

    op.create_table(
        "training_programs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("goal", sa.String(length=255), nullable=True),
        sa.Column("assumptions", sa.JSON(), nullable=False),
        sa.Column("limitations", sa.JSON(), nullable=False),
        sa.Column("source_run_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_training_programs_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_run_id"],
            ["workflow_runs.id"],
            name="fk_training_programs_source_run_id_workflow_runs",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_training_programs_user_id", "training_programs", ["user_id"]
    )
    op.create_index(
        "ix_training_programs_status", "training_programs", ["status"]
    )
    op.create_index(
        "ix_training_programs_source_run_id",
        "training_programs",
        ["source_run_id"],
    )
    op.create_index(
        "uq_training_programs_active",
        "training_programs",
        ["user_id"],
        unique=True,
        sqlite_where=sa.text("status = 'active'"),
        postgresql_where=sa.text("status = 'active'"),
    )
    op.create_index(
        "uq_training_programs_source_run",
        "training_programs",
        ["user_id", "source_run_id"],
        unique=True,
        sqlite_where=sa.text("source_run_id IS NOT NULL"),
        postgresql_where=sa.text("source_run_id IS NOT NULL"),
    )

    op.create_table(
        "planned_workouts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("program_id", sa.String(length=36), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("day", sa.String(length=64), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("duration_min", sa.Integer(), nullable=True),
        sa.Column("scheduled_date", sa.Date(), nullable=True),
        sa.Column("exercises", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["program_id"],
            ["training_programs.id"],
            name="fk_planned_workouts_program_id_training_programs",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "program_id",
            "position",
            name="uq_planned_workouts_program_position",
        ),
    )
    op.create_index(
        "ix_planned_workouts_program_id", "planned_workouts", ["program_id"]
    )

    op.create_table(
        "workout_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("program_id", sa.String(length=36), nullable=True),
        sa.Column("planned_workout_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("perceived_exertion", sa.Integer(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_workout_sessions_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["program_id"],
            ["training_programs.id"],
            name="fk_workout_sessions_program_id_training_programs",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["planned_workout_id"],
            ["planned_workouts.id"],
            name="fk_workout_sessions_planned_workout_id_planned_workouts",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_workout_sessions_user_id", "workout_sessions", ["user_id"]
    )
    op.create_index(
        "ix_workout_sessions_program_id", "workout_sessions", ["program_id"]
    )
    op.create_index(
        "ix_workout_sessions_planned_workout_id",
        "workout_sessions",
        ["planned_workout_id"],
    )
    op.create_index(
        "ix_workout_sessions_status", "workout_sessions", ["status"]
    )
    op.create_index(
        "ix_workout_sessions_user_started",
        "workout_sessions",
        ["user_id", "started_at"],
    )
    op.create_index(
        "uq_workout_sessions_open_planned",
        "workout_sessions",
        ["user_id", "planned_workout_id"],
        unique=True,
        sqlite_where=sa.text(
            "status = 'in_progress' AND planned_workout_id IS NOT NULL"
        ),
        postgresql_where=sa.text(
            "status = 'in_progress' AND planned_workout_id IS NOT NULL"
        ),
    )

    op.create_table(
        "exercise_results",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workout_session_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("planned", sa.JSON(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["workout_session_id"],
            ["workout_sessions.id"],
            name="fk_exercise_results_workout_session_id_workout_sessions",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workout_session_id",
            "position",
            name="uq_exercise_results_session_position",
        ),
    )
    op.create_index(
        "ix_exercise_results_workout_session_id",
        "exercise_results",
        ["workout_session_id"],
    )

    op.create_table(
        "workout_sets",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("exercise_result_id", sa.String(length=36), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("duration_sec", sa.Integer(), nullable=True),
        sa.Column("distance_m", sa.Float(), nullable=True),
        sa.Column(
            "skipped",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.ForeignKeyConstraint(
            ["exercise_result_id"],
            ["exercise_results.id"],
            name="fk_workout_sets_exercise_result_id_exercise_results",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "exercise_result_id",
            "position",
            name="uq_workout_sets_exercise_position",
        ),
    )
    op.create_index(
        "ix_workout_sets_exercise_result_id",
        "workout_sets",
        ["exercise_result_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_workout_sets_exercise_result_id", table_name="workout_sets"
    )
    op.drop_table("workout_sets")

    op.drop_index(
        "ix_exercise_results_workout_session_id",
        table_name="exercise_results",
    )
    op.drop_table("exercise_results")

    op.drop_index(
        "uq_workout_sessions_open_planned", table_name="workout_sessions"
    )
    op.drop_index(
        "ix_workout_sessions_user_started", table_name="workout_sessions"
    )
    op.drop_index(
        "ix_workout_sessions_status", table_name="workout_sessions"
    )
    op.drop_index(
        "ix_workout_sessions_planned_workout_id",
        table_name="workout_sessions",
    )
    op.drop_index(
        "ix_workout_sessions_program_id", table_name="workout_sessions"
    )
    op.drop_index(
        "ix_workout_sessions_user_id", table_name="workout_sessions"
    )
    op.drop_table("workout_sessions")

    op.drop_index(
        "ix_planned_workouts_program_id", table_name="planned_workouts"
    )
    op.drop_table("planned_workouts")

    op.drop_index(
        "uq_training_programs_source_run", table_name="training_programs"
    )
    op.drop_index(
        "uq_training_programs_active", table_name="training_programs"
    )
    op.drop_index(
        "ix_training_programs_source_run_id", table_name="training_programs"
    )
    op.drop_index(
        "ix_training_programs_status", table_name="training_programs"
    )
    op.drop_index(
        "ix_training_programs_user_id", table_name="training_programs"
    )
    op.drop_table("training_programs")

    op.drop_index("ix_user_profiles_user_id", table_name="user_profiles")
    op.drop_table("user_profiles")
