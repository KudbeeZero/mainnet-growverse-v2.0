"""HTTP-boundary coverage for the FTUE (first-time-user-experience) tutorial
routes in ``api/game_api.py``, backed by ``services/ftue_service.py`` and the
scripted ``ai/ftue_coach.py`` (an offline MOCK coach — no live AI, works in CI).

Companion to ``test_ftue.py`` (service-level step machine) and ``test_http_boundary.py``
(Flask test-client style). These drive the three FTUE routes through the request
boundary — auth, request parsing, status codes, and the replay/out-of-sync guard:

    GET  /api/game/players/<id>/ftue/status
    GET  /api/game/players/<id>/ftue/coaching/<step>
    POST /api/game/players/<id>/ftue/advance
"""

import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


def _new_player(client, username="ftue"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


# --- ftue/status -------------------------------------------------------------

def test_status_brand_new_player_starts_at_welcome(client):
    pid, key = _new_player(client, "fresh")
    r = client.get(f"/api/game/players/{pid}/ftue/status", headers={"X-API-Key": key})
    assert r.status_code == 200
    body = r.get_json()
    assert body["step"] == "welcome"
    assert body["completed"] is False
    assert body["completed_at"] is None
    assert body["plant_id"] is None


def test_status_requires_auth(client):
    pid, _ = _new_player(client, "statusnoauth")
    r = client.get(f"/api/game/players/{pid}/ftue/status")
    assert r.status_code == 401


def test_status_rejects_wrong_api_key(client):
    pid, _ = _new_player(client, "statusbadkey")
    r = client.get(
        f"/api/game/players/{pid}/ftue/status", headers={"X-API-Key": "nope"}
    )
    assert r.status_code == 403


def test_status_unknown_player_is_404(client):
    r = client.get(
        "/api/game/players/does-not-exist/ftue/status",
        headers={"X-API-Key": "whatever"},
    )
    assert r.status_code == 404


# --- ftue/coaching/<step> ----------------------------------------------------

def test_coaching_is_scripted_mock_with_step_specific_action(client):
    pid, key = _new_player(client, "coachee")
    h = {"X-API-Key": key}

    water = client.get(f"/api/game/players/{pid}/ftue/coaching/water", headers=h)
    assert water.status_code == 200
    body = water.get_json()
    assert body["provider"] == "ftue_coach"
    assert body["suggestions"][0]["action"] == "water"

    # A narrative step (welcome) carries no care suggestion.
    welcome = client.get(
        f"/api/game/players/{pid}/ftue/coaching/welcome", headers=h
    ).get_json()
    assert welcome["provider"] == "ftue_coach"
    assert welcome["suggestions"] == []


def test_coaching_unknown_step_returns_fallback(client):
    # coach_for_step falls back (does not raise) for an unscripted step, so the
    # route serves a generic 200 report rather than erroring.
    pid, key = _new_player(client, "fallbackcoach")
    r = client.get(
        f"/api/game/players/{pid}/ftue/coaching/bogus-step",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["provider"] == "ftue_coach"
    assert body["summary"]  # non-empty fallback line


def test_coaching_requires_auth(client):
    pid, _ = _new_player(client, "coachnoauth")
    r = client.get(f"/api/game/players/{pid}/ftue/coaching/water")
    assert r.status_code == 401


# --- ftue/advance ------------------------------------------------------------

def test_advance_walks_the_step_machine_forward(client):
    pid, key = _new_player(client, "walker")
    h = {"X-API-Key": key}

    # welcome -> plant (narrative step, no game action).
    r = client.post(
        f"/api/game/players/{pid}/ftue/advance", json={"step": "welcome"}, headers=h
    )
    assert r.status_code == 200
    assert r.get_json()["step"] == "plant"

    # plant -> water: performs the real plant action and records the tutorial plant.
    r = client.post(
        f"/api/game/players/{pid}/ftue/advance", json={"step": "plant"}, headers=h
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["step"] == "water"
    assert body["plant_id"]  # a tutorial plant now exists

    # The status route reflects the advanced step + the planted tutorial plant.
    status = client.get(
        f"/api/game/players/{pid}/ftue/status", headers=h
    ).get_json()
    assert status["step"] == "water"
    assert status["plant_id"] == body["plant_id"]
    assert status["completed"] is False


def test_advance_requires_step_in_body(client):
    pid, key = _new_player(client, "nostep")
    r = client.post(
        f"/api/game/players/{pid}/ftue/advance", json={}, headers={"X-API-Key": key}
    )
    assert r.status_code == 400
    assert "step" in r.get_json()["error"].lower()


def test_advance_out_of_sync_is_rejected(client):
    pid, key = _new_player(client, "outofsync")
    # Player is at "welcome"; claiming to be on a later step is refused.
    r = client.post(
        f"/api/game/players/{pid}/ftue/advance",
        json={"step": "harvest"},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400
    assert "out of sync" in r.get_json()["error"].lower()


def test_advance_invalid_step_is_rejected(client):
    pid, key = _new_player(client, "badstep")
    # A step that isn't even in the machine is out-of-sync with "welcome".
    r = client.post(
        f"/api/game/players/{pid}/ftue/advance",
        json={"step": "not-a-real-step"},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_advance_past_completed_is_guarded(client):
    pid, key = _new_player(client, "finisher")
    h = {"X-API-Key": key}

    # Walk the whole tutorial to "completed".
    for cur in ["welcome", "plant", "water", "environment", "grow", "harvest"]:
        r = client.post(
            f"/api/game/players/{pid}/ftue/advance", json={"step": cur}, headers=h
        )
        assert r.status_code == 200, r.get_json()

    status = client.get(f"/api/game/players/{pid}/ftue/status", headers=h).get_json()
    assert status["step"] == "completed"
    assert status["completed"] is True and status["completed_at"]

    # Replay guard: no advancing once the tutorial is done.
    r = client.post(
        f"/api/game/players/{pid}/ftue/advance", json={"step": "completed"}, headers=h
    )
    assert r.status_code == 400
    assert "already completed" in r.get_json()["error"].lower()


def test_advance_requires_auth(client):
    pid, _ = _new_player(client, "advnoauth")
    r = client.post(
        f"/api/game/players/{pid}/ftue/advance", json={"step": "welcome"}
    )
    assert r.status_code == 401


def test_advance_rejects_wrong_api_key(client):
    pid, _ = _new_player(client, "advbadkey")
    r = client.post(
        f"/api/game/players/{pid}/ftue/advance",
        json={"step": "welcome"},
        headers={"X-API-Key": "wrong"},
    )
    assert r.status_code == 403


def test_full_walkthrough_credits_grow_via_npc_sale(client):
    # End-to-end through the HTTP boundary: completing the tutorial sells the
    # first harvest to the NPC market, crediting GROW above the 500 signup grant.
    from growpodempire.db.session import session_scope
    from growpodempire.economy.ledger import balance

    pid, key = _new_player(client, "earner")
    h = {"X-API-Key": key}
    for cur in ["welcome", "plant", "water", "environment", "grow", "harvest"]:
        assert (
            client.post(
                f"/api/game/players/{pid}/ftue/advance", json={"step": cur}, headers=h
            ).status_code
            == 200
        )

    with session_scope() as s:
        assert balance(s, pid) > Decimal("500.000000")
