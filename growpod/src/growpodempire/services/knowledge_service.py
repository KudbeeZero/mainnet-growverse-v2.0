"""
KnowledgeService — the single, audited writer for the global, append-only
``knowledge_events`` capture layer (design/11 Phase 1: "the teacher gets
smarter — never lose generative data").

Mirrors ``LearnerModelService.apply``'s single-writer invariant: ``append()``
is the ONLY method anywhere in the codebase that inserts into
``knowledge_events``. The table is append-only by construction — there is no
update/delete path here, and none should be added: this is a durable
provenance log of every generative artifact a player produces (Master Grower
Q&A, lecture deliveries, exam results, care outcomes), feeding a later
retrieval layer (design/11 P3) that anonymizes on read.

NON-ECONOMIC: like the learner model, this module deliberately imports
nothing from ``economy``/``ledger``/wallet surfaces. ``knowledge_events`` and
this service must NEVER post to the GROW ledger, touch a Wallet, or read
``balance.yaml``.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from ..db.models import KnowledgeEvent
from ..simulation.clock import Clock, SystemClock


class KnowledgeService:
    def __init__(self, session: Session, clock: Optional[Clock] = None):
        self.session = session
        self.clock = clock or SystemClock()

    def append(
        self,
        event_type: str,
        payload: dict,
        *,
        player_id: Optional[str] = None,
    ) -> KnowledgeEvent:
        """Append exactly one row to the global ``knowledge_events`` log.

        ``payload`` is the actual generative content (a question/answer/
        citations triple, a lecture reference, an exam score, ...) — never
        currency, never a ledger/wallet reference. ``player_id`` is recorded
        for provenance/audit ONLY; any future read/retrieval surface built on
        this table must strip it before serving data back to players (shared
        knowledge is ANONYMOUS by construction — see design/11).
        """
        row = KnowledgeEvent(
            event_type=event_type,
            payload=dict(payload or {}),
            player_id=player_id,
            created_at=self.clock.now(),
        )
        self.session.add(row)
        self.session.flush()
        return row
