"""
DEV/TEST-ONLY endpoints — the simulation test clock.

Registered only when `settings.test_clock_enabled` is true (GROW_TEST_CLOCK=true
on a non-production APP_ENV; see `config.Settings`). These let a developer
fast-forward grow time so the full grow loop can be exercised in seconds instead
of real days, which unblocks STEP 4 (e2e grow-loop testing) and launch-readiness
checks.

Safety boundaries (why this can't hurt real players or the economy):
- The blueprint is never registered in production (primary gate), and every
  handler re-checks the flag (defence in depth) so a stale registration 404s.
- Advancing the clock only shifts the shared OffsetClock forward; the engine's
  compute-on-read catch-up then runs as it always does. It posts NO ledger
  entries and changes NO prices, faucets, or sinks — money is untouched.
- A single advance is bounded to one engine catch-up window (MAX_ADVANCE_HOURS).
"""

from flask import Blueprint, request, jsonify

from ..config import get_settings
from ..simulation import clock as clock_mod
from ..simulation.clock import SystemClock, get_test_clock

dev_bp = Blueprint("dev", __name__, url_prefix="/api/dev")

# Cap on a single advance: one engine catch-up window (max_catchup_hours default
# 8760h = 365d). Keeps a fat-fingered request from spinning the engine over an
# unreasonable number of hourly steps for every plant in the dev DB.
MAX_ADVANCE_HOURS = 8760


def _guard():
    """Belt-and-suspenders: even though the blueprint is only registered when
    enabled, re-check per request so a stale registration can't leak."""
    if not get_settings().test_clock_enabled:
        return jsonify({"error": "not found"}), 404
    return None


def _status() -> dict:
    tc = get_test_clock()
    return {
        "enabled": True,
        "offset_hours": round(tc.offset.total_seconds() / 3600.0, 4),
        "wall_now": SystemClock().now().isoformat(),
        "effective_now": tc.now().isoformat(),
    }


def _sync_all_living() -> int:
    """Bring every living, unharvested plant up to the (advanced) clock so the
    advance is visible without each client first re-reading its plant. Returns
    the number of plants synced. Uses the active (test) clock via the service
    default — no economy paths are touched."""
    from ..db.session import session_scope
    from ..db.models import Plant
    from ..services.simulation_service import SimulationService

    with session_scope() as s:
        plants = (
            s.query(Plant)
            .filter(Plant.harvested.is_(False), Plant.is_alive.is_(True))
            .all()
        )
        sim = SimulationService(s)
        for plant in plants:
            sim.sync(plant)
        return len(plants)


@dev_bp.get("/clock")
def clock_status():
    """Current test-clock state: offset, wall time, and effective (shifted) now."""
    blocked = _guard()
    if blocked:
        return blocked
    return jsonify(_status())


@dev_bp.post("/clock/advance")
def advance_clock():
    """Fast-forward grow time. Body: {"hours": N} and/or {"days": N} (> 0)."""
    blocked = _guard()
    if blocked:
        return blocked

    data = request.get_json(force=True, silent=True) or {}
    try:
        hours = float(data.get("hours", 0) or 0)
        days = float(data.get("days", 0) or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "hours and days must be numbers"}), 400

    total_hours = days * 24.0 + hours
    if not total_hours > 0:
        return jsonify({"error": "advance must be positive"}), 400
    if total_hours > MAX_ADVANCE_HOURS:
        return jsonify({"error": f"advance must be <= {MAX_ADVANCE_HOURS} hours"}), 400

    get_test_clock().advance(hours=total_hours)
    synced = _sync_all_living()
    return jsonify({**_status(), "synced_plants": synced})


@dev_bp.post("/clock/reset")
def reset_clock():
    """Reset the offset to zero (effective clock returns to wall time).

    Note: this rewinds only the CLOCK, not the plants — time already simulated
    is persisted (compute-on-read really advanced them). To fully reset state,
    reseed the dev database. After reset, plants freeze until wall time catches
    up to where they were last ticked."""
    blocked = _guard()
    if blocked:
        return blocked
    clock_mod.reset_test_clock()
    return jsonify(_status())
