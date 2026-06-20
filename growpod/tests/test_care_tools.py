"""Free "care tool" actions — prune / train / boost.

These mirror the costed care actions (treat-pests/disease) but are FREE: they
must NOT post to the economy ledger, and they only touch existing Plant fields
(no migration). Coverage:

  - prune lowers pest/disease and raises health; a second prune in the same
    stage is rejected (once-per-stage guard);
  - train raises health;
  - boost floors water/nutrients and a second boost within the cooldown window
    is rejected (cooldown guard);
  - none of the three move the player's wallet balance (no ledger entries);
  - the three HTTP endpoints return 200.

Determinism: the service is driven with a FrozenClock (matching test_simulation).
"""

import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, LedgerEntry
from growpodempire.economy.ledger import balance
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.simulation_service import SimulationService
from growpodempire.simulation.clock import FrozenClock

BASE = datetime(2025, 1, 1, 0, 0, 0)


def _plant(session, slug="white-widow"):
    svc = GameService(session)
    p = svc.create_player("caretoolfarmer")
    strain = session.query(Strain).filter(Strain.slug == slug).one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    for attr in ("last_tick_at", "stage_entered_at", "planted_at"):
        setattr(plant, attr, BASE)
    pod.temperature = 24
    pod.humidity = 50
    pod.co2_level = 1000
    pod.light_intensity = 500
    pod.ph_level = 6.5
    session.flush()
    return p.id, pod, plant


def _ledger_count(session, pid):
    return (
        session.query(LedgerEntry)
        .filter(LedgerEntry.player_id == pid)
        .count()
    )


# --- prune -------------------------------------------------------------------

def test_prune_lowers_pest_disease_and_raises_health(db):
    with session_scope() as s:
        _, _, plant = _plant(s)
        plant.pest_level = 40.0
        plant.disease_level = 30.0
        plant.health = 50.0
        pid = plant.player_id
        sim = SimulationService(s, clock=FrozenClock(BASE))
        sim.prune(pid, plant.id)
        assert plant.pest_level == 25.0      # 40 - 15
        assert plant.disease_level == 20.0   # 30 - 10
        assert plant.health == 52.0          # 50 + 2


def test_prune_twice_same_stage_rejected(db):
    with session_scope() as s:
        _, _, plant = _plant(s)
        pid = plant.player_id
        sim = SimulationService(s, clock=FrozenClock(BASE))
        sim.prune(pid, plant.id)
        with pytest.raises(GameError):
            sim.prune(pid, plant.id)


def test_prune_is_free(db):
    with session_scope() as s:
        _, _, plant = _plant(s)
        pid = plant.player_id
        before_bal = balance(s, pid)
        before_entries = _ledger_count(s, pid)
        sim = SimulationService(s, clock=FrozenClock(BASE))
        sim.prune(pid, plant.id)
        assert balance(s, pid) == before_bal
        assert _ledger_count(s, pid) == before_entries


# --- train -------------------------------------------------------------------

def test_train_raises_health(db):
    with session_scope() as s:
        _, _, plant = _plant(s)
        plant.health = 40.0
        plant.pest_level = 10.0
        pid = plant.player_id
        sim = SimulationService(s, clock=FrozenClock(BASE))
        sim.train(pid, plant.id)
        assert plant.health == 43.0          # 40 + 3
        assert plant.pest_level == 5.0       # 10 - 5


def test_train_twice_same_stage_rejected(db):
    with session_scope() as s:
        _, _, plant = _plant(s)
        pid = plant.player_id
        sim = SimulationService(s, clock=FrozenClock(BASE))
        sim.train(pid, plant.id)
        with pytest.raises(GameError):
            sim.train(pid, plant.id)


def test_train_is_free(db):
    with session_scope() as s:
        _, _, plant = _plant(s)
        pid = plant.player_id
        before_bal = balance(s, pid)
        before_entries = _ledger_count(s, pid)
        sim = SimulationService(s, clock=FrozenClock(BASE))
        sim.train(pid, plant.id)
        assert balance(s, pid) == before_bal
        assert _ledger_count(s, pid) == before_entries


# --- boost -------------------------------------------------------------------

def test_boost_floors_water_and_nutrients(db):
    with session_scope() as s:
        _, _, plant = _plant(s)
        plant.water_level = 30.0
        plant.nutrient_level = 20.0
        plant.health = 50.0
        pid = plant.player_id
        sim = SimulationService(s, clock=FrozenClock(BASE))
        sim.boost(pid, plant.id)
        assert plant.water_level == 80.0     # floored up
        assert plant.nutrient_level == 80.0  # floored up
        assert plant.health == 54.0          # 50 + 4


def test_boost_does_not_lower_above_floor(db):
    with session_scope() as s:
        _, _, plant = _plant(s)
        plant.water_level = 95.0
        plant.nutrient_level = 90.0
        pid = plant.player_id
        sim = SimulationService(s, clock=FrozenClock(BASE))
        sim.boost(pid, plant.id)
        assert plant.water_level == 95.0     # kept (already above floor)
        assert plant.nutrient_level == 90.0


def test_boost_within_cooldown_rejected(db):
    with session_scope() as s:
        _, _, plant = _plant(s)
        pid = plant.player_id
        SimulationService(s, clock=FrozenClock(BASE)).boost(pid, plant.id)
        # 1 hour later is inside the 6h cooldown -> rejected.
        sim2 = SimulationService(s, clock=FrozenClock(BASE + timedelta(hours=1)))
        with pytest.raises(GameError):
            sim2.boost(pid, plant.id)


def test_boost_after_cooldown_allowed(db):
    with session_scope() as s:
        _, _, plant = _plant(s)
        pid = plant.player_id
        SimulationService(s, clock=FrozenClock(BASE)).boost(pid, plant.id)
        # 7 hours later clears the 6h cooldown.
        sim2 = SimulationService(s, clock=FrozenClock(BASE + timedelta(hours=7)))
        sim2.boost(pid, plant.id)  # no raise


def test_boost_is_free(db):
    with session_scope() as s:
        _, _, plant = _plant(s)
        pid = plant.player_id
        before_bal = balance(s, pid)
        before_entries = _ledger_count(s, pid)
        sim = SimulationService(s, clock=FrozenClock(BASE))
        sim.boost(pid, plant.id)
        assert balance(s, pid) == before_bal
        assert _ledger_count(s, pid) == before_entries


# --- HTTP endpoints ----------------------------------------------------------

@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


def _new_player(client, username="caretooler"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _planted(client, pid, key):
    hdr = {"X-API-Key": key}
    strains = client.get("/api/game/strains").get_json()
    sid = strains[0]["id"]
    stack = client.post(
        f"/api/game/players/{pid}/seeds/buy", json={"strain_id": sid}, headers=hdr
    ).get_json()
    pod = client.post(
        f"/api/game/players/{pid}/pods",
        json={"name": "Tent", "capacity": 2, "charge": False},
        headers=hdr,
    ).get_json()
    plant = client.post(
        f"/api/game/players/{pid}/plant",
        json={"seed_id": stack["id"], "pod_id": pod["id"]},
        headers=hdr,
    ).get_json()
    return plant["id"], pod["id"]


@pytest.mark.parametrize("action", ["prune", "train", "boost"])
def test_care_tool_endpoint_returns_200(client, action):
    pid, key = _new_player(client, f"http-{action}")
    plant_id, _ = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/{action}",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 200
    assert r.get_json()["id"] == plant_id
