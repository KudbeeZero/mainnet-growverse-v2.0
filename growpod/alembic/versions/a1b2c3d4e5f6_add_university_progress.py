"""add university_progress (NON-ECONOMIC engagement loop: KXP/streak/freeze)

Revision ID: a1b2c3d4e5f6
Revises: f7e8d9c0b1a2
Create Date: 2026-06-25 00:00:00.000000

Additive: one new table holding the per-player learning-loop counters
(Knowledge-XP, study streak, freeze tokens). NONE of this is currency — it never
touches wallets or the ledger.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f7e8d9c0b1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "university_progress",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("player_id", sa.String(length=32), nullable=False),
        sa.Column("kxp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("streak_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_study_date", sa.Date(), nullable=True),
        sa.Column("freeze_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["player_id"],
            ["players.id"],
            name=op.f("fk_university_progress_player_id_players"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_university_progress")),
        sa.UniqueConstraint(
            "player_id", name=op.f("uq_university_progress_player_id")
        ),
    )


def downgrade() -> None:
    op.drop_table("university_progress")
