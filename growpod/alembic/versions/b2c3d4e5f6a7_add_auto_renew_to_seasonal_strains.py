"""add_auto_renew_to_seasonal_strains

Revision ID: b2c3d4e5f6a7
Revises: fa3e2b1c9d07
Create Date: 2026-06-17 07:00:00.000000

Adds `auto_renew` boolean column to `seasonal_strains`.  When true the admin
dashboard and the monthly background job will automatically carry the entry
forward into the next calendar month instead of requiring a manual re-seed.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "fa3e2b1c9d07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [c["name"] for c in inspector.get_columns("seasonal_strains")]

    if "auto_renew" not in existing_columns:
        op.add_column(
            "seasonal_strains",
            sa.Column(
                "auto_renew",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )


def downgrade() -> None:
    op.drop_column("seasonal_strains", "auto_renew")
