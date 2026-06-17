"""add_object_path_to_lecture_audio

Revision ID: c8d9e0f1a2b3
Revises: b2c3d4e5f6a7
Create Date: 2026-06-17 08:30:00.000000

Adds an optional `object_path` column to `lecture_audio`.
Stores the GCS App Storage path (e.g. ``audio/<voice_id>_<hash>.mp3``)
where the MP3 is persisted. When set, the audio endpoint streams from
object storage rather than reading the BLOB from the DB, reducing DB load
and ensuring audio survives container restarts / redeployments without
re-calling ElevenLabs.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("lecture_audio")]
    if "object_path" not in columns:
        op.add_column(
            "lecture_audio",
            sa.Column("object_path", sa.String(512), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("lecture_audio", "object_path")
