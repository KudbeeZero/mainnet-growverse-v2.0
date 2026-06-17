"""add GrowPod University tables and player degree title

Revision ID: e7a9c1b3f2d8
Revises: d5e6f7a8b9c0
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7a9c1b3f2d8"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("players", schema=None) as batch_op:
        batch_op.add_column(sa.Column("university_title", sa.String(length=96), nullable=True))

    op.create_table(
        "course_enrollments",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("player_id", sa.String(length=32), nullable=False),
        sa.Column("course_key", sa.String(length=48), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], name=op.f("fk_course_enrollments_player_id_players")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_course_enrollments")),
    )
    op.create_index("uq_course_enrollments_player_course", "course_enrollments", ["player_id", "course_key"], unique=True)

    op.create_table(
        "degree_progress",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("player_id", sa.String(length=32), nullable=False),
        sa.Column("degree_key", sa.String(length=48), nullable=False),
        sa.Column("earned_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], name=op.f("fk_degree_progress_player_id_players")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_degree_progress")),
    )
    op.create_index("uq_degree_progress_player_degree", "degree_progress", ["player_id", "degree_key"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_degree_progress_player_degree", table_name="degree_progress")
    op.drop_table("degree_progress")
    op.drop_index("uq_course_enrollments_player_course", table_name="course_enrollments")
    op.drop_table("course_enrollments")
    with op.batch_alter_table("players", schema=None) as batch_op:
        batch_op.drop_column("university_title")
