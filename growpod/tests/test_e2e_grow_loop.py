"""
End-to-end grow loop (STEP 4, directive BE-004) — driven entirely through the
PUBLIC HTTP API and fast-forwarded with the dev/test-only simulation test clock
shipped in STEP 3 (`POST /api/dev/clock/advance`).

Exercises the core loop the whole game is built around:

    seed -> plant -> grow -> flower -> harvest -> sell

over the wire (Flask test client), advancing grow time via the dev clock instead
of waiting real days. The plant is cared for between time jumps exactly as a real
player would (set the climate, then water + feed), so it stays healthy on the way
to flowering.

Also pins the load-bearing economy invariant from the directive (BE-A08):
fast-forwarding time posts NO ledger entries — only player actions (feeding) and
the sale itself ever touch money.

STEP 4.5 (directive BE-004.5): `GameService` now defaults to `active_clock()`
(like `SimulationService`), so harvest/cure/sell — and market/auction expiry —
also advance under the dev clock. `test_cure_advances_under_dev_clock` exercises
the curing step over the HTTP boundary, closing the RISK #1 carried finding.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.config import get_settings
from growpodempire.db.models import LedgerEntry
from growpodempire.db.session import session_scope
from growpodempire.economy.ledger import balance
from growpodempire.enums import LedgerEntryType
from growpodempire.simulation import clock as clock_mod


@pytest.fixture()
def clock_client(db, monkeypatch):
    """Flask test client with the dev simulation clock ENABLED (cache cleared,
    shared offset reset before and after)."""
    from growpodempire.api.flask_api import create_app

    monkeypatch.setenv("GROW_TEST_CLOCK", "true")
    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()
    clock_mod.reset_test_clock()
    try:
        yield create_app(init_database=False).test_client()
    finally:
        clock_mod.reset_test_clock()
        get_settings.cache_clear()


# --- helpers -----------------------------------------------------------------

def _new_grower(client, username="e2e_grower"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _rare_strain_id(client):
    """A rare strain so the resulting harvest is NFT-eligible (rarity carries to
    the harvest snapshot) — keeps the e2e harvest mintable for downstream tests."""
    strains = client.get("/api/game/strains").get_json()
    rare = next((s for s in strains if s["rarity"] == "rare"), None)
    return (rare or strains[0])["id"]


def _seed_plant(client, pid, key):
    """Seed -> Plant: buy a seed, build a pod, plant it. Returns (pod_id, plant_id)."""
    hdr = {"X-API-Key": key}
    sid = _rare_strain_id(client)
    stack = client.post(
        f"/api/game/players/{pid}/seeds/buy", json={"strain_id": sid}, headers=hdr
    ).get_json()
    pod = client.post(
        f"/api/game/players/{pid}/pods", json={"name": "Tent", "capacity": 4}, headers=hdr
    ).get_json()
    plant = client.post(
        f"/api/game/players/{pid}/plant",
        json={"seed_id": stack["id"], "pod_id": pod["id"]},
        headers=hdr,
    ).get_json()
    return pod["id"], plant["id"]


def _state(client, pid, key, plant_id):
    return client.get(
        f"/api/game/players/{pid}/plants/{plant_id}/state", headers={"X-API-Key": key}
    ).get_json()


def _grow_to_flowering(client, pid, key, pod_id, plant_id, step_days=3, max_steps=40):
    """Care for the plant and fast-forward the dev clock until it flowers.

    Mirrors how a real player grows: set a healthy climate once, then water + feed
    before each stretch of (simulated) time. The step cap is generous so a slightly
    slower (health-throttled) run still reaches flowering; the loop breaks as soon
    as it does. Returns the flowering state.
    """
    hdr = {"X-API-Key": key}
    # Climate inside every health band and below the pest/disease humidity
    # thresholds, so a cared-for plant stays healthy across the whole run.
    client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/environment",
        json={
            "temperature": 24,
            "humidity": 52,
            "co2_level": 1000,
            "light_intensity": 600,
            "ph_level": 6.4,
        },
        headers=hdr,
    )
    state = _state(client, pid, key, plant_id)
    for _ in range(max_steps):
        client.post(f"/api/game/players/{pid}/plants/{plant_id}/water", headers=hdr)
        client.post(f"/api/game/players/{pid}/plants/{plant_id}/feed", headers=hdr)
        adv = client.post("/api/dev/clock/advance", json={"days": step_days})
        assert adv.status_code == 200
        state = _state(client, pid, key, plant_id)
        assert state["is_alive"], f"plant died during grow at stage {state['growth_stage']}"
        if state["growth_stage"] in ("flowering", "harvest"):
            return state
    raise AssertionError(
        f"plant never reached flowering within {max_steps} steps "
        f"(last stage: {state['growth_stage']})"
    )


# --- tests -------------------------------------------------------------------

def test_full_grow_loop_seed_to_sale(clock_client):
    """seed -> plant -> grow -> flower -> harvest -> sell, entirely over HTTP."""
    client = clock_client
    pid, key = _new_grower(client)
    hdr = {"X-API-Key": key}

    # Seed -> Plant: a freshly planted seed starts at the seed stage.
    pod_id, plant_id = _seed_plant(client, pid, key)
    assert _state(client, pid, key, plant_id)["growth_stage"] == "seed"

    # Grow -> Flower: fast-forward (with care) until the plant flowers.
    flowering = _grow_to_flowering(client, pid, key, pod_id, plant_id)
    assert flowering["growth_stage"] in ("flowering", "harvest")
    assert flowering["is_alive"] is True

    # Harvest: keep it (sell=False) so we can sell explicitly in the next step.
    # Yield/quality are computed server-side from the plant's grown state.
    resp = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/harvest",
        json={"sell": False},
        headers=hdr,
    )
    assert resp.status_code == 201
    harvest = resp.get_json()
    assert harvest["sold"] is False
    assert harvest["weight_g"] > 0
    harvest_id = harvest["id"]
    assert _state(client, pid, key, plant_id)["harvested"] is True

    # Sell: to the NPC market. Balance rises by exactly the sale ledger entry.
    with session_scope() as s:
        before = balance(s, pid)
    sale = client.post(
        f"/api/game/players/{pid}/harvests/{harvest_id}/sell", headers=hdr
    )
    assert sale.status_code == 200
    sold = sale.get_json()
    assert sold["sold"] is True
    assert sold["sale_value"] > 0

    with session_scope() as s:
        after = balance(s, pid)
        entry = (
            s.query(LedgerEntry)
            .filter(
                LedgerEntry.player_id == pid,
                LedgerEntry.entry_type == LedgerEntryType.HARVEST_SALE.value,
                LedgerEntry.ref_id == harvest_id,
            )
            .one()
        )
    assert entry.amount > 0
    assert after - before == entry.amount


def test_harvest_cannot_be_sold_twice(clock_client):
    """Once sold to the NPC market, a harvest can't be sold again (no double faucet)."""
    client = clock_client
    pid, key = _new_grower(client, "double_seller")
    hdr = {"X-API-Key": key}
    pod_id, plant_id = _seed_plant(client, pid, key)
    _grow_to_flowering(client, pid, key, pod_id, plant_id)

    h = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/harvest",
        json={"sell": False},
        headers=hdr,
    ).get_json()
    first = client.post(f"/api/game/players/{pid}/harvests/{h['id']}/sell", headers=hdr)
    assert first.status_code == 200
    again = client.post(f"/api/game/players/{pid}/harvests/{h['id']}/sell", headers=hdr)
    assert again.status_code == 400


