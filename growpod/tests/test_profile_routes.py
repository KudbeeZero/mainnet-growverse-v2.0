"""
HTTP-boundary coverage for the profile / progression routes in game_api.py:

    GET  /players/<id>/profile
    POST /players/<id>/daily
    GET  /players/<id>/achievements
    POST /players/<id>/achievements/<key>/claim

These exercise request parsing, API-key auth, status codes, and the GameError ->
HTTP error mapping for the retention surface (daily stipend cooldown + one-time
achievement rewards), which was previously covered only at the service layer
(`test_progression.py`). The cooldown / claim-once guards live in the ledger, so
driving them through the client also confirms the route wiring posts faucets.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest


@pytest.fixture()
def client(db):
    """Plain Flask test client on the fresh, strain-seeded `db`."""
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


def _new_player(client, username="profile"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _harvest_once(client, pid, key):
    """Drive the full grow->harvest loop over HTTP so `first_harvest` unlocks.

    Harvest has no stage gate (mirrors test_http_boundary's `_rare_harvest`), so a
    freshly planted seed can be harvested immediately. Any strain works for the
    `first_harvest` achievement; the seeded catalog's first strain is fine.
    """
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
    return client.post(
        f"/api/game/players/{pid}/plants/{plant['id']}/harvest",
        json={"sell": False},
        headers=hdr,
    ).get_json()


# --- GET /profile ------------------------------------------------------------

def test_profile_happy_path(client):
    pid, key = _new_player(client, "profiler")
    r = client.get(
        f"/api/game/players/{pid}/profile", headers={"X-API-Key": key}
    )
    assert r.status_code == 200
    body = r.get_json()
    # Summary carries rank, level/XP progress, specialization badges, and medals.
    assert set(body) >= {"rank", "level", "badges", "medals"}
    assert "level" in body["level"]
    assert isinstance(body["badges"], list)
    # Medals are the achievement list; a brand-new player has none earned yet.
    medals = {m["key"]: m for m in body["medals"]}
    assert medals["first_harvest"]["unlocked"] is False
    assert medals["first_harvest"]["claimed"] is False


def test_profile_unknown_player_404(client):
    pid, key = _new_player(client, "realone")
    # Auth passes for the real player's key, but the *path* player is unknown ->
    # require_player rejects the mismatched id at 404 before the view runs.
    r = client.get(
        "/api/game/players/does-not-exist/profile", headers={"X-API-Key": key}
    )
    assert r.status_code == 404


def test_profile_requires_auth(client):
    pid, _ = _new_player(client, "noauthprofile")
    r = client.get(f"/api/game/players/{pid}/profile")
    assert r.status_code in (401, 403)


# --- POST /daily -------------------------------------------------------------

def test_daily_claim_then_cooldown(client):
    pid, key = _new_player(client, "dailyclaimer")
    hdr = {"X-API-Key": key}

    r = client.post(f"/api/game/players/{pid}/daily", headers=hdr)
    assert r.status_code == 201
    body = r.get_json()
    # daily_stipend in the live balance.yaml is 5000; signup grant was 500.
    assert body["claimed"] == 5000.0
    assert body["balance"] == 5500.0

    # Second claim within the cooldown window -> GameError -> 400.
    r2 = client.post(f"/api/game/players/{pid}/daily", headers=hdr)
    assert r2.status_code == 400
    assert "error" in r2.get_json()


def test_daily_requires_auth(client):
    pid, _ = _new_player(client, "nodailyauth")
    r = client.post(f"/api/game/players/{pid}/daily")
    assert r.status_code in (401, 403)


# --- GET /achievements -------------------------------------------------------

def test_achievements_list_shape(client):
    pid, key = _new_player(client, "lister")
    r = client.get(
        f"/api/game/players/{pid}/achievements", headers={"X-API-Key": key}
    )
    assert r.status_code == 200
    items = r.get_json()
    assert isinstance(items, list) and items
    by_key = {a["key"]: a for a in items}
    # Canonical keys from balance.yaml's progression.achievements block.
    assert {"first_harvest", "first_breed", "high_roller"} <= set(by_key)
    fh = by_key["first_harvest"]
    assert set(fh) >= {"key", "description", "reward", "unlocked", "claimed"}
    assert fh["unlocked"] is False and fh["claimed"] is False


def test_achievements_reflect_unlock_after_harvest(client):
    pid, key = _new_player(client, "unlocker")
    _harvest_once(client, pid, key)
    items = client.get(
        f"/api/game/players/{pid}/achievements", headers={"X-API-Key": key}
    ).get_json()
    by_key = {a["key"]: a for a in items}
    assert by_key["first_harvest"]["unlocked"] is True
    assert by_key["first_harvest"]["claimed"] is False  # unlocked != claimed


def test_achievements_requires_auth(client):
    pid, _ = _new_player(client, "noachauth")
    r = client.get(f"/api/game/players/{pid}/achievements")
    assert r.status_code in (401, 403)


# --- POST /achievements/<key>/claim ------------------------------------------

def test_claim_achievement_happy_path_and_claim_once(client):
    pid, key = _new_player(client, "claimer")
    hdr = {"X-API-Key": key}
    _harvest_once(client, pid, key)

    r = client.post(
        f"/api/game/players/{pid}/achievements/first_harvest/claim", headers=hdr
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["key"] == "first_harvest"
    assert body["reward"] == 100  # reward from balance.yaml

    # The medal now shows as claimed in the list view.
    items = client.get(
        f"/api/game/players/{pid}/achievements", headers=hdr
    ).get_json()
    assert {a["key"]: a for a in items}["first_harvest"]["claimed"] is True

    # Double-claim is guarded -> GameError -> 400.
    r2 = client.post(
        f"/api/game/players/{pid}/achievements/first_harvest/claim", headers=hdr
    )
    assert r2.status_code == 400
    assert "error" in r2.get_json()


def test_claim_unknown_achievement_key(client):
    pid, key = _new_player(client, "ghostclaim")
    r = client.post(
        f"/api/game/players/{pid}/achievements/not-a-real-key/claim",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400
    assert "error" in r.get_json()


def test_claim_unearned_achievement_rejected(client):
    pid, key = _new_player(client, "tooeager")
    # Valid key, but the player has zero harvests -> not unlocked -> 400.
    r = client.post(
        f"/api/game/players/{pid}/achievements/first_harvest/claim",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400
    assert "error" in r.get_json()


def test_claim_high_roller_via_daily_stipend(client):
    """The daily stipend (5000) pushes balance past high_roller's 2000 threshold,
    so a balance-gated achievement unlocks and claims cleanly over HTTP."""
    pid, key = _new_player(client, "roller")
    hdr = {"X-API-Key": key}
    client.post(f"/api/game/players/{pid}/daily", headers=hdr)  # 500 -> 5500

    r = client.post(
        f"/api/game/players/{pid}/achievements/high_roller/claim", headers=hdr
    )
    assert r.status_code == 201
    assert r.get_json()["reward"] == 400


def test_claim_requires_auth(client):
    pid, _ = _new_player(client, "noclaimauth")
    r = client.post(f"/api/game/players/{pid}/achievements/first_harvest/claim")
    assert r.status_code in (401, 403)
