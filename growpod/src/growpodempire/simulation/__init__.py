"""
Real-time grow simulation engine (Phase 2).

Plants advance in fixed hourly steps from their `last_tick_at` to the current
time whenever they're read or acted upon — "compute-on-read catch-up" — so the
simulation is correct without relying on a continuously running process, and is
fully deterministic and reproducible.
"""

from .clock import Clock, SystemClock, FrozenClock
from .conditions import PlantCondition, Severity
from .engine import catch_up, advance_to
from . import reactions

__all__ = [
    "Clock",
    "SystemClock",
    "FrozenClock",
    "PlantCondition",
    "Severity",
    "catch_up",
    "advance_to",
    "reactions",
]
