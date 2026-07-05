"""minting concurrency: optimistic-lock counter on harvests + strains

Closes a duplicate-mint race. `MintingService.mint_harvest()` /
`mint_strain()` follow a check-then-act pattern (`nft_status == "none"` ->
mark PENDING -> call `provider.create_asset()`), but neither `Harvest` nor
`Strain` carried a version counter or unique constraint on the mint state.
Two concurrent mint requests for the same row could both pass the check and
both call `create_asset()`, minting two real on-chain assets for one harvest
or strain.

Adding a version counter to both tables makes the PENDING-status commit (see
`minting_service.py`) the serialization point: the loser hits a
StaleDataError and never reaches `create_asset()`.

Mirrors the wallets.version / market_listings.version pattern wired in
f1a2b3c4d5e6 / c3d4e5f6a7b8.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch_alter_table rebuilds the table on SQLite (no ALTER ADD COLUMN with a
    # NOT NULL constraint otherwise) and emits a plain ALTER on Postgres. The
    # server_default backfills existing rows to 0; the column stays NOT NULL.
    with op.batch_alter_table("harvests", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("version", sa.Integer(), nullable=False, server_default="0")
        )
    with op.batch_alter_table("strains", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("version", sa.Integer(), nullable=False, server_default="0")
        )


def downgrade() -> None:
    with op.batch_alter_table("strains", schema=None) as batch_op:
        batch_op.drop_column("version")
    with op.batch_alter_table("harvests", schema=None) as batch_op:
        batch_op.drop_column("version")
