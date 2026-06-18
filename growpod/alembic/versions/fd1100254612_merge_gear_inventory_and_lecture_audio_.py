"""merge gear inventory and lecture audio heads

Revision ID: fd1100254612
Revises: a7b8c9d0e1f2, c8d9e0f1a2b3
Create Date: 2026-06-17 17:16:06.741935

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fd1100254612'
down_revision: Union[str, None] = ('a7b8c9d0e1f2', 'c8d9e0f1a2b3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
