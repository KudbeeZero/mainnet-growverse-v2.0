"""Add NFT marketplace and staking models for Sprint 4

Additive: creates 4 new tables for NFT assets, marketplace listings, trades,
and staking locks. No existing tables are modified.

Revision ID: 01a2b3c4d5e6
Revises: fd1100254612
Create Date: 2026-07-03 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '01a2b3c4d5e6'
down_revision: Union[str, None] = 'fd1100254612'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'nft_assets',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('asset_type', sa.String(length=16), nullable=False),
        sa.Column('owner_address', sa.String(length=64), nullable=False),
        sa.Column('game_item_id', sa.String(length=64), nullable=False),
        sa.Column('mint_txid', sa.String(length=80), nullable=False),
        sa.Column('ipfs_hash', sa.String(length=64)),
        sa.Column('metadata_snapshot', sa.JSON()),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='minted'),
        sa.Column('synced_at', sa.DateTime()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('asset_id'),
    )
    op.create_index('ix_nft_assets_asset_id', 'nft_assets', ['asset_id'])
    op.create_index('ix_nft_assets_owner', 'nft_assets', ['owner_address'])

    op.create_table(
        'nft_listings',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('nft_asset_id', sa.Integer(), nullable=False),
        sa.Column('seller_address', sa.String(length=64), nullable=False),
        sa.Column('price_ualgos', sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='active'),
        sa.Column('expires_at', sa.DateTime()),
        sa.Column('sold_at', sa.DateTime()),
        sa.Column('version', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['nft_asset_id'], ['nft_assets.asset_id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_nft_listings_asset', 'nft_listings', ['nft_asset_id'])
    op.create_index('ix_nft_listings_status', 'nft_listings', ['status', 'seller_address'])

    op.create_table(
        'nft_trades',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('listing_id', sa.String(length=32), nullable=False),
        sa.Column('nft_asset_id', sa.Integer(), nullable=False),
        sa.Column('buyer_address', sa.String(length=64), nullable=False),
        sa.Column('seller_address', sa.String(length=64), nullable=False),
        sa.Column('price_ualgos', sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column('txid', sa.String(length=80)),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='pending'),
        sa.Column('confirmed_at', sa.DateTime()),
        sa.Column('error_message', sa.String(length=512)),
        sa.ForeignKeyConstraint(['listing_id'], ['nft_listings.id']),
        sa.ForeignKeyConstraint(['nft_asset_id'], ['nft_assets.asset_id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_nft_trades_asset', 'nft_trades', ['nft_asset_id'])
    op.create_index('ix_nft_trades_buyer', 'nft_trades', ['buyer_address'])
    op.create_index('ix_nft_trades_status', 'nft_trades', ['status', 'created_at'])

    op.create_table(
        'staking_locks',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('nft_asset_id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.String(length=32), nullable=False),
        sa.Column('cure_start_at', sa.DateTime(), nullable=False),
        sa.Column('cure_end_at', sa.DateTime(), nullable=False),
        sa.Column('cure_target_hours', sa.Float(), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='active'),
        sa.Column('rewards_amount', sa.Numeric(precision=18, scale=6)),
        sa.Column('rewards_claimed_at', sa.DateTime()),
        sa.ForeignKeyConstraint(['nft_asset_id'], ['nft_assets.asset_id']),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_staking_locks_asset', 'staking_locks', ['nft_asset_id'])
    op.create_index('ix_staking_locks_player', 'staking_locks', ['player_id', 'status'])
    op.create_index('ix_staking_locks_end', 'staking_locks', ['cure_end_at'])


def downgrade() -> None:
    op.drop_index('ix_staking_locks_end', table_name='staking_locks')
    op.drop_index('ix_staking_locks_player', table_name='staking_locks')
    op.drop_index('ix_staking_locks_asset', table_name='staking_locks')
    op.drop_table('staking_locks')

    op.drop_index('ix_nft_trades_status', table_name='nft_trades')
    op.drop_index('ix_nft_trades_buyer', table_name='nft_trades')
    op.drop_index('ix_nft_trades_asset', table_name='nft_trades')
    op.drop_table('nft_trades')

    op.drop_index('ix_nft_listings_status', table_name='nft_listings')
    op.drop_index('ix_nft_listings_asset', table_name='nft_listings')
    op.drop_table('nft_listings')

    op.drop_index('ix_nft_assets_owner', table_name='nft_assets')
    op.drop_index('ix_nft_assets_asset_id', table_name='nft_assets')
    op.drop_table('nft_assets')
