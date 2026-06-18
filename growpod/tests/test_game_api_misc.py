"""
HTTP-boundary coverage for the *uncovered* validation/auth/error branches of
`game_api.py` that the route-group test modules don't own.

Scope (deliberately narrow to avoid duplicating test_http_boundary,
test_store, test_profile_routes, etc.):
  - Early player/wallet/level CRUD: missing-input -> 400, missing-auth -> 401,
    bad-key -> 403, missing-row -> 404 branches.
  - Seeds buy / pods create / seeds+pods+plants list: bad-input -> 400 and the
    happy-path success branches that drive the serializers.
  - Grow-room gear store + equip-light: success + every error branch.
  - The public feature-flags route.

These drive the real Flask routes (request parsing, auth decorator, status-code
mapping). Seeds are free in the test balance; money is Decimal; a fresh player
gets a 500 GROW signup grant plus a starter pod + seed.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


def _new_player(client, username="misc"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _hdr(key):
    return {"X-API-Key": key}


def _first_strain_id(client):
    return client.get("/api/game/strains").get_json()[0]["id"]


def _starter_pod_id(client, pid, key):
    return client.get(
        f"/api/game/players/{pid}/pods", headers=_hdr(key)
    ).get_json()[0]["id"]


# ----- Feature flags -----------------------------------------------------

def test_flags_public(client):
    r = client.get("/api/game/flags")
    assert r.status_code == 200
    flags = r.get_json()["flags"]
    assert isinstance(flags, dict)
    # Every value is a resolved boolean.
    assert all(isinstance(v, bool) for v in flags.values())


# ----- Player create / get / wallet / level -----------------------------

def test_create_player_requires_username(client):
    r = client.post("/api/game/players", json={})
    assert r.status_code == 400
    assert "username" in r.get_json()["error"]


def test_create_player_success_returns_api_key(client):
    r = client.post("/api/game/players", json={"username": "alice"})
    assert r.status_code == 201
    body = r.get_json()
    assert body["api_key"]
    assert "wallet" in body


def test_get_player_requires_auth_header(client):
    pid, _ = _new_player(client)
    r = client.get(f"/api/game/players/{pid}")
    assert r.status_code == 401


def test_get_player_rejects_bad_key(client):
    pid, _ = _new_player(client)
    r = client.get(f"/api/game/players/{pid}", headers=_hdr("wrong"))
    assert r.status_code == 403


def test_get_player_missing_is_404(client):
    # Auth decorator returns 404 when the player row doesn't exist.
    r = client.get("/api/game/players/nope", headers=_hdr("whatever"))
    assert r.status_code == 404


def test_get_player_success(client):
    pid, key = _new_player(client)
    r = client.get(f"/api/game/players/{pid}", headers=_hdr(key))
    assert r.status_code == 200
    assert r.get_json()["id"] == pid


def test_get_wallet_success(client):
    pid, key = _new_player(client)
    r = client.get(f"/api/game/players/{pid}/wallet", headers=_hdr(key))
    assert r.status_code == 200
    assert "balance" in r.get_json()


def test_level_public_success(client):
    pid, _ = _new_player(client)
    r = client.get(f"/api/game/players/{pid}/level")
    assert r.status_code == 200
    assert r.get_json()["level"] == 1


def test_level_missing_player_is_404(client):
    r = client.get("/api/game/players/nope/level")
    assert r.status_code == 404


def test_ledger_success(client):
    pid, key = _new_player(client)
    r = client.get(f"/api/game/players/{pid}/ledger", headers=_hdr(key))
    assert r.status_code == 200
    assert isinstance(r.get_json(), list)


# ----- Seeds: buy + list -------------------------------------------------

def test_buy_seed_requires_strain_id(client):
    pid, key = _new_player(client)
    r = client.post(
        f"/api/game/players/{pid}/seeds/buy", json={}, headers=_hdr(key)
    )
    assert r.status_code == 400
    assert "strain_id" in r.get_json()["error"]


def test_buy_seed_rejects_bad_quantity(client):
    pid, key = _new_player(client)
    sid = _first_strain_id(client)
    r = client.post(
        f"/api/game/players/{pid}/seeds/buy",
        json={"strain_id": sid, "quantity": 0},
        headers=_hdr(key),
    )
    assert r.status_code == 400


def test_buy_seed_unknown_strain_is_400(client):
    pid, key = _new_player(client)
    r = client.post(
        f"/api/game/players/{pid}/seeds/buy",
        json={"strain_id": "nope"},
        headers=_hdr(key),
    )
    assert r.status_code == 400


def test_buy_seed_success(client):
    pid, key = _new_player(client)
    sid = _first_strain_id(client)
    r = client.post(
        f"/api/game/players/{pid}/seeds/buy",
        json={"strain_id": sid, "quantity": 2},
        headers=_hdr(key),
    )
    assert r.status_code == 201
    assert r.get_json()["strain_id"] == sid


def test_list_seeds_success(client):
    pid, key = _new_player(client)
    r = client.get(f"/api/game/players/{pid}/seeds", headers=_hdr(key))
    assert r.status_code == 200
    # Starter grant gives one seed stack.
    assert len(r.get_json()) >= 1


# ----- Pods: create + list ----------------------------------------------

def test_create_pod_requires_name(client):
    pid, key = _new_player(client)
    r = client.post(
        f"/api/game/players/{pid}/pods", json={}, headers=_hdr(key)
    )
    assert r.status_code == 400
    assert "name" in r.get_json()["error"]


def test_create_pod_rejects_non_integer_capacity(client):
    pid, key = _new_player(client)
    r = client.post(
        f"/api/game/players/{pid}/pods",
        json={"name": "p", "capacity": "abc"},
        headers=_hdr(key),
    )
    assert r.status_code == 400


def test_create_pod_success(client):
    pid, key = _new_player(client)
    r = client.post(
        f"/api/game/players/{pid}/pods",
        json={"name": "Tent A", "capacity": 4},
        headers=_hdr(key),
    )
    assert r.status_code == 201
    assert r.get_json()["name"] == "Tent A"


def test_list_pods_success(client):
    pid, key = _new_player(client)
    r = client.get(f"/api/game/players/{pid}/pods", headers=_hdr(key))
    assert r.status_code == 200
    assert len(r.get_json()) >= 1  # starter pod


def test_list_plants_success(client):
    pid, key = _new_player(client)
    r = client.get(f"/api/game/players/{pid}/plants", headers=_hdr(key))
    assert r.status_code == 200
    assert r.get_json() == []


# ----- Grow-room gear store + equip-light -------------------------------

def test_list_gear_success(client):
    pid, key = _new_player(client)
    r = client.get(f"/api/game/players/{pid}/store/gear", headers=_hdr(key))
    assert r.status_code == 200
    items = r.get_json()
    assert isinstance(items, list) and items
    assert {"key", "category", "cost", "owned"} <= set(items[0])


def test_purchase_gear_success(client):
    pid, key = _new_player(client)
    r = client.post(
        f"/api/game/players/{pid}/store/gear/led_125w/purchase",
        json={"quantity": 1},
        headers=_hdr(key),
    )
    assert r.status_code == 201
    owned = {g["key"]: g["owned"] for g in r.get_json()}
    assert owned["led_125w"] == 1


def test_purchase_gear_unknown_key_is_400(client):
    pid, key = _new_player(client)
    r = client.post(
        f"/api/game/players/{pid}/store/gear/nope/purchase",
        json={},
        headers=_hdr(key),
    )
    assert r.status_code == 400


def test_purchase_gear_insufficient_funds_is_400(client):
    pid, key = _new_player(client)
    # 99x a 380 GROW board far exceeds the 500 GROW signup grant.
    r = client.post(
        f"/api/game/players/{pid}/store/gear/led_320w/purchase",
        json={"quantity": 99},
        headers=_hdr(key),
    )
    assert r.status_code == 400


def test_equip_light_requires_gear_key(client):
    pid, key = _new_player(client)
    pod_id = _starter_pod_id(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/equip-light",
        json={},
        headers=_hdr(key),
    )
    assert r.status_code == 400
    assert "gear_key" in r.get_json()["error"]


def test_equip_light_unowned_gear_is_400(client):
    pid, key = _new_player(client)
    pod_id = _starter_pod_id(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/equip-light",
        json={"gear_key": "led_320w"},
        headers=_hdr(key),
    )
    assert r.status_code == 400


def test_equip_light_success(client):
    pid, key = _new_player(client)
    pod_id = _starter_pod_id(client, pid, key)
    client.post(
        f"/api/game/players/{pid}/store/gear/led_125w/purchase",
        json={"quantity": 1},
        headers=_hdr(key),
    )
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/equip-light",
        json={"gear_key": "led_125w"},
        headers=_hdr(key),
    )
    assert r.status_code == 200
    assert r.get_json()["id"] == pod_id
