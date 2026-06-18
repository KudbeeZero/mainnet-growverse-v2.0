"""unify duplicate gear/lecture merge heads (502de4114faa + fd1100254612)

Two no-op merge migrations were independently created (by different PRs) to
resolve the same gear_inventory / lecture_audio fork, both with parents
(a7b8c9d0e1f2, c8d9e0f1a2b3). Landing both on main re-forked the graph into
two heads, so `alembic upgrade head` and `make check-migrations` fail and
Render's preDeploy (`alembic upgrade head`) would break. This is a no-op merge
that unifies the duplicates back to a single head. No schema change.

Revision ID: cdf258e5082d
Revises: 502de4114faa, fd1100254612
Create Date: 2026-06-18 04:47:18.291210

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cdf258e5082d'
down_revision: Union[str, None] = ('502de4114faa', 'fd1100254612')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
