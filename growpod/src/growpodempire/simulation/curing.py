"""
Post-harvest drying/curing — a pure, deterministic quality model.

`cure_progress(...)` is a pure function of the harvest's base quality, when the
cure started, the target the player committed to, and "now". Like the grow
engine it is compute-on-read: reading at any wall-clock moment yields the same
result, and once the committed target has elapsed the outcome is frozen
(finishing later never changes it).

The curve rewards a proper cure with a quality bonus (fast early gains, then
diminishing returns toward an optimal window) and punishes over-drying — leaving
buds curing far past the optimal window slowly erodes quality.
"""

from dataclasses import dataclass
from datetime import datetime

from ..economy.config import EconomyConfig


@dataclass(frozen=True)
class CureResult:
    quality: float          # final quality (0..100) after the cure
    bonus: float            # net quality delta vs. base (may be negative if over-dried)
    elapsed_hours: float
    done: bool              # True once the committed target has fully elapsed


def cure_progress(
    base_quality: float,
    started_at: datetime,
    target_hours: float,
    now: datetime,
    cfg: EconomyConfig,
    bonus_scale: float = 1.0,
) -> CureResult:
    """Quality after curing `base_quality` buds from `started_at` to `now`.

    `bonus_scale` (>= 1.0) lets research-tree upgrades amplify the cure bonus.
    """
    c = cfg.curing
    optimal = float(c.get("optimal_hours", 72))
    max_bonus = float(c.get("max_quality_bonus", 10.0)) * max(1.0, bonus_scale)
    penalty_per_hour = float(c.get("over_dry_penalty_per_hour", 0.04))
    grace = float(c.get("over_dry_grace_hours", 48))

    elapsed = max(0.0, (now - started_at).total_seconds() / 3600.0)
    # The cure only counts up to the target the player committed to, so the
    # outcome stops changing once that target is reached (idempotent on read).
    effective = min(elapsed, target_hours)

    # Bonus ramps toward max as the cure approaches the optimal window. sqrt =>
    # most of the gain comes early, with diminishing returns.
    ramp = min(1.0, effective / optimal) if optimal > 0 else 1.0
    bonus = max_bonus * (ramp ** 0.5)

    # Over-drying: time spent past the optimal window (and a grace period) erodes
    # quality. Only relevant when the player commits to an over-long cure.
    over = max(0.0, effective - optimal - grace)
    penalty = penalty_per_hour * over

    net = bonus - penalty
    quality = max(0.0, min(100.0, base_quality + net))
    return CureResult(
        quality=round(quality, 4),
        bonus=round(net, 4),
        elapsed_hours=round(elapsed, 4),
        done=elapsed >= target_hours,
    )
