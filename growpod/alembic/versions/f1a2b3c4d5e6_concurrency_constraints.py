"""concurrency hardening: wallet non-negative CHECK + harvest-once unique

Makes the two highest-value economic exploits impossible at the DB level
(not just via app-side checks under a race):
  * wallets.cached_balance can never go negative (CHECK backstop behind the
    optimistic lock),
  * a plant can be harvested exactly once (unique on harvests.plant_id), so a
    concurrent double-harvest can't mint duplicate currency.

The optimistic-lock enforcement itself needs no schema change — wallets.version
already exists; the model now wires it as version_id_col.

Revision ID: f1a2b3c4d5e6
Revises: e7a9c1b3f2d8
Create Date: 2026-06-10

"""
from typing import Sequence, Union

from alembic import op


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e7a9c1b3f2d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Unique index → harvest-once. (Plain index works identically on SQLite/PG.)
    op.create_index("uq_harvests_plant", "harvests", ["plant_id"], unique=True)

    # Non-negative balance backstop. batch_alter_table rebuilds the table on
    # SQLite (which can't ALTER ADD CONSTRAINT) and emits a plain ALTER on PG.
    with op.batch_alter_table("wallets", schema=None) as batch_op:
        batch_op.create_check_constraint("ck_wallets_balance_nonneg", "cached_balance >= 0")


def downgrade() -> None:
    with op.batch_alter_table("wallets", schema=None) as batch_op:
        batch_op.drop_constraint("ck_wallets_balance_nonneg", type_="check")
    op.drop_index("uq_harvests_plant", table_name="harvests")
