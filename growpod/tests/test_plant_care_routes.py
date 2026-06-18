"""
HTTP-boundary coverage for the plant/pod *care* routes in ``game_api.py``
(water / feed / treat-pests / treat-disease / weather / environment / events).

These exercise request parsing, per-player API-key auth, status codes, and the
GameError -> HTTP error mapping for the care surface, which was previously only
covered at the service layer (``test_simulation*`` / ``test_pod_automation.py``).

Setup is done entirely over HTTP (the way a client would): create player -> buy a
seed -> create a pod -> plant -> get the plant id. Seeds are free in the live test
balance, so no funding is required to reach a planted plant.

Note on status codes: the care routes map ``GameError`` (unknown plant/pod, dead
plant, validation) through ``_error`` whose default status is **400** — so an
unknown plant/pod surfaces as 400 here, not 404. The 404 path belongs to the auth
guard (``require_player`` returns 404 for an unknown *player*). Both are asserted
against the real implementation rather than the idealised contract.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


# --- HTTP setup helpers ------------------------------------------------------

def _new_player(client, username="carer"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _planted(client, pid, key, strain_rarity=None):
    """Buy a seed, create a pod, plant it; return (plant_id, pod_id)."""
    hdr = {"X-API-Key": key}
    strains = client.get("/api/game/strains").get_json()
    if strain_rarity is not None:
        sid = next(s for s in strains if s["rarity"] == strain_rarity)["id"]
    else:
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


# --- water -------------------------------------------------------------------

def test_water_default_amount(client):
    pid, key = _new_player(client, "waterer")
    plant_id, _ = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/water",
        json={},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["id"] == plant_id
    # Default water bump leaves the plant hydrated.
    assert body["water_level"] > 0


def test_water_explicit_amount(client):
    pid, key = _new_player(client, "waterexp")
    plant_id, _ = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/water",
        json={"amount": 5},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 200
    assert r.get_json()["water_level"] <= 100.0


def test_water_unknown_plant_is_error(client):
    pid, key = _new_player(client, "waterghost")
    r = client.post(
        f"/api/game/players/{pid}/plants/does-not-exist/water",
        json={},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400
    assert "error" in r.get_json()


def test_water_requires_auth(client):
    pid, key = _new_player(client, "waternoauth")
    plant_id, _ = _planted(client, pid, key)
    r = client.post(f"/api/game/players/{pid}/plants/{plant_id}/water", json={})
    assert r.status_code == 401


def test_water_wrong_api_key_forbidden(client):
    pid, key = _new_player(client, "waterwrong")
    plant_id, _ = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/water",
        json={},
        headers={"X-API-Key": "not-the-key"},
    )
    assert r.status_code == 403


def test_water_unknown_player_404(client):
    # require_player returns 404 for an unknown player (before route logic).
    r = client.post(
        "/api/game/players/nobody/plants/whatever/water",
        json={},
        headers={"X-API-Key": "any"},
    )
    assert r.status_code == 404


# --- feed --------------------------------------------------------------------

def test_feed_default_amount(client):
    pid, key = _new_player(client, "feeder")
    plant_id, _ = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/feed",
        json={},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 200
    assert r.get_json()["nutrient_level"] > 0


def test_feed_unknown_plant_is_error(client):
    pid, key = _new_player(client, "feedghost")
    r = client.post(
        f"/api/game/players/{pid}/plants/does-not-exist/feed",
        json={},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_feed_requires_auth(client):
    pid, key = _new_player(client, "feednoauth")
    plant_id, _ = _planted(client, pid, key)
    r = client.post(f"/api/game/players/{pid}/plants/{plant_id}/feed", json={})
    assert r.status_code == 401


# --- treat-pests -------------------------------------------------------------

def test_treat_pests_clears_pests(client):
    pid, key = _new_player(client, "pester")
    plant_id, _ = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/treat-pests",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 200
    assert r.get_json()["pest_level"] == 0.0


def test_treat_pests_unknown_plant_is_error(client):
    pid, key = _new_player(client, "pestghost")
    r = client.post(
        f"/api/game/players/{pid}/plants/does-not-exist/treat-pests",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_treat_pests_requires_auth(client):
    pid, key = _new_player(client, "pestnoauth")
    plant_id, _ = _planted(client, pid, key)
    r = client.post(f"/api/game/players/{pid}/plants/{plant_id}/treat-pests")
    assert r.status_code == 401


# --- treat-disease -----------------------------------------------------------

def test_treat_disease_clears_disease(client):
    pid, key = _new_player(client, "dis")
    plant_id, _ = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/treat-disease",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 200
    assert r.get_json()["disease_level"] == 0.0


def test_treat_disease_unknown_plant_is_error(client):
    pid, key = _new_player(client, "disghost")
    r = client.post(
        f"/api/game/players/{pid}/plants/does-not-exist/treat-disease",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_treat_disease_wrong_key_forbidden(client):
    pid, key = _new_player(client, "diswrong")
    plant_id, _ = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/treat-disease",
        headers={"X-API-Key": "bogus"},
    )
    assert r.status_code == 403


# --- weather -----------------------------------------------------------------

def test_weather_roll_happy_path(client):
    pid, key = _new_player(client, "weatherer")
    _, pod_id = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/weather",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 201
    body = r.get_json()
    assert "event" in body
    assert "environment" in body
    # Server-randomised environment carries the five sensor channels.
    for k in ("temperature", "humidity", "co2_level", "light_intensity", "ph_level"):
        assert k in body["environment"]


def test_weather_unknown_pod_is_error(client):
    pid, key = _new_player(client, "weatherghost")
    r = client.post(
        f"/api/game/players/{pid}/pods/does-not-exist/weather",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_weather_requires_auth(client):
    pid, key = _new_player(client, "weathernoauth")
    _, pod_id = _planted(client, pid, key)
    r = client.post(f"/api/game/players/{pid}/pods/{pod_id}/weather")
    assert r.status_code == 401


# --- environment -------------------------------------------------------------

_VALID_ENV = {
    "temperature": 24,
    "humidity": 55,
    "co2_level": 1000,
    "light_intensity": 600,
    "ph_level": 6.2,
}


def test_set_environment_happy_path(client):
    pid, key = _new_player(client, "enver")
    _, pod_id = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/environment",
        json=dict(_VALID_ENV),
        headers={"X-API-Key": key},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["id"] == pod_id
    assert body["temperature"] == 24


def test_set_environment_missing_field_400(client):
    pid, key = _new_player(client, "envmissing")
    _, pod_id = _planted(client, pid, key)
    partial = dict(_VALID_ENV)
    partial.pop("ph_level")
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/environment",
        json=partial,
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_set_environment_nonnumeric_400(client):
    pid, key = _new_player(client, "envbad")
    _, pod_id = _planted(client, pid, key)
    bad = dict(_VALID_ENV)
    bad["temperature"] = "hot"
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/environment",
        json=bad,
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_set_environment_out_of_bounds_400(client):
    pid, key = _new_player(client, "envoob")
    _, pod_id = _planted(client, pid, key)
    bad = dict(_VALID_ENV)
    bad["ph_level"] = 99  # max is 14
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/environment",
        json=bad,
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_set_environment_unknown_pod_is_error(client):
    pid, key = _new_player(client, "envghost")
    r = client.post(
        f"/api/game/players/{pid}/pods/does-not-exist/environment",
        json=dict(_VALID_ENV),
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_set_environment_requires_auth(client):
    pid, key = _new_player(client, "envnoauth")
    _, pod_id = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/environment", json=dict(_VALID_ENV)
    )
    assert r.status_code == 401


# --- events (public GET) -----------------------------------------------------

def test_events_returns_logged_actions(client):
    pid, key = _new_player(client, "eventer")
    plant_id, _ = _planted(client, pid, key)
    # Generate a couple of events via care actions.
    client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/water",
        json={},
        headers={"X-API-Key": key},
    )
    client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/treat-pests",
        headers={"X-API-Key": key},
    )
    # Events are public (no auth).
    r = client.get(f"/api/game/plants/{plant_id}/events")
    assert r.status_code == 200
    events = r.get_json()
    assert isinstance(events, list)
    types = {e["event_type"] for e in events}
    assert "watered" in types
    assert "pest_treated" in types


def test_events_respects_limit(client):
    pid, key = _new_player(client, "eventlimit")
    plant_id, _ = _planted(client, pid, key)
    for _ in range(3):
        client.post(
            f"/api/game/players/{pid}/plants/{plant_id}/water",
            json={},
            headers={"X-API-Key": key},
        )
    r = client.get(f"/api/game/plants/{plant_id}/events?limit=1")
    assert r.status_code == 200
    assert len(r.get_json()) == 1


def test_events_unknown_plant_is_empty(client):
    # The events query has no existence check -> unknown plant -> empty list, 200.
    r = client.get("/api/game/plants/does-not-exist/events")
    assert r.status_code == 200
    assert r.get_json() == []
