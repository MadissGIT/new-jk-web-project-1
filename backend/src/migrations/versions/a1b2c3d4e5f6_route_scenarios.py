"""Route quick scenarios

Revision ID: a1b2c3d4e5f6
Revises: f3d8a9b0c1e2
Create Date: 2026-05-25 13:00:00.000000
"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "f3d8a9b0c1e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DEFAULT_SCENARIOS = [
    {
        "id": "scn_default_coffee",
        "slug": "coffee-nearby",
        "title": "Кофе рядом",
        "description": "Короткая прогулка до ближайшей атмосферной кофейни.",
        "icon": "coffee",
        "interests": ["coffee"],
        "duration_minutes": 60,
        "pace": "slow",
        "budget_level": "low",
        "wheelchair_required": False,
        "avoid_stairs": False,
        "need_rest_points": False,
        "sort_order": 1,
    },
    {
        "id": "scn_default_art",
        "slug": "art-walk",
        "title": "Арт-прогулка",
        "description": "Маршрут по галереям, музеям и арт-кластерам.",
        "icon": "edit-2",
        "interests": ["art", "history"],
        "duration_minutes": 180,
        "pace": "medium",
        "budget_level": "medium",
        "wheelchair_required": False,
        "avoid_stairs": False,
        "need_rest_points": False,
        "sort_order": 2,
    },
    {
        "id": "scn_default_relax",
        "slug": "relax-walk",
        "title": "Спокойный маршрут",
        "description": "Зелёные дворы, парки и неспешные виды без лестниц.",
        "icon": "smile",
        "interests": ["relax", "nature"],
        "duration_minutes": 120,
        "pace": "slow",
        "budget_level": "low",
        "wheelchair_required": False,
        "avoid_stairs": True,
        "need_rest_points": True,
        "sort_order": 3,
    },
    {
        "id": "scn_default_history",
        "slug": "history-tour",
        "title": "История города",
        "description": "Главные исторические места и архитектура.",
        "icon": "book-open",
        "interests": ["history"],
        "duration_minutes": 180,
        "pace": "medium",
        "budget_level": "medium",
        "wheelchair_required": False,
        "avoid_stairs": False,
        "need_rest_points": False,
        "sort_order": 4,
    },
]


def upgrade() -> None:
    op.create_table(
        "route_scenarios",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("description", sa.String(length=512), nullable=True),
        sa.Column("icon", sa.String(length=64), nullable=False, server_default="map"),
        sa.Column("interests", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("pace", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("budget_level", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column(
            "wheelchair_required", sa.Boolean(), nullable=False, server_default=sa.text("false"),
        ),
        sa.Column("avoid_stairs", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "need_rest_points", sa.Boolean(), nullable=False, server_default=sa.text("false"),
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_route_scenarios_slug", "route_scenarios", ["slug"], unique=True)
    op.create_index("ix_route_scenarios_sort_order", "route_scenarios", ["sort_order"])
    op.create_index("ix_route_scenarios_is_active", "route_scenarios", ["is_active"])

    bind = op.get_bind()
    for scenario in DEFAULT_SCENARIOS:
        bind.execute(
            sa.text(
                """
                INSERT INTO route_scenarios
                    (id, slug, title, description, icon, interests, duration_minutes, pace,
                     budget_level, wheelchair_required, avoid_stairs, need_rest_points,
                     sort_order, is_active)
                VALUES
                    (:id, :slug, :title, :description, :icon, CAST(:interests AS json),
                     :duration_minutes, :pace, :budget_level, :wheelchair_required,
                     :avoid_stairs, :need_rest_points, :sort_order, true)
                ON CONFLICT (slug) DO NOTHING
                """,
            ),
            {**scenario, "interests": json.dumps(scenario["interests"])},
        )


def downgrade() -> None:
    op.drop_index("ix_route_scenarios_is_active", table_name="route_scenarios")
    op.drop_index("ix_route_scenarios_sort_order", table_name="route_scenarios")
    op.drop_index("ix_route_scenarios_slug", table_name="route_scenarios")
    op.drop_table("route_scenarios")
