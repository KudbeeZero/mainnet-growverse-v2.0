"""nft_assets optimistic lock + staked_once flag + unique players.algorand_address

Disruptor-sweep findings (docs/memory/standups/2026-07-06-disruptor-sweep.md):

- `NFTAsset` was the one status-gated marketplace table without a
  `version_id_col`, unlike `NFTListing`/`Wallet`/`Harvest`/`MarketListing`
  (finding #8). Two concurrent `create_lock`/`create_listing` calls could
  both pass a check-then-write on `status` and both commit -- e.g. two
  independently-claimable `StakingLock`s for one NFT. Mirrors the
  `NFTListing.version` pattern (`c3d4e5f6a7b8_marketlisting_optimistic_lock.py`).

- `NFTAsset.staked_once` closes the infinite-restake faucet (finding #2): the
  same NFT could be staked, claimed, and re-staked indefinitely for a fresh
  10%-of-sale_value payout each cycle. `StakingService.claim_rewards` now sets
  this flag on withdrawal instead of leaving the asset re-stakeable.

- `players.algorand_address` was `index=True` but not unique, so multiple
  players could link the same address (part of finding #4, the wallet-hijack
  gap; the real fix -- signed-challenge ownership proof -- is a separate,
  owner-testnet-click-tested PR). This is defense-in-depth: it doesn't stop a
  first-mover from claiming an address they don't control, but it does stop
  the SAME address being linked to two different player accounts at once.
  NULLs are unaffected (both SQLite and Postgres allow multiple NULLs under a
  UNIQUE constraint) -- unlinked players are untouched.

Revision ID: a3f6c1d8b920
Revises: 08a4385b94cb
Create Date: 2026-07-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a3f6c1d8b920"
down_revision: Union[str, None] = "08a4385b94cb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch_alter_table rebuilds the table on SQLite (no ALTER ADD COLUMN with a
    # NOT NULL constraint / index swap otherwise) and emits plain ALTERs on
    # Postgres. server_default backfills existing rows; both columns stay
    # NOT NULL.
    with op.batch_alter_table("nft_assets", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("version", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column(
                "staked_once", sa.Boolean(), nullable=False, server_default=sa.false()
            )
        )

    with op.batch_alter_table("players", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_players_algorand_address"))
        batch_op.create_index(
            batch_op.f("ix_players_algorand_address"),
            ["algorand_address"],
            unique=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("players", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_players_algorand_address"))
        batch_op.create_index(
            batch_op.f("ix_players_algorand_address"),
            ["algorand_address"],
            unique=False,
        )

    with op.batch_alter_table("nft_assets", schema=None) as batch_op:
        batch_op.drop_column("staked_once")
        batch_op.drop_column("version")
