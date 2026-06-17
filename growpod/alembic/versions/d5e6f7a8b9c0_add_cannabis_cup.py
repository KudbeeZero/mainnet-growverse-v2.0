"""add seasonal cannabis cup tables and player title

Revision ID: d5e6f7a8b9c0
Revises: c7e2f4a16b80
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c7e2f4a16b80"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MONEY = sa.Numeric(18, 6)


def upgrade() -> None:
    with op.batch_alter_table("players", schema=None) as batch_op:
        batch_op.add_column(sa.Column("cannabis_cup_title", sa.String(length=96), nullable=True))

    op.create_table(
        "cannabis_cups",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("edition", sa.String(length=32), nullable=False),
        sa.Column("season", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=96), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("entry_fee", MONEY, nullable=False),
        sa.Column("prize_pool", MONEY, nullable=False),
        sa.Column("starts_at", sa.DateTime(), nullable=False),
        sa.Column("ends_at", sa.DateTime(), nullable=False),
        sa.Column("judged_at", sa.DateTime(), nullable=True),
        sa.Column("winner_id", sa.String(length=32), nullable=True),
        sa.Column("champion_strain_id", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["winner_id"], ["players.id"], name=op.f("fk_cannabis_cups_winner_id_players")),
        sa.ForeignKeyConstraint(["champion_strain_id"], ["strains.id"], name=op.f("fk_cannabis_cups_champion_strain_id_strains")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cannabis_cups")),
        sa.UniqueConstraint("edition", name=op.f("uq_cannabis_cups_edition")),
    )
    op.create_index("ix_cannabis_cups_status_ends_at", "cannabis_cups", ["status", "ends_at"], unique=False)

    op.create_table(
        "cup_entries",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("cup_id", sa.String(length=32), nullable=False),
        sa.Column("player_id", sa.String(length=32), nullable=False),
        sa.Column("harvest_id", sa.String(length=32), nullable=False),
        sa.Column("strain_id", sa.String(length=32), nullable=False),
        sa.Column("strain_name", sa.String(length=128), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("prize_grow", MONEY, nullable=False),
        sa.Column("submitted_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["cup_id"], ["cannabis_cups.id"], name=op.f("fk_cup_entries_cup_id_cannabis_cups")),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], name=op.f("fk_cup_entries_player_id_players")),
        sa.ForeignKeyConstraint(["harvest_id"], ["harvests.id"], name=op.f("fk_cup_entries_harvest_id_harvests")),
        sa.ForeignKeyConstraint(["strain_id"], ["strains.id"], name=op.f("fk_cup_entries_strain_id_strains")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cup_entries")),
    )
    op.create_index("ix_cup_entries_cup_score", "cup_entries", ["cup_id", "score"], unique=False)
    op.create_index("uq_cup_entries_cup_harvest", "cup_entries", ["cup_id", "harvest_id"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_cup_entries_cup_harvest", table_name="cup_entries")
    op.drop_index("ix_cup_entries_cup_score", table_name="cup_entries")
    op.drop_table("cup_entries")
    op.drop_index("ix_cannabis_cups_status_ends_at", table_name="cannabis_cups")
    op.drop_table("cannabis_cups")
    with op.batch_alter_table("players", schema=None) as batch_op:
        batch_op.drop_column("cannabis_cup_title")
