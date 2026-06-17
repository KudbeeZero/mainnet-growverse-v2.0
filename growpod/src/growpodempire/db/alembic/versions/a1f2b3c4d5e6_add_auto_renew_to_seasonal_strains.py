"""add_auto_renew_to_seasonal_strains

Revision ID: a1f2b3c4d5e6
Revises: e949f4b3c24d
Create Date: 2026-06-17 06:00:00.000000

Adds `auto_renew` boolean column to `seasonal_strains`.  When true the admin
dashboard will automatically carry the entry forward into the next calendar
month instead of requiring a manual re-seed.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1f2b3c4d5e6"
down_revision: Union[str, None] = "e949f4b3c24d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [c["name"] for c in inspector.get_columns("seasonal_strains")]

    if "auto_renew" not in existing_columns:
        op.add_column(
            "seasonal_strains",
            sa.Column("auto_renew", sa.Boolean(), nullable=False, server_default="false"),
        )


def downgrade() -> None:
    op.drop_column("seasonal_strains", "auto_renew")
