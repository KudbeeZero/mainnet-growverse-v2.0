"""add waitlist_signups (NON-ECONOMIC faction + launch waitlist)

Revision ID: c5a1b2d3e4f6
Revises: b4d1e2f3a6c7
Create Date: 2026-06-26 00:00:00.000000

Additive: one new table for the pre-launch FACTION + launch waitlist. A signup
records a chosen faction plus an optional Algorand address and/or email and a
self-contained engagement-points tally. NONE of this is currency — it never
touches wallets or the ledger, and the address is stored only as a string for a
future reward (no on-chain action).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c5a1b2d3e4f6"
down_revision: Union[str, None] = "b4d1e2f3a6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "waitlist_signups",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("faction", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("algorand_address", sa.String(length=64), nullable=True),
        sa.Column(
            "engagement_points", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "source", sa.String(length=32), nullable=False, server_default="web"
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_waitlist_signups")),
    )
    op.create_index(
        op.f("ix_waitlist_signups_algorand_address"),
        "waitlist_signups",
        ["algorand_address"],
        unique=False,
    )
    op.create_index(
        "ix_waitlist_signups_faction",
        "waitlist_signups",
        ["faction"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_waitlist_signups_faction", table_name="waitlist_signups")
    op.drop_index(
        op.f("ix_waitlist_signups_algorand_address"),
        table_name="waitlist_signups",
    )
    op.drop_table("waitlist_signups")
