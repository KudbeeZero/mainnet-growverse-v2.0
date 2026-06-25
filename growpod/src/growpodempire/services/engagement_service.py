"""
UniversityEngagementService — the NON-ECONOMIC learning loop (Phase 5).

Accrues Knowledge-XP (KXP), maintains a daily study streak with freeze-token
grace, exposes a KXP "scholars" league, and derives proactive nudges from the
existing transcript/progress state.

HARD RULE: nothing here touches the GROW ledger, a Wallet, ``balance.yaml``, or
``economy/ledger.py``. KXP is a counter that lives only in ``university_progress``
and is wholly distinct from game XP/level (``leveling_service``) and from GROW.
The streak math lives in the pure ``engagement_rules`` module; this layer only
adds persistence + a clock.
"""

from __future__ import annotations

from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from ..db.models import Player, UniversityProgress
from ..simulation.clock import Clock, SystemClock
from . import engagement_rules


class UniversityEngagementService:
    def __init__(self, session: Session, clock: Optional[Clock] = None):
        self.session = session
        self.clock = clock or SystemClock()

    # ----- internals ------------------------------------------------------
    def _row(self, player_id: str) -> Optional[UniversityProgress]:
        return (
            self.session.query(UniversityProgress)
            .filter(UniversityProgress.player_id == player_id)
            .one_or_none()
        )

    def _today(self, today: Optional[date]) -> date:
        return today if today is not None else self.clock.now().date()

    # ----- accrual --------------------------------------------------------
    def record_study_event(
        self, player_id: str, kxp: int, *, today: Optional[date] = None
    ) -> dict:
        """Upsert the player's engagement row, advance the streak, and add KXP.

        ``kxp`` is added directly to the row's counter — NEVER via the ledger.
        Returns the resulting state plus ``awarded_kxp`` (what this call added)
        and ``already_studied_today``.
        """
        today = self._today(today)
        row = self._row(player_id)
        if row is None:
            row = UniversityProgress(
                player_id=player_id,
                kxp=0,
                streak_count=0,
                last_study_date=None,
                freeze_tokens=0,
            )
            self.session.add(row)

        new_streak, new_freeze, already = engagement_rules.streak_after(
            row.streak_count, row.last_study_date, today, row.freeze_tokens
        )
        row.streak_count = new_streak
        row.freeze_tokens = new_freeze
        row.last_study_date = today
        awarded = int(kxp or 0)
        row.kxp += awarded
        self.session.flush()
        return {
            "kxp": row.kxp,
            "streak_count": row.streak_count,
            "freeze_tokens": row.freeze_tokens,
            "last_study_date": row.last_study_date.isoformat()
            if row.last_study_date
            else None,
            "awarded_kxp": awarded,
            "already_studied_today": already,
        }

    # ----- reads ----------------------------------------------------------
    def progress(self, player_id: str) -> dict:
        """The player's engagement state (zeros if they have no row yet)."""
        row = self._row(player_id)
        if row is None:
            return {
                "kxp": 0,
                "streak_count": 0,
                "freeze_tokens": 0,
                "last_study_date": None,
            }
        return {
            "kxp": row.kxp,
            "streak_count": row.streak_count,
            "freeze_tokens": row.freeze_tokens,
            "last_study_date": row.last_study_date.isoformat()
            if row.last_study_date
            else None,
        }

    def scholars(self, limit: int = 10) -> List[dict]:
        """The KXP league: players ranked by Knowledge-XP descending."""
        rows = (
            self.session.query(
                Player.id,
                Player.username,
                UniversityProgress.kxp,
                UniversityProgress.streak_count,
            )
            .join(UniversityProgress, UniversityProgress.player_id == Player.id)
            .order_by(
                UniversityProgress.kxp.desc(),
                UniversityProgress.streak_count.desc(),
            )
            .limit(limit)
            .all()
        )
        return [
            {"id": pid, "username": name, "kxp": int(kxp), "streak_count": int(streak)}
            for pid, name, kxp, streak in rows
        ]

    def next_nudge(self, player_id: str) -> Optional[str]:
        """A single proactive nudge derived from existing progress/transcript.

        Pure-ish read: no writes. Priorities, highest first:
          1. A degree that is one course away from claimable.
          2. A degree that is already claimable.
          3. Keep an active streak alive (if not studied today).
          4. Encourage a first study session.
        """
        # Local import avoids a circular import (university_service imports this).
        from .university_service import UniversityService

        prog = self.progress(player_id)
        try:
            transcript = UniversityService(self.session).transcript(player_id)
        except Exception:  # pragma: no cover - defensive; nudge is best-effort
            transcript = None

        if transcript:
            degrees = transcript.get("degrees") or []
            # A degree one course short of completion.
            for d in degrees:
                if d.get("earned"):
                    continue
                required = d.get("required_courses") or []
                done = d.get("completed_required") or []
                remaining = len(required) - len(done)
                if required and remaining == 1:
                    return f"You're 1 course from the {d.get('name', d['key'])}."
            # A degree that can be claimed right now.
            for d in degrees:
                if d.get("claimable"):
                    return f"You've earned the {d.get('name', d['key'])} — claim it!"

        streak = prog["streak_count"]
        if streak > 0 and not self._studied_today(player_id):
            return f"Keep your {streak}-day streak alive — study today."

        if streak == 0 and prog["kxp"] == 0:
            return "Start a study streak — complete a lecture or course today."

        return None

    def _studied_today(self, player_id: str) -> bool:
        row = self._row(player_id)
        return bool(row and row.last_study_date == self.clock.now().date())
