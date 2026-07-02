"""add lecture_content, last_result, and knowledge_events

Owner directive 2026-07-02 — "make the university real": three additive
changes, one migration since they land together.

  lecture_content    — produce-once cache for lecture TEXT, keyed on
                       `course_key` (mirrors `lecture_audio`'s produce-once
                       cache for lecture AUDIO). LecturerService.teach() now
                       checks this table before ever calling the AI provider.

  assessment_attempts.last_result — a JSON column holding the item-level
                       result of a player's MOST RECENT graded exam attempt
                       (answer-stripped; the same shape `submit_exam` already
                       returns over the wire), so a player can replay/review
                       their last try. Distinct from best_score/passed, which
                       stay "best ever" and forgiving.

  knowledge_events   — a new, APPEND-ONLY global capture table (design/11
                       Phase 1): one row per generative artifact any player
                       produces (Master Grower Q&A, lecture deliveries, exam
                       results). Written only by `KnowledgeService.append`.

All three are purely additive: no existing table is dropped or narrowed, so
this is safe to apply forward and to revert.

Revision ID: 4f2e8ab64721
Revises: c5a1b2d3e4f6
Create Date: 2026-07-02 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "4f2e8ab64721"
down_revision: Union[str, None] = "c5a1b2d3e4f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "lecture_content" not in existing_tables:
        op.create_table(
            "lecture_content",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("course_key", sa.String(48), nullable=False),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("key_takeaways", sa.JSON(), nullable=False),
            sa.Column("quiz_question", sa.Text(), nullable=False),
            sa.Column("provider", sa.String(64), nullable=False),
            sa.Column(
                "created_at", sa.DateTime(), nullable=False,
                server_default=sa.func.now(),
            ),
        )
        op.create_index(
            "uq_lecture_content_course_key",
            "lecture_content",
            ["course_key"],
            unique=True,
        )

    attempt_columns = [c["name"] for c in inspector.get_columns("assessment_attempts")]
    if "last_result" not in attempt_columns:
        op.add_column(
            "assessment_attempts",
            sa.Column("last_result", sa.JSON(), nullable=True),
        )

    if "knowledge_events" not in existing_tables:
        op.create_table(
            "knowledge_events",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("event_type", sa.String(32), nullable=False),
            sa.Column("player_id", sa.String(32), sa.ForeignKey("players.id"), nullable=True),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column(
                "created_at", sa.DateTime(), nullable=False,
                server_default=sa.func.now(),
            ),
        )
        op.create_index(
            "ix_knowledge_events_event_type", "knowledge_events", ["event_type"],
        )
        op.create_index(
            "ix_knowledge_events_created_at", "knowledge_events", ["created_at"],
        )


def downgrade() -> None:
    op.drop_index("ix_knowledge_events_created_at", table_name="knowledge_events")
    op.drop_index("ix_knowledge_events_event_type", table_name="knowledge_events")
    op.drop_table("knowledge_events")

    op.drop_column("assessment_attempts", "last_result")

    op.drop_index("uq_lecture_content_course_key", table_name="lecture_content")
    op.drop_table("lecture_content")
