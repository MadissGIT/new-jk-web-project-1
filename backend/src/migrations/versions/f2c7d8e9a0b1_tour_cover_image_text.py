"""Allow embedded tour cover images

Revision ID: f2c7d8e9a0b1
Revises: b1c2d3e4f5a6
Create Date: 2026-05-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "f2c7d8e9a0b1"
down_revision: str | Sequence[str] | None = "b1c2d3e4f5a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE tourstatus ADD VALUE IF NOT EXISTS 'REJECTED'")
    op.alter_column(
        "tours",
        "cover_image_url",
        existing_type=sa.String(length=512),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.execute("UPDATE tours SET status = 'DRAFT' WHERE status = 'REJECTED'")
    op.alter_column(
        "tours",
        "cover_image_url",
        existing_type=sa.Text(),
        type_=sa.String(length=512),
        existing_nullable=True,
    )
