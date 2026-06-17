"""marketplace concurrency: optimistic-lock counter on market_listings

Closes a narrow lost-funds race on auctions. Two *first* bids placed at the same
instant debit two different bidder wallets, so the wallet-level optimistic lock
can't serialize them; both would write the same listing row last-writer-wins,
leaving the losing bidder debited (AUCTION_BID) with no standing bid and no
refund path. Adding a version counter to market_listings makes the listing the
serialization point: the loser hits a StaleDataError and rolls its debit back.

Mirrors the wallets.version pattern wired in f1a2b3c4d5e6.

Revision ID: c3d4e5f6a7b8
Revises: f1a2b3c4d5e6
Create Date: 2026-06-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch_alter_table rebuilds the table on SQLite (no ALTER ADD COLUMN with a
    # NOT NULL constraint otherwise) and emits a plain ALTER on Postgres. The
    # server_default backfills existing rows to 0; the column stays NOT NULL.
    with op.batch_alter_table("market_listings", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("version", sa.Integer(), nullable=False, server_default="0")
        )


def downgrade() -> None:
    with op.batch_alter_table("market_listings", schema=None) as batch_op:
        batch_op.drop_column("version")
