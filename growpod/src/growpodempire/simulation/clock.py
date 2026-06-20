"""
Time abstraction so the simulation never calls datetime.now() directly — tests
inject a FrozenClock they can advance deterministically.

The same seam powers the **simulation test clock** (`OffsetClock` + the
process-wide singleton below): a dev/test-only affordance that fast-forwards
grow time without touching the economy. Because the engine is compute-on-read,
shifting the clock forward simply makes the next read of any plant catch up.
Production never reaches the test-clock branch — see `active_clock()`.
"""

from datetime import datetime, timedelta
from typing import Optional, Protocol


class Clock(Protocol):
    def now(self) -> datetime:  # pragma: no cover - protocol
        ...


class SystemClock:
    """Real wall-clock (UTC)."""

    def now(self) -> datetime:
        return datetime.utcnow()


class FrozenClock:
    """A controllable clock for tests/simulations."""

    def __init__(self, start: datetime):
        self._now = start

    def now(self) -> datetime:
        return self._now

    def advance(self, **kwargs) -> datetime:
        """Advance by a timedelta (e.g. advance(hours=3, days=1))."""
        self._now = self._now + timedelta(**kwargs)
        return self._now

    def set(self, when: datetime) -> None:
        self._now = when


class OffsetClock:
    """A wall-clock shifted by a mutable, forward-only offset.

    The runtime sibling of `FrozenClock`: instead of freezing time it lets a
    developer fast-forward it, so the compute-on-read engine advances every
    plant on the next read. Forward-only by design — a backward jump would put
    `now()` behind a plant's persisted ``last_tick_at`` (the catch-up would
    silently no-op and the stage clock would desync), so `advance` rejects
    negative deltas and `reset` is the only way back to wall time.
    """

    def __init__(self, base: Optional[Clock] = None, offset: Optional[timedelta] = None):
        self._base = base or SystemClock()
        self._offset = offset or timedelta()

    def now(self) -> datetime:
        return self._base.now() + self._offset

    @property
    def offset(self) -> timedelta:
        return self._offset

    def advance(self, **kwargs) -> timedelta:
        """Push the offset forward by a timedelta. Returns the new total offset."""
        delta = timedelta(**kwargs)
        if delta.total_seconds() < 0:
            raise ValueError("the test clock only advances forward")
        self._offset += delta
        return self._offset

    def reset(self) -> None:
        """Drop the offset back to zero (effective clock == wall time)."""
        self._offset = timedelta()


# --- Per-player "turbo" speed faucet -----------------------------------------
# A per-ACCOUNT accelerated clock built on the same forward-only-offset idea as
# OffsetClock, but driven by fields persisted on the Player row so it survives
# in production (unlike the dev test clock). The effective time for a player is
# their wall `now` shifted by a banked offset plus, while turbo is engaged, the
# live acceleration accrued since it was switched on:
#
#     effective = wall + offset + (enabled ? (wall - anchor) * (multiplier - 1) : 0)
#
# d(effective)/d(wall) == multiplier while ON and == 1 while OFF, and the shift
# is monotonic (offset only ever grows), so a player's plants never rewind. Pure
# and model-free so it has no import cycle with db.models; callers pass the three
# persisted fields in.
def player_effective_now(
    wall_now: datetime,
    *,
    turbo_enabled: bool,
    offset_seconds: float,
    anchor_at: Optional[datetime],
    multiplier: float,
) -> datetime:
    """The player's accelerated 'now'. Defaults to `wall_now` when turbo has
    never run (offset 0, disabled)."""
    bonus = float(offset_seconds or 0.0)
    if turbo_enabled and anchor_at is not None:
        live = (wall_now - anchor_at).total_seconds()
        if live > 0:
            bonus += live * (float(multiplier) - 1.0)
    if bonus <= 0:
        return wall_now
    return wall_now + timedelta(seconds=bonus)


def player_clock(wall_now: datetime, player, multiplier: float):
    """Read a Player row's turbo fields and return ``(effective_now, rate)``.

    ``rate`` is the CURRENT speed of the effective clock relative to wall time:
    ``multiplier`` only while turbo is actively engaged, else ``1.0`` (a banked
    offset still shifts ``now`` forward, but time then advances at wall rate).
    Callers anchoring wall-clock ETAs must divide remaining time by ``rate`` —
    not by ``multiplier`` — so a banked-but-OFF faucet doesn't over-compress.

    Single source of truth for the per-player clock so the two services that
    advance plants (read sync + harvest catch-up) can never drift apart.
    """
    enabled = bool(getattr(player, "turbo_enabled", False))
    eff = player_effective_now(
        wall_now,
        turbo_enabled=enabled,
        offset_seconds=float(getattr(player, "turbo_offset_seconds", 0.0) or 0.0),
        anchor_at=getattr(player, "turbo_anchor_at", None),
        multiplier=multiplier,
    )
    return eff, (float(multiplier) if enabled else 1.0)


# --- Process-wide simulation test clock --------------------------------------
# A single shared OffsetClock for the running process. Lazily created; only ever
# reached when the test clock is enabled (dev/test, never production).
_shared_test_clock: Optional[OffsetClock] = None


def get_test_clock() -> OffsetClock:
    """The process-wide simulation test clock (lazily created)."""
    global _shared_test_clock
    if _shared_test_clock is None:
        _shared_test_clock = OffsetClock()
    return _shared_test_clock


def reset_test_clock() -> None:
    """Forget the shared offset so the next read falls back to wall time."""
    global _shared_test_clock
    _shared_test_clock = None


def active_clock() -> Clock:
    """The clock the engine should read by default.

    The shared, advanceable test clock when (and only when) it is enabled;
    otherwise plain wall time. The enablement flag is force-disabled in
    production (see `config.Settings`), so this can never hand a live
    deployment a fast-forwardable clock.
    """
    from ..config import get_settings

    if get_settings().test_clock_enabled:
        return get_test_clock()
    return SystemClock()
