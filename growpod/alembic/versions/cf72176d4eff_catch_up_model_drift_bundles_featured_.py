"""catch up model drift: bundles, featured_items, store_partners, player_badges tables + seasonal_strains.price_gc scale

Revision ID: cf72176d4eff
Revises: f6a7b8c9d0e1
Create Date: 2026-07-05 17:47:44.754788

Infrastructure audit (2026-07-05) found `alembic check` FAILING against
`Base.metadata`: four store/badge tables (`bundles`, `featured_items`,
`store_partners`, `player_badges`) were added to models.py without a matching
migration, so they've only ever existed via the boot-time
`Base.metadata.create_all(checkfirst=True)` fallback in `db/session.init_db()`
— every environment's `alembic upgrade head` silently ran without them. Also
catches `seasonal_strains.price_gc`: migration `fa3e2b1c9d07` created it as
`NUMERIC(18, 8)`, but the model (and every other money column) has since
standardized on `MONEY = Numeric(18, 6)`.

Table creation is guarded by an existence check (mirrors the idempotent
pattern in `fa3e2b1c9d07`) since every currently-deployed environment already
has these four tables via `create_all`; a genuinely fresh database (no prior
`create_all` boot) still gets them created here. The price_gc rescale is
unconditional — every environment's `seasonal_strains` table came from
`fa3e2b1c9d07`, which always runs before this migration, so the scale-8
column is always present at this point. Existing data is preserved (rescale,
not drop-and-recreate); any value with more than 6 decimal places rounds to
6, matching every other money column's precision.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cf72176d4eff'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = inspector.get_table_names()

    if "store_partners" not in existing:
        op.create_table(
            "store_partners",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("name", sa.String(128), nullable=False),
            sa.Column("logo_url", sa.String(512), nullable=False),
            sa.Column("tagline", sa.String(60), nullable=False),
            sa.Column("product_type", sa.String(16), nullable=False),
            sa.Column("product_id", sa.String(64), nullable=False),
            sa.Column("price_gc", sa.Numeric(precision=18, scale=6), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if "featured_items" not in existing:
        op.create_table(
            "featured_items",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("item_type", sa.String(16), nullable=False),
            sa.Column("item_id", sa.String(64), nullable=False),
            sa.Column("label", sa.String(128), nullable=False),
            sa.Column("badge", sa.String(16), nullable=False, server_default="limited"),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("valid_through", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if "bundles" not in existing:
        op.create_table(
            "bundles",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("name", sa.String(128), nullable=False),
            sa.Column("description", sa.String(255), nullable=False),
            sa.Column("discount_pct", sa.Float(), nullable=False),
            sa.Column("components", sa.JSON(), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if "player_badges" not in existing:
        op.create_table(
            "player_badges",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("player_id", sa.String(32), sa.ForeignKey("players.id"), nullable=False),
            sa.Column("badge_key", sa.String(48), nullable=False),
            sa.Column("earned_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index(
            "uq_player_badges_player_key",
            "player_badges",
            ["player_id", "badge_key"],
            unique=True,
        )

    # seasonal_strains.price_gc: NUMERIC(18, 8) -> NUMERIC(18, 6), matching the
    # MONEY convention every other currency column uses. Unconditional: this
    # column always exists by this point (created by fa3e2b1c9d07, which runs
    # earlier in every upgrade path).
    with op.batch_alter_table("seasonal_strains", schema=None) as batch_op:
        batch_op.alter_column(
            "price_gc",
            existing_type=sa.Numeric(precision=18, scale=8),
            type_=sa.Numeric(precision=18, scale=6),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("seasonal_strains", schema=None) as batch_op:
        batch_op.alter_column(
            "price_gc",
            existing_type=sa.Numeric(precision=18, scale=6),
            type_=sa.Numeric(precision=18, scale=8),
            existing_nullable=False,
        )
    op.drop_table("player_badges")
    op.drop_table("bundles")
    op.drop_table("featured_items")
    op.drop_table("store_partners")
