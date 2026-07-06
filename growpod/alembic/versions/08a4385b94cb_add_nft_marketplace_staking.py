"""Add NFT marketplace + staking tables (Sprint 4, testnet/mock only)

Revision ID: 08a4385b94cb
Revises: 70a67b462a1f
Create Date: 2026-07-06 00:00:00.000000

Adds the four additive tables behind the new `nft_marketplace` / `nft_staking`
feature flags (both OFF by default -- see balance.yaml):

  * nft_assets   -- marketplace-tracking wrapper around an already-minted
                    Harvest ASA (Harvest.nft_asset_id/nft_status, added by an
                    earlier migration, remain the source of truth for "is this
                    minted on-chain"; this table never mints on its own).
  * nft_listings -- peer-to-peer marketplace listings for an NFTAsset.
  * nft_trades   -- settlement records for executed/attempted trades.
  * staking_locks -- the "curing room": an NFTAsset locked for a duration to
                    earn a bonus-GC reward on claim.

This revision was rewritten to chain directly onto the current single head
(70a67b462a1f) rather than the stale fork point (e5f6a7b8c9d0) the original
Sprint 4 branch forked from, so the repo keeps exactly one Alembic head.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '08a4385b94cb'
down_revision: Union[str, None] = '70a67b462a1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'nft_assets',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('asset_type', sa.String(length=16), nullable=False),
        sa.Column('owner_address', sa.String(length=64), nullable=False),
        sa.Column('game_item_id', sa.String(length=64), nullable=False),
        sa.Column('mint_txid', sa.String(length=80), nullable=True),
        sa.Column('ipfs_hash', sa.String(length=64), nullable=True),
        sa.Column('metadata_snapshot', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='minted'),
        sa.Column('synced_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_nft_assets'),
    )
    op.create_index('ix_nft_assets_asset_id', 'nft_assets', ['asset_id'], unique=True)
    op.create_index('ix_nft_assets_owner_address', 'nft_assets', ['owner_address'])
    op.create_index('ix_nft_assets_owner', 'nft_assets', ['owner_address'])

    op.create_table(
        'nft_listings',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('nft_asset_id', sa.Integer(), nullable=False),
        sa.Column('seller_address', sa.String(length=64), nullable=False),
        sa.Column('price_ualgos', sa.Numeric(18, 6), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='active'),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('sold_at', sa.DateTime(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ['nft_asset_id'], ['nft_assets.asset_id'], name='fk_nft_listings_nft_asset_id_nft_assets'
        ),
        sa.PrimaryKeyConstraint('id', name='pk_nft_listings'),
    )
    op.create_index('ix_nft_listings_nft_asset_id', 'nft_listings', ['nft_asset_id'])
    op.create_index('ix_nft_listings_seller_address', 'nft_listings', ['seller_address'])
    op.create_index('ix_nft_listings_status', 'nft_listings', ['status', 'seller_address'])

    op.create_table(
        'nft_trades',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('listing_id', sa.String(length=32), nullable=False),
        sa.Column('nft_asset_id', sa.Integer(), nullable=False),
        sa.Column('buyer_address', sa.String(length=64), nullable=False),
        sa.Column('seller_address', sa.String(length=64), nullable=False),
        sa.Column('price_ualgos', sa.Numeric(18, 6), nullable=False),
        sa.Column('txid', sa.String(length=80), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='pending'),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.String(length=512), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ['listing_id'], ['nft_listings.id'], name='fk_nft_trades_listing_id_nft_listings'
        ),
        sa.ForeignKeyConstraint(
            ['nft_asset_id'], ['nft_assets.asset_id'], name='fk_nft_trades_nft_asset_id_nft_assets'
        ),
        sa.PrimaryKeyConstraint('id', name='pk_nft_trades'),
    )
    op.create_index('ix_nft_trades_nft_asset_id', 'nft_trades', ['nft_asset_id'])
    op.create_index('ix_nft_trades_buyer_address', 'nft_trades', ['buyer_address'])
    op.create_index('ix_nft_trades_seller_address', 'nft_trades', ['seller_address'])
    op.create_index('ix_nft_trades_status', 'nft_trades', ['status', 'created_at'])

    op.create_table(
        'staking_locks',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('nft_asset_id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.String(length=32), nullable=False),
        sa.Column('cure_start_at', sa.DateTime(), nullable=False),
        sa.Column('cure_end_at', sa.DateTime(), nullable=False),
        sa.Column('cure_target_hours', sa.Float(), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='active'),
        sa.Column('rewards_amount', sa.Numeric(18, 6), nullable=True),
        sa.Column('rewards_claimed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ['nft_asset_id'], ['nft_assets.asset_id'], name='fk_staking_locks_nft_asset_id_nft_assets'
        ),
        sa.ForeignKeyConstraint(
            ['player_id'], ['players.id'], name='fk_staking_locks_player_id_players'
        ),
        sa.PrimaryKeyConstraint('id', name='pk_staking_locks'),
    )
    op.create_index('ix_staking_locks_nft_asset_id', 'staking_locks', ['nft_asset_id'])
    op.create_index('ix_staking_locks_player', 'staking_locks', ['player_id', 'status'])
    op.create_index('ix_staking_locks_end', 'staking_locks', ['cure_end_at'])


def downgrade() -> None:
    op.drop_index('ix_staking_locks_end', table_name='staking_locks')
    op.drop_index('ix_staking_locks_player', table_name='staking_locks')
    op.drop_index('ix_staking_locks_nft_asset_id', table_name='staking_locks')
    op.drop_table('staking_locks')

    op.drop_index('ix_nft_trades_status', table_name='nft_trades')
    op.drop_index('ix_nft_trades_seller_address', table_name='nft_trades')
    op.drop_index('ix_nft_trades_buyer_address', table_name='nft_trades')
    op.drop_index('ix_nft_trades_nft_asset_id', table_name='nft_trades')
    op.drop_table('nft_trades')

    op.drop_index('ix_nft_listings_status', table_name='nft_listings')
    op.drop_index('ix_nft_listings_seller_address', table_name='nft_listings')
    op.drop_index('ix_nft_listings_nft_asset_id', table_name='nft_listings')
    op.drop_table('nft_listings')

    op.drop_index('ix_nft_assets_owner', table_name='nft_assets')
    op.drop_index('ix_nft_assets_owner_address', table_name='nft_assets')
    op.drop_index('ix_nft_assets_asset_id', table_name='nft_assets')
    op.drop_table('nft_assets')
