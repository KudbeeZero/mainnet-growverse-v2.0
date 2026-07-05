"""Add idempotency_keys table, care_streak and resin_score columns to plants

Revision ID: 70a67b462a1f
Revises: cf72176d4eff
Create Date: 2026-07-05 18:46:00.000000

Concurrency hardening + design punch list additions:
1. idempotency_keys table: stores request key → response mapping for deduplication
   on mutations. Guards against network retries and double-clicks causing unintended
   state duplication (double-spend, double-harvest, etc.).
2. plants.care_streak (INT): consecutive days the plant has been cared for
3. plants.resin_score (FLOAT): aggregated quality metric derived from trichome
   maturity, health, and environment

IdempotencyKey table is indexed on (key UNIQUE, player_id, expires_at) for
efficient lookups and cleanup.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '70a67b462a1f'
down_revision: Union[str, None] = 'cf72176d4eff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create idempotency_keys table
    op.create_table(
        'idempotency_keys',
        sa.Column('id', sa.String(32), primary_key=True, nullable=False),
        sa.Column('key', sa.String(256), nullable=False, unique=True, index=True),
        sa.Column('player_id', sa.String(32), nullable=False),
        sa.Column('method', sa.String(8), nullable=False),
        sa.Column('endpoint', sa.String(256), nullable=False),
        sa.Column('response_json', sa.JSON(), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['player_id'], ['players.id'], name='fk_idempotency_keys_player_id_players'),
    )
    op.create_index('ix_idempotency_player', 'idempotency_keys', ['player_id'])
    op.create_index('ix_idempotency_expires', 'idempotency_keys', ['expires_at'])

    # Add care_streak and resin_score columns to plants table
    op.add_column('plants', sa.Column('care_streak', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('plants', sa.Column('resin_score', sa.Float(), nullable=False, server_default='0.0'))


def downgrade() -> None:
    # Remove columns from plants table
    op.drop_column('plants', 'resin_score')
    op.drop_column('plants', 'care_streak')

    # Drop idempotency_keys table
    op.drop_index('ix_idempotency_expires', table_name='idempotency_keys')
    op.drop_index('ix_idempotency_player', table_name='idempotency_keys')
    op.drop_table('idempotency_keys')
