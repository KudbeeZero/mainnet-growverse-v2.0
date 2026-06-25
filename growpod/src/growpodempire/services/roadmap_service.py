"""
RoadmapService — the READ-ONLY learning-path builder (Phase 6d).

Reads a learner's ``mastery_by_skill`` from the centralized learner model and runs
it through a ``RoadmapProvider`` (the deterministic mock in CI / no-key) to produce
an ordered, prerequisite-respecting path. The two invariants this service honors:

  1. READ-ONLY. The roadmap NEVER mutates learner state — it does not call
     ``LearnerModelService.apply``, set ``LearnerProfile`` fields, or write any
     audit/DB row. It only READS the profile's mastery map and returns a plan.

  2. NON-ECONOMIC. Like the learner model it reads from, this layer NEVER posts to
     the GROW ledger, touches a Wallet, or reads ``balance.yaml`` / ``economy/``.
     This module deliberately imports nothing from ``economy``/``ledger``.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from ..ai.factory import shared_roadmap
from ..ai.provider import RoadmapProvider
from .learner_model_service import LearnerModelService


class RoadmapService:
    def __init__(self, session: Session):
        self.session = session

    def roadmap(
        self,
        player_id: str,
        *,
        horizon_days: int = 7,
        provider: Optional[RoadmapProvider] = None,
    ) -> dict:
        """Build the player's ordered, prerequisite-respecting learning path.

        Reads ``mastery_by_skill`` from the centralized learner model (READ-ONLY)
        and asks the active ``RoadmapProvider`` for a plan. Returns the plan dict
        plus the mastery summary it was built from. No writes, no apply, no ledger.
        """
        mastery = LearnerModelService(self.session).profile(player_id)["mastery_by_skill"]
        plan = (provider or shared_roadmap()).recommend(
            mastery_by_skill=mastery, horizon_days=horizon_days
        )
        payload = plan.model_dump()
        payload["mastery_by_skill"] = dict(mastery)
        return payload
