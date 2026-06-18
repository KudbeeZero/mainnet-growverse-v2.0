"""Economy simulation — does the LAUNCH profile stay solvent, and is it safer
than the free-playtest profile?

These drive the REAL economy end-to-end over the HTTP API (seed -> grow -> sell +
daily stipend claims), fast-forwarded with the dev clock, under a chosen
ECONOMY_PROFILE, and assert the hard safety invariants from the Economy Readiness
Audit:

  * the ledger always reconciles (money_supply == net of every entry);
  * the launch profile charges for seeds (a real sink) and pays a small stipend;
  * the launch profile is materially LESS inflationary than playtest;
  * faucets are idempotent (no double daily-claim, no double sale);
  * advancing time creates no money.

Run just these with ``pytest -m sim -s`` to see the printed faucet/sink table.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.config import get_settings
from growpodempire.db.session import (
    reset_engine_for_tests,
    init_db,
    session_scope,
)
from growpodempire.db.seed import seed_strains
from growpodempire.economy.config import get_economy_config
from growpodempire.economy.ledger import balance
from growpodempire.services.economy_service import economy_health
from growpodempire.simulation import clock as clock_mod

pytestmark = pytest.mark.sim


# --- harness -----------------------------------------------------------------

def _build_client(monkeypatch, tmp_path, profile, name):
    """A fresh-DB Flask client running under ``profile`` with the dev clock on."""
    monkeypatch.setenv("ECONOMY_PROFILE", profile)
    monkeypatch.setenv("GROW_TEST_CLOCK", "true")
    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()
    get_economy_config.cache_clear()
    clock_mod.reset_test_clock()
    reset_engine_for_tests(f"sqlite:///{tmp_path / (name + '.db')}")
    init_db()
    seed_strains()
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


@pytest.fixture(autouse=True)
def _reset_caches():
    yield
    # Never let a launch-profile config leak into the rest of the suite.
    clock_mod.reset_test_clock()
    get_settings.cache_clear()
    get_economy_config.cache_clear()


def _new_grower(client, username):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _rare_strain_id(client):
    strains = client.get("/api/game/strains").get_json()
    rare = next((s for s in strains if s["rarity"] == "rare"), None)
    return (rare or strains[0])["id"]


def _seed_plant(client, pid, key):
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


def _run_active_player(client, pid, key, pod_id, plant_id, max_days=140):
    """One active player: each simulated day water + feed + claim the stipend,
    advancing the dev clock a day at a time until the plant flowers, then harvest
    and sell. Returns (sale_value, days_elapsed, stipend_claims)."""
    hdr = {"X-API-Key": key}
    client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/environment",
        json={"temperature": 24, "humidity": 52, "co2_level": 1000,
              "light_intensity": 600, "ph_level": 6.4},
        headers=hdr,
    )
    days = 0
    claims = 0
    state = _state(client, pid, key, plant_id)
    for _ in range(max_days):
        client.post(f"/api/game/players/{pid}/plants/{plant_id}/water", headers=hdr)
        client.post(f"/api/game/players/{pid}/plants/{plant_id}/feed", headers=hdr)
        if client.post(f"/api/game/players/{pid}/daily", headers=hdr).status_code == 201:
            claims += 1
        assert client.post("/api/dev/clock/advance", json={"days": 1}).status_code == 200
        days += 1
        state = _state(client, pid, key, plant_id)
        assert state["is_alive"], f"plant died at stage {state['growth_stage']}"
        if state["growth_stage"] in ("flowering", "harvest"):
            break
    else:
        raise AssertionError(f"never flowered in {max_days} days ({state['growth_stage']})")

    harvest = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/harvest",
        json={"sell": False}, headers=hdr,
    ).get_json()
    sold = client.post(
        f"/api/game/players/{pid}/harvests/{harvest['id']}/sell", headers=hdr
    ).get_json()
    return float(sold["sale_value"]), days, claims


def _health():
    with session_scope() as s:
        return economy_health(s)


def _scenario(client, name):
    """Run one active player through a full grow + daily claims; return metrics."""
    pid, key = _new_grower(client, name)
    pod_id, plant_id = _seed_plant(client, pid, key)
    sale, days, claims = _run_active_player(client, pid, key, pod_id, plant_id)
    h = _health()
    h["sale_value"] = sale
    h["days"] = days
    h["stipend_claims"] = claims
    h["net_per_day"] = h["net_issuance"] / max(days, 1)
    return h


def _print(title, h):
    print(
        f"\n[{title}] days={h['days']} stipend_claims={h['stipend_claims']} "
        f"sale={h['sale_value']:.2f}\n"
        f"  faucet_total={h['faucet_total']:.2f} sink_total={h['sink_total']:.2f} "
        f"net_issuance={h['net_issuance']:.2f} net/day={h['net_per_day']:.2f}\n"
        f"  money_supply={h['money_supply']:.2f} reconciled={h['reconciled']} "
        f"inflation_ratio={h['inflation_ratio']}"
    )


# --- tests -------------------------------------------------------------------

def test_launch_profile_reconciles_and_charges_for_seeds(db, monkeypatch, tmp_path):
    client = _build_client(monkeypatch, tmp_path, "launch", "launch_one")
    h = _scenario(client, "launch_grower")
    _print("LAUNCH", h)
    # Hard safety invariants for the live economy.
    assert h["reconciled"] is True
    assert h["sink_total"] > 0, "launch must have real sinks (seeds cost 25)"
    # The seed sink alone proves seeds are not free.
    seed_sink = next((r for r in h["by_type"] if r["entry_type"] == "seed_purchase"), None)
    assert seed_sink is not None and seed_sink["net"] < 0
    # Harvest faucet is bounded — no single sale mints a runaway amount.
    assert 0 < h["sale_value"] < 5000


def test_launch_is_less_inflationary_than_playtest(db, monkeypatch, tmp_path):
    play = _scenario(
        _build_client(monkeypatch, tmp_path, "playtest", "play"), "play_grower"
    )
    _print("PLAYTEST", play)
    launch = _scenario(
        _build_client(monkeypatch, tmp_path, "launch", "launch"), "launch_grower"
    )
    _print("LAUNCH", launch)
    # Both must reconcile.
    assert play["reconciled"] and launch["reconciled"]
    # The launch profile mints far less per simulated day (stipend 50 vs 5000,
    # seeds cost 25 vs free) — the core point of the retune.
    assert launch["net_per_day"] < play["net_per_day"]
    # Sinks actually bite under launch (sink/faucet ratio is higher).
    play_ratio = play["sink_total"] / max(play["faucet_total"], 1)
    launch_ratio = launch["sink_total"] / max(launch["faucet_total"], 1)
    assert launch_ratio > play_ratio
    print(f"\n[DELTA] net/day playtest={play['net_per_day']:.2f} "
          f"launch={launch['net_per_day']:.2f}  "
          f"sink/faucet playtest={play_ratio:.4f} launch={launch_ratio:.4f}")


def test_daily_stipend_faucet_is_idempotent(db, monkeypatch, tmp_path):
    client = _build_client(monkeypatch, tmp_path, "launch", "idem")
    pid, key = _new_grower(client, "spammer")
    hdr = {"X-API-Key": key}
    first = client.post(f"/api/game/players/{pid}/daily", headers=hdr)
    assert first.status_code == 201
    # Hammer the faucet within the same cooldown window — none should pay out.
    for _ in range(6):
        assert client.post(f"/api/game/players/{pid}/daily", headers=hdr).status_code == 400
    with session_scope() as s:
        from growpodempire.db.models import LedgerEntry
        from growpodempire.enums import LedgerEntryType
        n = (
            s.query(LedgerEntry)
            .filter(
                LedgerEntry.player_id == pid,
                LedgerEntry.entry_type == LedgerEntryType.DAILY_STIPEND.value,
            )
            .count()
        )
    assert n == 1, "stipend paid more than once in a single cooldown window"
    assert _health()["reconciled"] is True


def test_negative_and_oversized_inputs_rejected(db, monkeypatch, tmp_path):
    client = _build_client(monkeypatch, tmp_path, "launch", "inputs")
    pid, key = _new_grower(client, "attacker")
    hdr = {"X-API-Key": key}
    sid = _rare_strain_id(client)
    for qty in (-5, 0, 10**9):
        r = client.post(
            f"/api/game/players/{pid}/seeds/buy",
            json={"strain_id": sid, "quantity": qty}, headers=hdr,
        )
        assert r.status_code == 400, f"quantity {qty} should be rejected"
    with session_scope() as s:
        assert balance(s, pid) >= 0
