"""add per-account turbo speed faucet fields to players

Adds the banked, forward-only clock fields that back the global "10× test"
speed faucet:
  - turbo_enabled         is the faucet currently ON
  - turbo_offset_seconds  accumulated (banked) acceleration, never rewound
  - turbo_anchor_at       wall time the current ON window started (NULL when OFF)

No economy columns; plant-biology pacing only.

Revision ID: e1f2a3b4c5d6
Revises: fd1100254612
Create Date: 2026-06-20 04:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'fd1100254612'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'players',
        sa.Column('turbo_enabled', sa.Boolean(), nullable=False,
                  server_default=sa.false()),
    )
    op.add_column(
        'players',
        sa.Column('turbo_offset_seconds', sa.Float(), nullable=False,
                  server_default='0'),
    )
    op.add_column(
        'players',
        sa.Column('turbo_anchor_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('players', 'turbo_anchor_at')
    op.drop_column('players', 'turbo_offset_seconds')
    op.drop_column('players', 'turbo_enabled')
