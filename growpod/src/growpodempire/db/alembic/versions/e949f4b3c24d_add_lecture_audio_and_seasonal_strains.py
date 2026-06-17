"""add_lecture_audio_and_seasonal_strains

Revision ID: e949f4b3c24d
Revises:
Create Date: 2026-06-17 05:56:43.447460

Adds two tables introduced with the University TTS + seasonal token-sink feature:

  lecture_audio      — cached ElevenLabs MP3 bytes keyed on (voice_id, text_hash);
                       avoids redundant API calls across server restarts.

  seasonal_strains   — monthly exclusive strain drops; the price_gc column is the
                       token-sink: deducted from the player wallet on purchase.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e949f4b3c24d"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: skip creation when tables already exist (e.g. bootstrapped
    # via init_db / create_all on a fresh local SQLite DB).
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = inspector.get_table_names()

    if "lecture_audio" not in existing:
        op.create_table(
            "lecture_audio",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("voice_id", sa.String(64), nullable=False),
            sa.Column("text_hash", sa.String(64), nullable=False),
            sa.Column("mp3_data", sa.LargeBinary(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )
        op.create_index(
            "uq_lecture_audio_voice_hash",
            "lecture_audio",
            ["voice_id", "text_hash"],
            unique=True,
        )

    if "seasonal_strains" not in existing:
        op.create_table(
            "seasonal_strains",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column(
                "strain_id",
                sa.String(32),
                sa.ForeignKey("strains.id"),
                nullable=False,
            ),
            sa.Column("available_month", sa.String(7), nullable=False),
            sa.Column(
                "price_gc", sa.Numeric(precision=18, scale=8), nullable=False
            ),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )
        op.create_index(
            "uq_seasonal_strains_strain_month",
            "seasonal_strains",
            ["strain_id", "available_month"],
            unique=True,
        )


def downgrade() -> None:
    op.drop_table("seasonal_strains")
    op.drop_table("lecture_audio")
