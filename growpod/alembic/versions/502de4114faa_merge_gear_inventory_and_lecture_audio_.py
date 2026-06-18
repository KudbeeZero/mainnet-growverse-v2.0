"""merge gear_inventory and lecture_audio object_path heads

Revision ID: 502de4114faa
Revises: a7b8c9d0e1f2, c8d9e0f1a2b3
Create Date: 2026-06-18 01:41:28.286654

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '502de4114faa'
down_revision: Union[str, None] = ('a7b8c9d0e1f2', 'c8d9e0f1a2b3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
