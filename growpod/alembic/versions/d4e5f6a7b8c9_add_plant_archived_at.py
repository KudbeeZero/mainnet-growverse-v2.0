"""add plants.archived_at (pod cleanup keeps the row, hides it from lists)

Revision ID: d4e5f6a7b8c9
Revises: c5a1b2d3e4f6
Create Date: 2026-07-03 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c5a1b2d3e4f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('plants', sa.Column('archived_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('plants', 'archived_at')
