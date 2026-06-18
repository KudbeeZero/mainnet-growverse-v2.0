"""
HTTP-boundary coverage for the still-uncovered error / validation / not-found
branches of `game_api.py`, reached purely by sending bad or edge input through
the Flask test client.

Scope is deliberately the 400 / 404 / error arms that the route-group modules
(test_http_boundary, test_game_api_misc, test_market_routes,
test_plant_care_routes, test_profile_routes, test_university_routes,
test_cup_routes, test_contracts_routes, test_ftue_routes, test_game_service)
don't already drive:

  - leaderboards: unknown board -> 404
  - strains list: non-numeric float filter -> 400
  - strain sub-resources (get / provenance / lineage / knowledge / effects):
    unknown id -> 404
  - favorite add/remove + favorites list error arms
  - pod upgrade / plant / breed / stabilize / harvest / cleanup: missing-field
    -> 400 and unknown-id -> 400 error arms
  - harvests cure / cure-finish / sell: unknown id -> 400 error arms
  - research unlock, shop buy, apply-consumable: missing/bad input -> 400
  - plant state / advisor / ftue status+coaching: unknown id/step -> 404

These drive the real Flask routes (request parsing, the auth decorator, status
codes, and GameError->4xx mapping). Seeds are free in the test balance; a fresh
player gets a 500 GROW signup grant plus a starter pod + seed. No mocking — the
offline defaults back every call.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


def _new_player(client, username="errs"):
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


# ----- Leaderboards: unknown board -> 404 --------------------------------

def test_leaderboard_unknown_board_is_404(client):
    r = client.get("/api/game/leaderboards/bogus")
    assert r.status_code == 404
    assert "Unknown leaderboard" in r.get_json()["error"]


# ----- Strains list: non-numeric float filter -> 400 ---------------------

def test_list_strains_rejects_non_numeric_filter(client):
    r = client.get("/api/game/strains?min_thc=abc")
    assert r.status_code == 400
    assert "min_thc" in r.get_json()["error"]


# ----- Strain sub-resources: unknown id -> 404 ---------------------------

def test_get_strain_unknown_is_404(client):
    assert client.get("/api/game/strains/nope").status_code == 404


def test_strain_provenance_unknown_is_404(client):
    assert client.get("/api/game/strains/nope/provenance").status_code == 404


def test_strain_lineage_unknown_is_404(client):
    assert client.get("/api/game/strains/nope/lineage").status_code == 404


def test_strain_knowledge_unknown_is_404(client):
    assert client.get("/api/game/strains/nope/knowledge").status_code == 404


def test_strain_effects_unknown_is_404(client):
    assert client.get("/api/game/strains/nope/effects").status_code == 404


# ----- Favorites: list success + add/remove error arms -------------------

def test_list_favorites_success_empty(client):
    pid, key = _new_player(client, "favempty")
    r = client.get(f"/api/game/players/{pid}/favorites", headers=_hdr(key))
    assert r.status_code == 200
    assert r.get_json() == []


def test_add_favorite_unknown_strain_is_400(client):
    pid, key = _new_player(client, "favbad")
    r = client.post(
        f"/api/game/players/{pid}/strains/nope/favorite", headers=_hdr(key)
    )
    assert r.status_code == 400


def test_remove_favorite_is_idempotent(client):
    pid, key = _new_player(client, "favrm")
    # Removing a non-favorited strain is a no-op success (200).
    r = client.delete(
        f"/api/game/players/{pid}/strains/nope/favorite", headers=_hdr(key)
    )
    assert r.status_code == 200
    assert r.get_json()["favorited"] is False


# ----- Pod upgrade: missing tier -> 400, unknown pod -> error ------------

def test_upgrade_pod_requires_tier(client):
    pid, key = _new_player(client, "upgnotier")
    pod_id = _starter_pod_id(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/pods/{pod_id}/upgrade", json={}, headers=_hdr(key)
    )
    assert r.status_code == 400
    assert "tier" in r.get_json()["error"]


def test_upgrade_pod_unknown_pod_is_400(client):
    pid, key = _new_player(client, "upgbadpod")
    r = client.post(
        f"/api/game/players/{pid}/pods/nope/upgrade",
        json={"tier": "premium"},
        headers=_hdr(key),
    )
    assert r.status_code == 400


# ----- Plant: missing fields -> 400, unknown ids -> error ----------------

def test_plant_requires_seed_and_pod(client):
    pid, key = _new_player(client, "plantnofields")
    r = client.post(f"/api/game/players/{pid}/plant", json={}, headers=_hdr(key))
    assert r.status_code == 400
    body = r.get_json()["error"]
    assert "seed_id" in body and "pod_id" in body


def test_plant_unknown_seed_is_400(client):
    pid, key = _new_player(client, "plantbadseed")
    pod_id = _starter_pod_id(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/plant",
        json={"seed_id": "nope", "pod_id": pod_id},
        headers=_hdr(key),
    )
    assert r.status_code == 400


# ----- Breed: missing parents -> 400, unknown parents -> error -----------

def test_breed_requires_both_parents(client):
    pid, key = _new_player(client, "breednoparents")
    r = client.post(
        f"/api/game/players/{pid}/breed",
        json={"parent_a_id": "x"},
        headers=_hdr(key),
    )
    assert r.status_code == 400
    assert "parent_a_id" in r.get_json()["error"]


def test_breed_unknown_parents_is_400(client):
    pid, key = _new_player(client, "breedbad")
    r = client.post(
        f"/api/game/players/{pid}/breed",
        json={"parent_a_id": "nope1", "parent_b_id": "nope2"},
        headers=_hdr(key),
    )
    assert r.status_code == 400


# ----- Stabilize: unknown strain -> error --------------------------------

def test_stabilize_unknown_strain_is_400(client):
    pid, key = _new_player(client, "stabbad")
    r = client.post(
        f"/api/game/players/{pid}/strains/nope/stabilize", headers=_hdr(key)
    )
    assert r.status_code == 400


# ----- Harvest / cleanup: unknown plant -> error -------------------------

def test_harvest_unknown_plant_is_400(client):
    pid, key = _new_player(client, "harvbad")
    r = client.post(
        f"/api/game/players/{pid}/plants/nope/harvest", json={}, headers=_hdr(key)
    )
    assert r.status_code == 400


def test_cleanup_unknown_plant_is_400(client):
    pid, key = _new_player(client, "cleanbad")
    r = client.delete(
        f"/api/game/players/{pid}/plants/nope", headers=_hdr(key)
    )
    assert r.status_code == 400


# ----- Harvests list + cure / cure-finish / sell error arms --------------

def test_list_harvests_success_empty(client):
    pid, key = _new_player(client, "harvlist")
    r = client.get(f"/api/game/players/{pid}/harvests", headers=_hdr(key))
    assert r.status_code == 200
    assert r.get_json() == []


def test_start_cure_unknown_harvest_is_400(client):
    pid, key = _new_player(client, "curebad")
    r = client.post(
        f"/api/game/players/{pid}/harvests/nope/cure", json={}, headers=_hdr(key)
    )
    assert r.status_code == 400


def test_finish_cure_unknown_harvest_is_400(client):
    pid, key = _new_player(client, "finbad")
    r = client.post(
        f"/api/game/players/{pid}/harvests/nope/cure/finish",
        json={},
        headers=_hdr(key),
    )
    assert r.status_code == 400


def test_sell_harvest_unknown_is_400(client):
    pid, key = _new_player(client, "sellbad")
    r = client.post(
        f"/api/game/players/{pid}/harvests/nope/sell", headers=_hdr(key)
    )
    assert r.status_code == 400


# ----- Research tree + unlock --------------------------------------------

def test_research_tree_success(client):
    pid, key = _new_player(client, "restree")
    r = client.get(f"/api/game/players/{pid}/research", headers=_hdr(key))
    assert r.status_code == 200


def test_research_unlock_unknown_node_is_400(client):
    pid, key = _new_player(client, "resbad")
    r = client.post(
        f"/api/game/players/{pid}/research/nope/unlock", headers=_hdr(key)
    )
    assert r.status_code == 400


# ----- Shop list + buy ---------------------------------------------------

def test_shop_list_success(client):
    pid, key = _new_player(client, "shoplist")
    r = client.get(f"/api/game/players/{pid}/shop", headers=_hdr(key))
    assert r.status_code == 200


def test_shop_buy_requires_item_key(client):
    pid, key = _new_player(client, "shopnokey")
    r = client.post(
        f"/api/game/players/{pid}/shop/buy", json={}, headers=_hdr(key)
    )
    assert r.status_code == 400
    assert "item_key" in r.get_json()["error"]


def test_shop_buy_unknown_item_is_400(client):
    pid, key = _new_player(client, "shopbad")
    r = client.post(
        f"/api/game/players/{pid}/shop/buy",
        json={"item_key": "nope"},
        headers=_hdr(key),
    )
    assert r.status_code == 400


# ----- Apply consumable: missing item_key -> 400, unknown -> error -------

def test_apply_consumable_requires_item_key(client):
    pid, key = _new_player(client, "applynokey")
    r = client.post(
        f"/api/game/players/{pid}/plants/nope/apply", json={}, headers=_hdr(key)
    )
    assert r.status_code == 400
    assert "item_key" in r.get_json()["error"]


def test_apply_consumable_unknown_plant_is_400(client):
    pid, key = _new_player(client, "applybad")
    r = client.post(
        f"/api/game/players/{pid}/plants/nope/apply",
        json={"item_key": "nutrient_basic"},
        headers=_hdr(key),
    )
    assert r.status_code == 400


# ----- Simulation / advisor / ftue: unknown id/step -> 404 ---------------

def test_plant_state_unknown_plant_is_404(client):
    pid, key = _new_player(client, "statebad")
    r = client.get(
        f"/api/game/players/{pid}/plants/nope/state", headers=_hdr(key)
    )
    assert r.status_code == 404


def test_plant_advisor_unknown_plant_is_404(client):
    pid, key = _new_player(client, "advbad")
    r = client.get(
        f"/api/game/players/{pid}/plants/nope/advisor", headers=_hdr(key)
    )
    assert r.status_code == 404
