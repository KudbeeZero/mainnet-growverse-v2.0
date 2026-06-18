"""add ledger idempotency_key unique index

Adds a nullable `idempotency_key` column to `ledger_entries` plus a unique index
so one-shot reward/claim faucets (achievement, contract, cup prize) can never be
credited twice. Both SQLite and Postgres allow multiple NULLs under a unique
index, so only tagged reward rows are constrained; all other movements stay NULL.

Revision ID: 6e24d19ef857
Revises: cdf258e5082d
Create Date: 2026-06-18 04:54:39.803363

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e24d19ef857'
down_revision: Union[str, None] = 'cdf258e5082d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ledger_entries",
        sa.Column("idempotency_key", sa.String(length=120), nullable=True),
    )
    op.create_index(
        "uq_ledger_idempotency_key",
        "ledger_entries",
        ["idempotency_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_ledger_idempotency_key", table_name="ledger_entries")
    with op.batch_alter_table("ledger_entries") as batch_op:
        batch_op.drop_column("idempotency_key")
