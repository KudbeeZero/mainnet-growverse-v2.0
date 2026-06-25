"""
AdmissionsService — the intake advisor that seeds the learner model (Phase 6c).

Runs a short intake quiz through an ``AdmissionsProvider`` (the deterministic mock
in CI / no-key) and writes the resulting recommendation INTO the centralized
learner model. The two invariants this service exists to honor:

  1. AUDITED SINGLE WRITER. The recommendation is persisted ONLY through
     ``LearnerModelService.apply`` — admissions never sets ``LearnerProfile`` fields
     directly and never appends a ``LearnerEvent`` itself. The ``profile_update``
     kind sets ``experience_level`` + ``goals`` on the profile, and the FULL
     recommendation (department/track/level) is captured on the audit row's
     ``detail`` regardless.

  2. NON-ECONOMIC. Like the learner model it writes through, this layer NEVER posts
     to the GROW ledger, touches a Wallet, or reads ``balance.yaml`` / ``economy/``.
     This module deliberately imports nothing from ``economy``/``ledger``.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from ..ai.factory import shared_admissions
from ..ai.provider import AdmissionsProvider, AdmissionsRecommendation
from ..simulation.clock import Clock
from .learner_model_service import LearnerModelService


class AdmissionsService:
    def __init__(self, session: Session, clock: Optional[Clock] = None):
        self.session = session
        self.clock = clock

    def quiz(self) -> list[dict]:
        """The intake quiz definition (passthrough to the active provider)."""
        provider = shared_admissions()
        return provider.quiz() if hasattr(provider, "quiz") else []

    def run_intake(
        self,
        player_id: str,
        answers: dict,
        *,
        provider: Optional[AdmissionsProvider] = None,
    ) -> dict:
        """Score the intake ``answers`` into a recommendation and persist it through
        the audited single writer, returning the recommendation + the merged profile.

        The write goes through ``LearnerModelService.apply`` with
        ``kind="profile_update"`` — that sets ``experience_level`` and ``goals`` on
        the profile, and records the entire recommendation on the ``LearnerEvent``
        audit row's ``detail``. No profile field is set directly here.
        """
        rec: AdmissionsRecommendation = (provider or shared_admissions()).recommend(answers)

        learner = LearnerModelService(self.session, self.clock)
        learner.apply(
            player_id,
            agent="admissions",
            kind="profile_update",
            detail={
                "experience_level": rec.level,
                "goals": self._goals_summary(rec),
                "school": rec.school,
                "department": rec.department,
                "track": list(rec.track),
                "level": rec.level,
            },
            reason="admissions intake recommendation",
        )
        return {
            "recommendation": rec.model_dump(),
            "profile": LearnerModelService(self.session, self.clock).profile(player_id),
        }

    @staticmethod
    def _goals_summary(rec: AdmissionsRecommendation) -> str:
        """A concise, learner-facing goal string stored as the profile's ``goals``."""
        track = ", ".join(rec.track) if rec.track else "the department track"
        return f"Start in {rec.department} ({rec.level}); track: {track}"
