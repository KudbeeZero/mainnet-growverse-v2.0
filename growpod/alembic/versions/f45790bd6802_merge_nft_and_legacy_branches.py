"""merge NFT and legacy branches

Revision ID: f45790bd6802
Revises: 01a2b3c4d5e6, e5f6a7b8c9d0
Create Date: 2026-07-03 18:26:46.840480

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f45790bd6802'
down_revision: Union[str, None] = ('01a2b3c4d5e6', 'e5f6a7b8c9d0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
