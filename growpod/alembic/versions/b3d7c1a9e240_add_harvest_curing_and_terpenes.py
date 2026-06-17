"""add harvest curing fields and expressed terpenes

Revision ID: b3d7c1a9e240
Revises: fbb8fceedacd
Create Date: 2026-06-07 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d7c1a9e240'
down_revision: Union[str, None] = 'fbb8fceedacd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('harvests', schema=None) as batch_op:
        batch_op.add_column(sa.Column('terpenes', sa.JSON(), nullable=True))
        batch_op.add_column(
            sa.Column('cure_status', sa.String(length=16),
                      nullable=False, server_default='none')
        )
        batch_op.add_column(sa.Column('cure_started_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('cure_target_hours', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('base_quality', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('cure_quality_bonus', sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('harvests', schema=None) as batch_op:
        batch_op.drop_column('cure_quality_bonus')
        batch_op.drop_column('base_quality')
        batch_op.drop_column('cure_target_hours')
        batch_op.drop_column('cure_started_at')
        batch_op.drop_column('cure_status')
        batch_op.drop_column('terpenes')
