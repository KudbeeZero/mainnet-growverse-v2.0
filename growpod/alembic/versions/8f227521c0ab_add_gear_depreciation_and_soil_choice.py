"""add gear depreciation and plant soil choice

Revision ID: 8f227521c0ab
Revises: f45790bd6802
Create Date: 2026-07-03 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f227521c0ab'
down_revision: Union[str, None] = 'f45790bd6802'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('gear_inventory', schema=None) as batch_op:
        batch_op.add_column(sa.Column('condition_pct', sa.Float(), nullable=False, server_default='100.0'))
        batch_op.add_column(sa.Column('grow_cycles_used', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('times_serviced', sa.Integer(), nullable=False, server_default='0'))
    with op.batch_alter_table('plants', schema=None) as batch_op:
        batch_op.add_column(sa.Column('soil_key', sa.String(length=48), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('plants', schema=None) as batch_op:
        batch_op.drop_column('soil_key')
    with op.batch_alter_table('gear_inventory', schema=None) as batch_op:
        batch_op.drop_column('times_serviced')
        batch_op.drop_column('grow_cycles_used')
        batch_op.drop_column('condition_pct')
