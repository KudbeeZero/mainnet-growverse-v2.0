"""drop unused columns: research_progress.unlocked_at, growth_measurements.leaf_count/growth_rate

No application code reads or writes these three columns. They were added speculatively
and never wired into any service, API, or simulation path.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-03 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('research_progress', 'unlocked_at')
    op.drop_column('growth_measurements', 'leaf_count')
    op.drop_column('growth_measurements', 'growth_rate')


def downgrade() -> None:
    # Restore as nullable — existing rows won't carry historical values.
    op.add_column('growth_measurements', sa.Column('growth_rate', sa.Float(), nullable=True))
    op.add_column('growth_measurements', sa.Column('leaf_count', sa.Integer(), nullable=True))
    op.add_column('research_progress', sa.Column('unlocked_at', sa.DateTime(), nullable=True))