def test_growth_advance_posts_no_ledger_entries(clock_client):
    """BE-A08 ledger integrity: fast-forwarding grow time touches NO money.

    Advancing the clock (the only action here) must add zero ledger entries — the
    economy invariant the dev clock is built to preserve, asserted end-to-end
    through repeated HTTP advances rather than a single in-process one.
    """
    client = clock_client
    pid, key = _new_grower(client, "ledger_watcher")
    _seed_plant(client, pid, key)

    with session_scope() as s:
        before = s.query(LedgerEntry).filter(LedgerEntry.player_id == pid).count()

    for _ in range(5):
        assert client.post("/api/dev/clock/advance", json={"days": 4}).status_code == 200

    with session_scope() as s:
        after = s.query(LedgerEntry).filter(LedgerEntry.player_id == pid).count()
    assert after == before


def test_cure_advances_under_dev_clock(clock_client):
    """STEP 4.5 (BE-004.5): cure timing is dev-clock-drivable over HTTP.

    `GameService` now defaults to `active_clock()` (like `SimulationService`), so a
    committed cure can be fast-forwarded with `POST /api/dev/clock/advance`: the cure
    cannot finish until the dev clock has advanced past its target window, and
    finishing then raises quality. This closes RISK #1 for the cure path.
    """
    client = clock_client
    pid, key = _new_grower(client, "curing_grower")
    hdr = {"X-API-Key": key}

    pod_id, plant_id = _seed_plant(client, pid, key)
    _grow_to_flowering(client, pid, key, pod_id, plant_id)

    # Harvest and keep it (sell=False) so we can cure it.
    harvest = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/harvest",
        json={"sell": False},
        headers=hdr,
    ).get_json()
    harvest_id = harvest["id"]
    quality_before = harvest["quality"]

    # Start a committed 72h cure.
    started = client.post(
        f"/api/game/players/{pid}/harvests/{harvest_id}/cure",
        json={"target_hours": 72},
        headers=hdr,
    )
    assert started.status_code == 200
    assert started.get_json()["cure_status"] == "curing"

    # Before the dev clock advances, the cure is not finished yet -> 400.
    early = client.post(
        f"/api/game/players/{pid}/harvests/{harvest_id}/cure/finish",
        json={"sell": False},
        headers=hdr,
    )
    assert early.status_code == 400  # "Cure not finished yet (...)"

    # Fast-forward past the cure window. The STEP 4.5 fix means GameService's
    # cure path reads this dev-clock advance (it previously used wall time).
    adv = client.post("/api/dev/clock/advance", json={"hours": 80})
    assert adv.status_code == 200

    # Now the cure finishes and quality rises by the cure bonus.
    finished = client.post(
        f"/api/game/players/{pid}/harvests/{harvest_id}/cure/finish",
        json={"sell": False},
        headers=hdr,
    )
    assert finished.status_code == 200
    body = finished.get_json()
    assert body["cure_status"] == "cured"
    assert body["cure_quality_bonus"] > 0
    assert body["quality"] > quality_before

    # BE-A08: the cure path (start + finish, no sale) and the clock advance post
    # NO ledger entries — curing is not a faucet.
    with session_scope() as s:
        sale_rows = (
            s.query(LedgerEntry)
            .filter(
                LedgerEntry.player_id == pid,
                LedgerEntry.entry_type == LedgerEntryType.HARVEST_SALE.value,
            )
            .count()
        )
    assert sale_rows == 0
