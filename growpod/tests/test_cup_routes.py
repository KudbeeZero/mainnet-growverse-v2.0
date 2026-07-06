"""
HTTP-boundary coverage for the seasonal Cannabis Cup routes in
`api/game_api.py` (backed by `services/cup_service.py`).

Service-level Cup behaviour (entry fee/sink, deterministic judging, lifetime
champion rewards) is covered in `test_cup.py`; these tests drive the Flask
routes directly — request parsing, auth, status codes, and error mapping — for
the four public/authed endpoints:

    GET  /api/game/cup/current            (public)
    GET  /api/game/cup/<cup_id>/standings (public)
    GET  /api/game/cup/hall-of-fame       (public)
    POST /api/game/players/<id>/cup/enter (authed)

The current Cup is created lazily on read (`CupService.current_cup()` opens the
season's Cup compute-on-read), so the happy paths need no admin setup: hitting
the routes is enough. Entering needs a qualifying *unsold* harvest owned by the
player; we mint one over HTTP (advancing the plant to flowering first, since
harvest now requires it), then drive the enter route.
"""

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Plant
from growpodempire.enums import GrowthStage


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


def _new_player(client, username="cupper"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _advance_to_flowering(plant_id):
    """Jump a freshly-planted seed straight to flowering so it's harvestable,
    mirroring a real grow without waiting sim time. `harvest_plant()` now
    requires the plant to be flowering-or-later and alive (disruptor-sweep
    fix #1 — see `services/game_service.py`)."""
    with session_scope() as s:
        plant = s.get(Plant, plant_id)
        now = datetime.utcnow()
        plant.growth_stage = GrowthStage.FLOWERING.value
        plant.health = 90.0
        plant.last_tick_at = now
        plant.stage_entered_at = now


def _harvest(client, pid, key):
    """Grow + harvest a strain over HTTP so the player holds an unsold harvest
    eligible for Cup entry."""
    hdr = {"X-API-Key": key}
    sid = client.get("/api/game/strains").get_json()[0]["id"]
    stack = client.post(
        f"/api/game/players/{pid}/seeds/buy", json={"strain_id": sid}, headers=hdr
    ).get_json()
    pod = client.post(
        f"/api/game/players/{pid}/pods", json={"name": "T", "capacity": 2}, headers=hdr
    ).get_json()
    plant = client.post(
        f"/api/game/players/{pid}/plant",
        json={"seed_id": stack["id"], "pod_id": pod["id"]},
        headers=hdr,
    ).get_json()
    _advance_to_flowering(plant["id"])
    return client.post(
        f"/api/game/players/{pid}/plants/{plant['id']}/harvest",
        json={"sell": False},
        headers=hdr,
    ).get_json()


# --- GET /cup/current --------------------------------------------------------

def test_cup_current_opens_cup_and_is_public(client):
    # No auth header — the route is public and lazily opens the season's Cup.
    r = client.get("/api/game/cup/current")
    assert r.status_code == 200
    body = r.get_json()
    cup = body["cup"]
    assert cup is not None
    assert cup["status"] == "open"
    assert cup["id"]
    assert cup["edition"]
    # Brand-new Cup: empty standings, zero prize pool.
    assert body["standings"] == []
    assert cup["prize_pool"] == 0.0


def test_cup_current_reflects_entries_in_standings(client):
    pid, key = _new_player(client, "standee")
    h = _harvest(client, pid, key)
    client.post(
        f"/api/game/players/{pid}/cup/enter",
        json={"harvest_id": h["id"]},
        headers={"X-API-Key": key},
    )
    body = client.get("/api/game/cup/current").get_json()
    assert len(body["standings"]) == 1
    entry = body["standings"][0]
    assert entry["player_id"] == pid
    assert entry["score"] > 0
    # Entry fee flowed into the prize pool.
    assert body["cup"]["prize_pool"] == body["cup"]["entry_fee"]


# --- GET /cup/<cup_id>/standings --------------------------------------------

def test_standings_public_for_valid_cup(client):
    pid, key = _new_player(client, "viewer")
    h = _harvest(client, pid, key)
    client.post(
        f"/api/game/players/{pid}/cup/enter",
        json={"harvest_id": h["id"]},
        headers={"X-API-Key": key},
    )
    cup_id = client.get("/api/game/cup/current").get_json()["cup"]["id"]

    r = client.get(f"/api/game/cup/{cup_id}/standings")  # no auth — public
    assert r.status_code == 200
    rows = r.get_json()
    assert len(rows) == 1
    assert rows[0]["player_id"] == pid
    assert rows[0]["cup_id"] == cup_id


def test_standings_unknown_cup_404(client):
    r = client.get("/api/game/cup/does-not-exist/standings")
    assert r.status_code == 404
    assert "error" in r.get_json()


# --- GET /cup/hall-of-fame ---------------------------------------------------

def test_hall_of_fame_empty_before_any_champion(client):
    r = client.get("/api/game/cup/hall-of-fame")  # public
    assert r.status_code == 200
    # No Cup has been judged yet -> no champions recorded.
    assert r.get_json() == []


# --- POST /players/<id>/cup/enter -------------------------------------------

def test_enter_happy_path(client):
    pid, key = _new_player(client, "entrant")
    hdr = {"X-API-Key": key}
    h = _harvest(client, pid, key)
    before = client.get(
        f"/api/game/players/{pid}/wallet", headers=hdr
    ).get_json()["balance"]

    r = client.post(
        f"/api/game/players/{pid}/cup/enter", json={"harvest_id": h["id"]}, headers=hdr
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["score"] > 0
    assert body["entry_id"]
    assert body["cup_id"]
    # Entry fee (100 GROW sink) debited from the wallet, surfaced in the response.
    assert body["balance"] == before - 100.0


def test_enter_requires_harvest_id(client):
    pid, key = _new_player(client, "noharvestid")
    r = client.post(
        f"/api/game/players/{pid}/cup/enter", json={}, headers={"X-API-Key": key}
    )
    assert r.status_code == 400
    assert "harvest_id" in r.get_json()["error"]


def test_enter_unknown_harvest_400(client):
    pid, key = _new_player(client, "ghostharvest")
    r = client.post(
        f"/api/game/players/{pid}/cup/enter",
        json={"harvest_id": "no-such-harvest"},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400
    assert "error" in r.get_json()


def test_enter_someone_elses_harvest_rejected(client):
    pid_a, key_a = _new_player(client, "owner")
    pid_b, key_b = _new_player(client, "thief")
    h = _harvest(client, pid_a, key_a)  # harvest belongs to A
    # B tries to enter A's harvest -> "Harvest not found" -> 400.
    r = client.post(
        f"/api/game/players/{pid_b}/cup/enter",
        json={"harvest_id": h["id"]},
        headers={"X-API-Key": key_b},
    )
    assert r.status_code == 400


def test_enter_same_harvest_twice_rejected(client):
    pid, key = _new_player(client, "doubler")
    hdr = {"X-API-Key": key}
    h = _harvest(client, pid, key)
    first = client.post(
        f"/api/game/players/{pid}/cup/enter", json={"harvest_id": h["id"]}, headers=hdr
    )
    assert first.status_code == 201
    second = client.post(
        f"/api/game/players/{pid}/cup/enter", json={"harvest_id": h["id"]}, headers=hdr
    )
    assert second.status_code == 400
    assert "already entered" in second.get_json()["error"]


def test_enter_requires_auth(client):
    pid, key = _new_player(client, "noauth")
    h = _harvest(client, pid, key)
    # No X-API-Key header -> rejected before any Cup work.
    r = client.post(
        f"/api/game/players/{pid}/cup/enter", json={"harvest_id": h["id"]}
    )
    assert r.status_code in (401, 403)
