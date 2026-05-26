"""Add phone and avatar_url to users

Revision ID: f3d8a9b0c1e2
Revises: f2c7d8e9a0b1
Create Date: 2026-05-25 12:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "f3d8a9b0c1e2"
down_revision: str | Sequence[str] | None = "f2c7d8e9a0b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("phone", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("avatar_url", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "phone")
