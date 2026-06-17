"""First-Time-User-Experience: the guided tutorial walks a new player through the
core loop (plant → water → environment → grow → harvest) on existing rails."""

import os
import sys
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.api.flask_api import create_app
from growpodempire.db.session import session_scope
from growpodempire.economy.ledger import balance


@pytest.fixture()
def client(db):
    return create_app(init_database=False).test_client()


def _signup(client, username):
    r = client.post("/api/game/players", json={"username": username})
    assert r.status_code == 201, r.get_json()
    body = r.get_json()
    return body["id"], body["api_key"]


def test_ftue_full_flow_reaches_first_harvest(client):
    pid, key = _signup(client, "ftue_player")
    h = {"X-API-Key": key}

    # A brand-new player starts the tutorial at "welcome".
    assert client.get(f"/api/game/players/{pid}/ftue/status", headers=h).get_json()["step"] == "welcome"

    # Walk every step; each advance performs the real game action and moves on.
    current = "welcome"
    for nxt in ["plant", "water", "environment", "grow", "harvest", "completed"]:
        r = client.post(f"/api/game/players/{pid}/ftue/advance", json={"step": current}, headers=h)
        assert r.status_code == 200, r.get_json()
        assert r.get_json()["step"] == nxt
        current = nxt

    status = client.get(f"/api/game/players/{pid}/ftue/status", headers=h).get_json()
    assert status["step"] == "completed"
    assert status["completed"] is True and status["completed_at"]
    assert status["plant_id"]  # the tutorial plant was created

    # The harvest sold to the NPC market, crediting GROW beyond the 500 starting grant.
    with session_scope() as s:
        assert balance(s, pid) > Decimal("500.000000")


def test_ftue_coaching_is_scripted_and_step_specific(client):
    pid, key = _signup(client, "coachee")
    h = {"X-API-Key": key}
    body = client.get(f"/api/game/players/{pid}/ftue/coaching/water", headers=h).get_json()
    assert body["provider"] == "ftue_coach"
    assert body["suggestions"][0]["action"] == "water"
    # A different step gives different scripted guidance.
    harvest = client.get(f"/api/game/players/{pid}/ftue/coaching/harvest", headers=h).get_json()
    assert harvest["suggestions"][0]["action"] == "harvest"


def test_ftue_advance_out_of_sync_is_rejected(client):
    pid, key = _signup(client, "skipper")
    h = {"X-API-Key": key}
    # Player is at "welcome"; claiming to be at "harvest" must be refused.
    r = client.post(f"/api/game/players/{pid}/ftue/advance", json={"step": "harvest"}, headers=h)
    assert r.status_code == 400
    assert "out of sync" in r.get_json()["error"].lower()


def test_ftue_cannot_advance_past_completed(client):
    pid, key = _signup(client, "finisher")
    h = {"X-API-Key": key}
    for cur in ["welcome", "plant", "water", "environment", "grow", "harvest"]:
        client.post(f"/api/game/players/{pid}/ftue/advance", json={"step": cur}, headers=h)
    # Tutorial is done; further advances are refused (no replay).
    r = client.post(f"/api/game/players/{pid}/ftue/advance", json={"step": "completed"}, headers=h)
    assert r.status_code == 400


def test_ftue_advance_requires_auth(client):
    pid, _ = _signup(client, "noauth")
    r = client.post(f"/api/game/players/{pid}/ftue/advance", json={"step": "welcome"})
    assert r.status_code == 401
