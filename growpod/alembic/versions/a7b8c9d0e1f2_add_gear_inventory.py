"""add gear_inventory (grow-room gear: lights/fans/soils)

Revision ID: a7b8c9d0e1f2
Revises: b2c3d4e5f6a7
Create Date: 2026-06-17 09:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gear_inventory',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('player_id', sa.String(length=32), nullable=False),
        sa.Column('gear_key', sa.String(length=48), nullable=False),
        sa.Column('category', sa.String(length=16), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('equipped_pod_id', sa.String(length=32), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.ForeignKeyConstraint(['equipped_pod_id'], ['grow_pods.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_gear_player_key', 'gear_inventory',
                    ['player_id', 'gear_key'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_gear_player_key', table_name='gear_inventory')
    op.drop_table('gear_inventory')
