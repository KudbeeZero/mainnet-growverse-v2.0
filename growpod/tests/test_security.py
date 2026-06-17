"""
Security regressions: anti-cheat (server-authoritative values), authorization
(IDOR), input validation, CORS allowlist, and rate limiting.

These lock in the safeguards added in the security audit so they can't silently
regress. They drive the real Flask app via its test client.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.api.flask_api import create_app


@pytest.fixture()
def client(db):
    app = create_app(init_database=False)
    # The rate limiter uses a process-global in-memory store keyed by IP, which
    # is NOT reset between tests; without this, prior tests' player-creates leak
    # into the per-IP bucket and make the rate-limit assertion order-dependent.
    with app.app_context():
        try:
            from growpodempire.api.ratelimit import limiter

            limiter.reset()
        except Exception:
            pass
    return app.test_client()


def _new_player(client, username="sec"):
    r = client.post("/api/game/players", json={"username": username})
    assert r.status_code == 201, r.get_data(as_text=True)
    body = r.get_json()
    return body["id"], body["api_key"]


def _first_strain_id(client):
    return client.get("/api/game/strains").get_json()[0]["id"]


def _plant_a_seed(client, pid, key):
    """Buy a seed, make a pod, and plant it; return the plant id."""
    sid = _first_strain_id(client)
    h = {"X-API-Key": key}
    seed = client.post(
        f"/api/game/players/{pid}/seeds/buy", json={"strain_id": sid}, headers=h
    ).get_json()
    pod = client.post(
        f"/api/game/players/{pid}/pods", json={"name": "Tent"}, headers=h
    ).get_json()
    plant = client.post(
        f"/api/game/players/{pid}/plant",
        json={"seed_id": seed["id"], "pod_id": pod["id"]},
        headers=h,
    ).get_json()
    return plant["id"]


# ----- Anti-cheat: server-authoritative harvest --------------------------
def test_harvest_value_is_server_authoritative(client):
    """A client cannot inflate harvest weight/quality to mint currency."""
    pid, key = _new_player(client, "cheater")
    plant_id = _plant_a_seed(client, pid, key)

    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/harvest",
        json={"weight_g": 999_999_999, "quality": 100, "sell": True},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 201
    body = r.get_json()
    # The injected weight is ignored; the server computes a realistic value
    # bounded by the strain's genetics (max yield is 800g).
    assert body["weight_g"] != 999_999_999
    assert body["weight_g"] <= 1000
    assert float(body["sale_value"]) < 100_000


def test_weather_event_cannot_be_chosen(client):
    """Client-supplied weather event is ignored (no forcing 'ideal')."""
    pid, key = _new_player(client, "weather")
    h = {"X-API-Key": key}
    pod = client.post(
        f"/api/game/players/{pid}/pods", json={"name": "Tent"}, headers=h
    ).get_json()
    # A bogus event would 400 if it were honoured; it's ignored, so this succeeds.
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod['id']}/weather",
        json={"event": "definitely_not_a_real_event"},
        headers=h,
    )
    assert r.status_code == 201


# ----- Authorization / IDOR ----------------------------------------------
def test_protected_read_requires_key(client):
    pid, key = _new_player(client, "owner")

    assert client.get(f"/api/game/players/{pid}/wallet").status_code == 401
    assert (
        client.get(
            f"/api/game/players/{pid}/wallet", headers={"X-API-Key": "wrong"}
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/game/players/{pid}/wallet", headers={"X-API-Key": key}
        ).status_code
        == 200
    )


def test_cannot_read_another_players_data(client):
    a_id, a_key = _new_player(client, "alice")
    b_id, _ = _new_player(client, "bob")

    # Alice's key must not unlock Bob's wallet or ledger.
    assert (
        client.get(
            f"/api/game/players/{b_id}/wallet", headers={"X-API-Key": a_key}
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/game/players/{b_id}/ledger", headers={"X-API-Key": a_key}
        ).status_code
        == 403
    )


def test_public_reads_stay_open(client):
    # Catalog, leaderboards and market need no key.
    assert client.get("/api/game/strains").status_code == 200
    assert client.get("/api/game/leaderboards/richest").status_code == 200
    assert client.get("/api/game/market").status_code == 200


# ----- Input validation ---------------------------------------------------
def test_negative_quantity_is_400_not_500(client):
    pid, key = _new_player(client, "validate")
    sid = _first_strain_id(client)
    r = client.post(
        f"/api/game/players/{pid}/seeds/buy",
        json={"strain_id": sid, "quantity": -5},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_non_numeric_amount_is_400(client):
    a_id, a_key = _new_player(client, "bidder")
    r = client.post(
        f"/api/game/players/{a_id}/market/does-not-exist/bid",
        json={"amount": "not-a-number"},
        headers={"X-API-Key": a_key},
    )
    assert r.status_code == 400


# ----- CORS allowlist -----------------------------------------------------
def test_cors_allows_configured_origin(client):
    r = client.get(
        "/api/game/strains", headers={"Origin": "http://localhost:3000"}
    )
    assert r.headers.get("Access-Control-Allow-Origin") == "http://localhost:3000"


def test_cors_blocks_unlisted_origin(client):
    r = client.get("/api/game/strains", headers={"Origin": "http://evil.example"})
    # flask-cors omits the allow-origin header entirely for disallowed origins.
    assert r.headers.get("Access-Control-Allow-Origin") != "http://evil.example"


# ----- Rate limiting ------------------------------------------------------
def test_player_creation_is_rate_limited(client):
    # The create-player route is capped at 30/hour per IP; the 31st is blocked.
    statuses = [
        client.post("/api/game/players", json={"username": f"rl{i}"}).status_code
        for i in range(31)
    ]
    assert statuses[-1] == 429
    assert statuses.count(201) == 30


# ----- Input validation: clean 400s, never a 500 -------------------------
def test_set_environment_rejects_non_numeric(client):
    """A non-numeric sensor value is a clean 400, not a 500 (it used to be
    stored raw and TypeError on the next sim read of every plant in the pod)."""
    pid, key = _new_player(client, "envbad")
    h = {"X-API-Key": key}
    pod = client.post(
        f"/api/game/players/{pid}/pods", json={"name": "Tent"}, headers=h
    ).get_json()
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod['id']}/environment",
        json={"temperature": "hot", "humidity": 50, "co2_level": 1000,
              "light_intensity": 500, "ph_level": 6.5},
        headers=h,
    )
    assert r.status_code == 400
    assert "temperature" in r.get_json()["error"].lower()


def test_set_environment_rejects_out_of_range(client):
    pid, key = _new_player(client, "envrange")
    h = {"X-API-Key": key}
    pod = client.post(
        f"/api/game/players/{pid}/pods", json={"name": "Tent"}, headers=h
    ).get_json()
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod['id']}/environment",
        json={"temperature": 24, "humidity": 50, "co2_level": 1000,
              "light_intensity": 500, "ph_level": 99},  # pH 99 is impossible
        headers=h,
    )
    assert r.status_code == 400


def test_auto_care_rejects_non_numeric_budget(client):
    pid, key = _new_player(client, "acbad")
    plant_id = _plant_a_seed(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/advisor/auto-care",
        json={"budget": "lots"},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 400


def test_create_player_rejects_blank_username(client):
    r = client.post("/api/game/players", json={"username": "   "})
    assert r.status_code == 400


def test_create_player_rejects_duplicate_email(client):
    a = client.post("/api/game/players", json={"username": "dupe1", "email": "x@y.com"})
    assert a.status_code == 201
    b = client.post("/api/game/players", json={"username": "dupe2", "email": "x@y.com"})
    assert b.status_code == 400  # was a 500 (DB IntegrityError) before


# ----- Money endpoints: auth + IDOR + validation at the HTTP boundary -----
def test_withdraw_requires_auth_and_blocks_idor(client):
    a_id, a_key = _new_player(client, "wA")
    b_id, _ = _new_player(client, "wB")
    # No key -> 401.
    assert client.post(f"/api/game/players/{a_id}/wallet/withdraw",
                       json={"amount": 1}).status_code == 401
    # Wrong key -> 403.
    assert client.post(f"/api/game/players/{a_id}/wallet/withdraw",
                       json={"amount": 1},
                       headers={"X-API-Key": "nope"}).status_code == 403
    # A's key on B's wallet (IDOR) -> 403.
    assert client.post(f"/api/game/players/{b_id}/wallet/withdraw",
                       json={"amount": 1},
                       headers={"X-API-Key": a_key}).status_code == 403


def test_withdraw_validates_amount(client):
    pid, key = _new_player(client, "wval")
    h = {"X-API-Key": key}
    assert client.post(f"/api/game/players/{pid}/wallet/withdraw",
                       json={"amount": -5}, headers=h).status_code == 400
    assert client.post(f"/api/game/players/{pid}/wallet/withdraw",
                       json={"amount": "lots"}, headers=h).status_code == 400
    assert client.post(f"/api/game/players/{pid}/wallet/withdraw",
                       json={}, headers=h).status_code == 400


def test_deposit_requires_auth_and_blocks_idor(client):
    a_id, a_key = _new_player(client, "dA")
    b_id, _ = _new_player(client, "dB")
    assert client.post(f"/api/game/players/{b_id}/wallet/deposit",
                       json={"amount": 1},
                       headers={"X-API-Key": a_key}).status_code == 403
