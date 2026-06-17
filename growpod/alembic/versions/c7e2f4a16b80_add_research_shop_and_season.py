"""add research tree, consumable shop, and strain season

Revision ID: c7e2f4a16b80
Revises: b3d7c1a9e240
Create Date: 2026-06-07 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7e2f4a16b80'
down_revision: Union[str, None] = 'b3d7c1a9e240'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'research_progress',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('player_id', sa.String(length=32), nullable=False),
        sa.Column('node_key', sa.String(length=48), nullable=False),
        sa.Column('unlocked_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_research_player_node', 'research_progress',
                    ['player_id', 'node_key'], unique=True)

    op.create_table(
        'consumable_inventory',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('player_id', sa.String(length=32), nullable=False),
        sa.Column('item_key', sa.String(length=48), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_consumable_player_item', 'consumable_inventory',
                    ['player_id', 'item_key'], unique=True)

    with op.batch_alter_table('strains', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('season', sa.String(length=16), nullable=False, server_default='all')
        )


def downgrade() -> None:
    with op.batch_alter_table('strains', schema=None) as batch_op:
        batch_op.drop_column('season')
    op.drop_index('ix_consumable_player_item', table_name='consumable_inventory')
    op.drop_table('consumable_inventory')
    op.drop_index('ix_research_player_node', table_name='research_progress')
    op.drop_table('research_progress')
