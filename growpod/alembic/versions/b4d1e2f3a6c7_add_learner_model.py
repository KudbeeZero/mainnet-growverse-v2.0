"""add learner_profiles + learner_events (NON-ECONOMIC centralized learner model)

Revision ID: b4d1e2f3a6c7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-25 00:00:00.000000

Additive: two new tables for the Phase-6a centralized learner model.
``learner_profiles`` is the per-player authoritative learning-state snapshot
(mastery / misconceptions / risk / prefs); ``learner_events`` is its append-only
audit log. NONE of this is currency — it never touches wallets or the ledger.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b4d1e2f3a6c7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "learner_profiles",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("player_id", sa.String(length=32), nullable=False),
        sa.Column("mastery_by_skill", sa.JSON(), nullable=False),
        sa.Column("misconceptions", sa.JSON(), nullable=False),
        sa.Column("preferred_format", sa.String(length=32), nullable=True),
        sa.Column("goals", sa.String(length=512), nullable=True),
        sa.Column(
            "experience_level",
            sa.String(length=32),
            nullable=False,
            server_default="beginner",
        ),
        sa.Column(
            "risk_level", sa.String(length=32), nullable=False, server_default="none"
        ),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["player_id"],
            ["players.id"],
            name=op.f("fk_learner_profiles_player_id_players"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_learner_profiles")),
        sa.UniqueConstraint(
            "player_id", name=op.f("uq_learner_profiles_player_id")
        ),
    )
    op.create_table(
        "learner_events",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("player_id", sa.String(length=32), nullable=False),
        sa.Column("at", sa.DateTime(), nullable=False),
        sa.Column("agent", sa.String(length=48), nullable=False),
        sa.Column("kind", sa.String(length=48), nullable=False),
        sa.Column("detail", sa.JSON(), nullable=False),
        sa.Column("reason", sa.String(length=512), nullable=False),
        sa.ForeignKeyConstraint(
            ["player_id"],
            ["players.id"],
            name=op.f("fk_learner_events_player_id_players"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_learner_events")),
    )
    op.create_index(
        op.f("ix_learner_events_player_id"),
        "learner_events",
        ["player_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_learner_events_player_id"), table_name="learner_events")
    op.drop_table("learner_events")
    op.drop_table("learner_profiles")
