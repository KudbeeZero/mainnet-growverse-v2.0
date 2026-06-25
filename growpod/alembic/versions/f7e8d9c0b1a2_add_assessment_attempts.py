"""add assessment_attempts (university exam grading — best score/pass per exam)

Additive only: creates one new table. No existing table is altered, so this is
safe to apply forward and to revert. Part of University Build Phase 1.

Revision ID: f7e8d9c0b1a2
Revises: e1f2a3b4c5d6
Create Date: 2026-06-25 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7e8d9c0b1a2'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'assessment_attempts',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('player_id', sa.String(length=32), nullable=False),
        sa.Column('course_key', sa.String(length=48), nullable=False),
        sa.Column('exam_id', sa.String(length=48), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('best_score', sa.Float(), nullable=False, server_default='0'),
        sa.Column('passed', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('last_attempt_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'uq_assessment_attempts_player_course_exam',
        'assessment_attempts',
        ['player_id', 'course_key', 'exam_id'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        'uq_assessment_attempts_player_course_exam',
        table_name='assessment_attempts',
    )
    op.drop_table('assessment_attempts')
