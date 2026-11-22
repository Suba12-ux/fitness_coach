"""create users, sessions and link workflow runs

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("persistent", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_user_sessions_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index(
        "ix_user_sessions_token_hash",
        "user_sessions",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_user_sessions_expires_at", "user_sessions", ["expires_at"]
    )

    with op.batch_alter_table("workflow_runs") as batch:
        batch.add_column(sa.Column("user_id", sa.String(length=36), nullable=True))
        batch.create_foreign_key(
            "fk_workflow_runs_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_index("ix_workflow_runs_user_id", ["user_id"])


def downgrade() -> None:
    with op.batch_alter_table("workflow_runs") as batch:
        batch.drop_index("ix_workflow_runs_user_id")
        batch.drop_constraint(
            "fk_workflow_runs_user_id_users", type_="foreignkey"
        )
        batch.drop_column("user_id")

    op.drop_index("ix_user_sessions_expires_at", table_name="user_sessions")
    op.drop_index("ix_user_sessions_token_hash", table_name="user_sessions")
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_sessions")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
