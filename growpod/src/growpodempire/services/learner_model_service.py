"""
LearnerModelService — the CENTRALIZED LEARNER MODEL (Phase 6a).

This is the single authoritative source of *what a learner knows and needs*: a
per-player ``LearnerProfile`` (mastery / misconceptions / risk / preferences)
plus an append-only ``LearnerEvent`` AUDIT LOG. The two invariants this module
exists to enforce:

  1. SINGLE WRITER. ``apply(...)`` is the ONLY method that mutates a
     ``LearnerProfile``. Every other "writer" (``recompute_mastery``,
     ``recompute_risk``, the study-event hooks) funnels through it. No mutation
     happens without a matching ``LearnerEvent`` row written in the same call —
     so a profile can never change unaudited.

  2. NON-ECONOMIC. Like the engagement loop it reads from, this layer NEVER
     posts to the GROW ledger, touches a Wallet, or reads ``balance.yaml`` /
     ``economy/``. It is learning state, not currency. This module deliberately
     imports nothing from ``economy``/``ledger``.

The ENGAGEMENT slice (KXP / streak / freeze) is NOT duplicated here — it lives in
``UniversityEngagementService`` (Phase 5); ``profile(...)`` merely READS it and
folds it into the read model.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from ..db.models import AssessmentAttempt, LearnerEvent, LearnerProfile
from ..simulation.clock import Clock, SystemClock
from .engagement_service import UniversityEngagementService

# How many days without a study event before an enrolled learner is "at_risk".
RISK_STALE_DAYS = 3


class LearnerModelService:
    def __init__(self, session: Session, clock: Optional[Clock] = None):
        self.session = session
        self.clock = clock or SystemClock()

    # ----- internals ------------------------------------------------------
    def _row(self, player_id: str) -> Optional[LearnerProfile]:
        return (
            self.session.query(LearnerProfile)
            .filter(LearnerProfile.player_id == player_id)
            .one_or_none()
        )

    # ----- the ONLY mutator ----------------------------------------------
    def apply(
        self,
        player_id: str,
        *,
        agent: str,
        kind: str,
        detail: dict,
        reason: str,
    ) -> LearnerProfile:
        """Upsert the player's ``LearnerProfile``, apply the change implied by
        ``(kind, detail)``, and ALWAYS append a matching ``LearnerEvent`` row in
        the same call.

        This is the single mutation entry point for the learner model — no other
        code path may write ``LearnerProfile``. The derive-and-store helpers
        (``recompute_mastery`` / ``recompute_risk``) funnel through here so every
        state change is audited.
        """
        detail = dict(detail or {})
        row = self._row(player_id)
        if row is None:
            row = LearnerProfile(
                player_id=player_id,
                mastery_by_skill={},
                misconceptions={},
                experience_level="beginner",
                risk_level="none",
            )
            self.session.add(row)

        self._mutate(row, kind, detail)

        self.session.add(
            LearnerEvent(
                player_id=player_id,
                at=self.clock.now(),
                agent=agent,
                kind=kind,
                detail=detail,
                reason=reason or "",
            )
        )
        self.session.flush()
        return row

    def _mutate(self, row: LearnerProfile, kind: str, detail: dict) -> None:
        """Apply the change implied by ``(kind, detail)`` to ``row`` in place.

        Centralized so the field-touching logic stays in one place. Unknown kinds
        are still audited (the event row is written by ``apply``) but leave the
        profile fields untouched — useful for pure provenance markers like
        ``course_completed`` / ``exam_passed``.
        """
        if kind == "mastery_update":
            # Replace the mastery map wholesale (recompute is authoritative). Copy
            # so SQLAlchemy sees a new dict and the event keeps its own snapshot.
            row.mastery_by_skill = dict(detail.get("mastery_by_skill", {}))
        elif kind == "misconceptions_update":
            row.misconceptions = dict(detail.get("misconceptions", {}))
        elif kind == "risk_update":
            row.risk_level = str(detail.get("risk_level", row.risk_level))
        elif kind == "profile_update":
            for field in ("preferred_format", "goals", "experience_level"):
                if field in detail:
                    setattr(row, field, detail[field])
        # else: provenance-only kinds (course_completed, exam_passed, ...) — no
        # field change, but the LearnerEvent is still recorded by apply().

    # ----- derive-and-store (audited via apply) ---------------------------
    def recompute_mastery(
        self, player_id: str, *, agent: str = "system", reason: str = ""
    ) -> LearnerProfile:
        """Deterministically derive ``mastery_by_skill`` from the player's
        ``AssessmentAttempt`` best_scores and store it through ``apply``.

        6b keys mastery by real ``skill_id`` (the data-driven skills graph), not
        by ``course_key``. For each attempt we look up the skills the course
        teaches (``skills_for_course``) and contribute that course's best_score to
        each of its skills; a skill taught by multiple completed courses takes the
        MAX best_score across them. Deterministic: same attempt rows -> same map,
        with sorted keys so the stored map is byte-identical run to run.

        A COMPLETED course also credits its skills at ``MASTERY_THRESHOLD`` even
        without an exam: most courses have no assessment bank yet, and completion
        already gates on study time + the live-grow practical. An exam best_score
        can only raise that floor (MAX), never lower it."""
        from ..ai.roadmap_mock import MASTERY_THRESHOLD
        from ..db.models import CourseEnrollment
        from .skills import skills_for_course

        attempts = (
            self.session.query(AssessmentAttempt)
            .filter(AssessmentAttempt.player_id == player_id)
            .all()
        )
        # First collapse to the BEST best_score per course (a course may have
        # several exams; the course's contribution to its skills is its best).
        best_by_course: dict = {}
        for a in attempts:
            score = round(float(a.best_score), 6)
            cur = best_by_course.get(a.course_key)
            if cur is None or score > cur:
                best_by_course[a.course_key] = score

        # Completed courses seed their skills at the mastery threshold (floor).
        completed = (
            self.session.query(CourseEnrollment)
            .filter(
                CourseEnrollment.player_id == player_id,
                CourseEnrollment.status == "completed",
            )
            .all()
        )
        for enr in completed:
            cur = best_by_course.get(enr.course_key)
            if cur is None or MASTERY_THRESHOLD > cur:
                best_by_course[enr.course_key] = MASTERY_THRESHOLD

        # Fan each course's best score out to the skills it teaches; a skill taught
        # by multiple completed courses takes the max.
        mastery: dict = {}
        for course_key, score in best_by_course.items():
            for skill_id in skills_for_course(course_key):
                cur = mastery.get(skill_id)
                if cur is None or score > cur:
                    mastery[skill_id] = score

        # Stable ordering so the stored map is byte-identical run to run.
        mastery = {k: mastery[k] for k in sorted(mastery)}
        return self.apply(
            player_id,
            agent=agent,
            kind="mastery_update",
            detail={"mastery_by_skill": mastery},
            reason=reason or "recompute_mastery from assessment best_scores",
        )

    def recompute_risk(
        self, player_id: str, *, agent: str = "system", reason: str = ""
    ) -> LearnerProfile:
        """Derive ``risk_level`` ("none"/"at_risk") from the engagement slice and
        store it through ``apply``.

        at_risk when the learner has an enrollment but no live study cadence — a
        zero streak, or a ``last_study_date`` that is stale / missing."""
        eng = UniversityEngagementService(self.session).progress(player_id)
        risk = "at_risk" if self._is_at_risk(player_id, eng) else "none"
        return self.apply(
            player_id,
            agent=agent,
            kind="risk_update",
            detail={"risk_level": risk},
            reason=reason or "recompute_risk from engagement cadence",
        )

    def _is_at_risk(self, player_id: str, eng: dict) -> bool:
        from ..db.models import CourseEnrollment

        enrolled = (
            self.session.query(CourseEnrollment)
            .filter(CourseEnrollment.player_id == player_id)
            .first()
            is not None
        )
        if not enrolled:
            return False
        if int(eng.get("streak_count", 0) or 0) <= 0:
            return True
        last = eng.get("last_study_date")
        if not last:
            return True
        try:
            last_date = date.fromisoformat(last)
        except (TypeError, ValueError):
            return True
        today = self.clock.now().date()
        return (today - last_date) > timedelta(days=RISK_STALE_DAYS)

    # ----- read model -----------------------------------------------------
    def profile(self, player_id: str) -> dict:
        """The merged read model: the profile fields PLUS the engagement slice
        (kxp / streak / freeze / last_study_date). Zero/default if no rows."""
        row = self._row(player_id)
        if row is None:
            base = {
                "mastery_by_skill": {},
                "misconceptions": {},
                "preferred_format": None,
                "goals": None,
                "experience_level": "beginner",
                "risk_level": "none",
                "updated_at": None,
            }
        else:
            base = {
                "mastery_by_skill": dict(row.mastery_by_skill or {}),
                "misconceptions": dict(row.misconceptions or {}),
                "preferred_format": row.preferred_format,
                "goals": row.goals,
                "experience_level": row.experience_level,
                "risk_level": row.risk_level,
                "updated_at": row.updated_at.isoformat()
                if isinstance(row.updated_at, datetime)
                else None,
            }
        # READ the engagement slice — never duplicated or moved here.
        base["engagement"] = UniversityEngagementService(self.session).progress(
            player_id
        )
        return base
