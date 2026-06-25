"""
Pure, deterministic engagement rules for the University "learning loop" (Phase 5).

NON-ECONOMIC by construction: this module has NO database, NO clock, and NO
currency. It is just arithmetic over a study streak so it can be exhaustively
unit-tested. Knowledge-XP (KXP) award amounts live here as named constants; KXP
is a SEPARATE counter from game XP/level and from GROW — nothing here ever
references the ledger, a wallet, or balance.yaml.
"""

from __future__ import annotations

from datetime import date
from typing import Optional, Tuple

# ----- KXP award amounts (Knowledge-XP — NOT game XP, NOT GROW currency) ------
KXP_COURSE_COMPLETE = 100
KXP_EXAM_PASS = 50
KXP_MODULE = 20

# ----- streak tuning ----------------------------------------------------------
# A freeze token covers a single missed day (a one-day grace). Players earn one
# each time their streak crosses a 7-day multiple, capped so they can't bank an
# unlimited safety net.
STREAK_FREEZE_INTERVAL = 7
MAX_FREEZE_TOKENS = 3


def streak_after(
    prev_streak: int,
    last_date: Optional[date],
    today: date,
    freeze_tokens: int,
) -> Tuple[int, int, bool]:
    """Resolve a study event into the new (streak, freeze_tokens, already_today).

    Rules (all relative to ``last_date``):
      * same day                -> unchanged, already_studied_today=True
      * today == last + 1       -> streak + 1
      * today == last + 2 and freeze_tokens > 0
                                 -> consume ONE freeze (grace covers the single
                                    missed day), streak + 1
      * any larger gap, a freeze-less two-day gap, or no last_date
                                 -> streak resets to 1

    On every streak that advances, award a freeze token each time the new streak
    hits a multiple of ``STREAK_FREEZE_INTERVAL`` (capped at ``MAX_FREEZE_TOKENS``).
    """
    freeze = freeze_tokens

    # Already counted a study event for today — idempotent, nothing changes.
    if last_date is not None and today == last_date:
        return prev_streak, freeze, True

    if last_date is None:
        new_streak = 1
    else:
        gap = (today - last_date).days
        if gap < 0:
            # Defensive: a backwards date is treated like a fresh start.
            new_streak = 1
        elif gap == 1:
            new_streak = prev_streak + 1
        elif gap == 2 and freeze > 0:
            freeze -= 1  # spend the grace day
            new_streak = prev_streak + 1
        else:
            new_streak = 1

    # Reward crossing each 7-day milestone (only when the streak grew into it).
    if new_streak > prev_streak and new_streak % STREAK_FREEZE_INTERVAL == 0:
        freeze = min(freeze + 1, MAX_FREEZE_TOKENS)

    return new_streak, freeze, False
