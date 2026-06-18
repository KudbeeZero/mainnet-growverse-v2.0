"""HTTP-boundary coverage for the AI Master Grower routes in game_api.py:

  * GET  /players/<id>/plants/<plant_id>/advisor            (read-only diagnosis)
  * POST /players/<id>/plants/<plant_id>/advisor/auto-care  (agentic auto-care)

Both are backed by advisor_service / autocare_service and the offline,
deterministic MOCK AI providers (selected automatically because no Anthropic key
is configured in the test environment) — no network, no live key. This mirrors
test_http_boundary.py (client fixture, HTTP setup) and the service-level
test_advisor.py / test_autocare.py (which prove the mock logic + SpendGuard).

Setup runs over HTTP (create player -> buy seed -> create pod -> plant). To
exercise auto-care's real spend/treat paths a plant must have problems, so a few
tests degrade the plant's levels via a session_scope() write against the same
fresh-seeded global engine the app uses (the `db` fixture binds it) — exactly the
technique test_advisor.py uses at the service layer. The route then re-reads that
live state through the normal ownership/catch-up path.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Plant


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


# --- HTTP setup helpers ------------------------------------------------------

def _new_player(client, username="advisee"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _planted(client, pid, key):
    """Buy a seed, build a pod, plant it; return the new plant's id."""
    hdr = {"X-API-Key": key}
    strains = client.get("/api/game/strains").get_json()
    sid = strains[0]["id"]
    stack = client.post(
        f"/api/game/players/{pid}/seeds/buy", json={"strain_id": sid}, headers=hdr
    ).get_json()
    pod = client.post(
        f"/api/game/players/{pid}/pods", json={"name": "Room", "capacity": 2}, headers=hdr
    ).get_json()
    plant = client.post(
        f"/api/game/players/{pid}/plant",
        json={"seed_id": stack["id"], "pod_id": pod["id"]},
        headers=hdr,
    ).get_json()
    return plant["id"]


def _degrade(plant_id, **levels):
    """Force problem state on the live plant (shares the app's seeded engine)."""
    with session_scope() as s:
        plant = s.query(Plant).filter(Plant.id == plant_id).one()
        for k, v in levels.items():
            setattr(plant, k, v)


# --- advisor (read-only recommendation) --------------------------------------

def test_advisor_returns_structured_recommendation(client):
    pid, key = _new_player(client, "diag")
    plant_id = _planted(client, pid, key)

    r = client.get(
        f"/api/game/players/{pid}/plants/{plant_id}/advisor",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 200
    body = r.get_json()
    # Offline mock provider selected (no Anthropic key in tests).
    assert body["provider"] == "mock"
    # Structured AdvisorReport shape.
    assert isinstance(body["summary"], str) and body["summary"]
    assert body["severity"] in ("healthy", "minor", "serious", "critical")
    assert isinstance(body["diagnosis"], str) and body["diagnosis"]
    assert isinstance(body["suggestions"], list) and body["suggestions"]
    for sug in body["suggestions"]:
        assert sug["action"] in (
            "water", "feed", "treat_pests", "treat_disease",
            "adjust_environment", "harvest", "wait",
        )
        assert sug["urgency"] in ("now", "soon", "optional")
        assert isinstance(sug["reason"], str)


def test_advisor_flags_problems_on_degraded_plant(client):
    pid, key = _new_player(client, "sickdiag")
    plant_id = _planted(client, pid, key)
    _degrade(plant_id, water_level=8.0, nutrient_level=12.0)

    body = client.get(
        f"/api/game/players/{pid}/plants/{plant_id}/advisor",
        headers={"X-API-Key": key},
    ).get_json()
    actions = {s["action"] for s in body["suggestions"]}
    assert "water" in actions and "feed" in actions
    assert body["severity"] in ("minor", "serious", "critical")


def test_advisor_unknown_plant_404(client):
    pid, key = _new_player(client, "ghostdiag")
    r = client.get(
        f"/api/game/players/{pid}/plants/does-not-exist/advisor",
        headers={"X-API-Key": key},
    )
    assert r.status_code == 404


def test_advisor_requires_auth(client):
    pid, key = _new_player(client, "noauthdiag")
    plant_id = _planted(client, pid, key)
    r = client.get(f"/api/game/players/{pid}/plants/{plant_id}/advisor")
    assert r.status_code in (401, 403)


# --- auto-care (agentic, SpendGuard-capped) ----------------------------------

def test_auto_care_healthy_plant_no_actions(client):
    pid, key = _new_player(client, "healthycare")
    plant_id = _planted(client, pid, key)  # fresh: water/nutrient 60, no issues

    w_before = client.get(
        f"/api/game/players/{pid}/wallet", headers={"X-API-Key": key}
    ).get_json()["balance"]

    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/advisor/auto-care",
        json={"budget": 200},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["provider"] == "mock"
    assert isinstance(body["message"], str) and body["message"]
    assert body["actions"] == []
    assert body["spent"] == 0
    assert "plant" in body
    # Nothing spent -> balance unchanged.
    w_after = client.get(
        f"/api/game/players/{pid}/wallet", headers={"X-API-Key": key}
    ).get_json()["balance"]
    assert w_after == w_before


def test_auto_care_fixes_problems_within_budget(client):
    pid, key = _new_player(client, "fixcare")
    plant_id = _planted(client, pid, key)
    _degrade(plant_id, pest_level=6, disease_level=6, nutrient_level=10, water_level=10)

    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/advisor/auto-care",
        json={"budget": 200},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 200
    body = r.get_json()
    actions = body["actions"]
    assert actions and all(a["ok"] for a in actions)
    taken = {a["action"] for a in actions}
    assert {"treat_pests", "treat_disease", "feed", "water"} <= taken
    # Spend stayed within the requested cap, and the plant is cured/topped up.
    assert 0 < body["spent"] <= 200
    assert body["plant"]["pest_level"] == 0
    assert body["plant"]["disease_level"] == 0


def test_auto_care_respects_action_cap(client):
    pid, key = _new_player(client, "capcare")
    plant_id = _planted(client, pid, key)
    _degrade(plant_id, pest_level=6, disease_level=6)

    body = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/advisor/auto-care",
        json={"budget": 200, "max_actions": 1},
        headers={"X-API-Key": key},
    ).get_json()
    # Exactly one action allowed; highest-priority issue (pests) handled first.
    assert len(body["actions"]) == 1
    assert body["plant"]["pest_level"] == 0
    assert body["plant"]["disease_level"] > 0


def test_auto_care_respects_budget_cap(client):
    pid, key = _new_player(client, "budgetcare")
    plant_id = _planted(client, pid, key)
    _degrade(plant_id, pest_level=6, disease_level=6)

    body = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/advisor/auto-care",
        # Budget covers the 15-GROW pest treatment but not the 20-GROW disease one.
        json={"budget": 15},
        headers={"X-API-Key": key},
    ).get_json()
    assert body["spent"] <= 15
    assert body["plant"]["pest_level"] == 0     # pests treated
    assert body["plant"]["disease_level"] > 0   # disease left (budget exhausted)


def test_auto_care_rejects_bad_budget(client):
    pid, key = _new_player(client, "badbudget")
    plant_id = _planted(client, pid, key)
    hdr = {"X-API-Key": key}
    # Non-numeric and non-positive budgets are validated to a clean 400.
    assert client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/advisor/auto-care",
        json={"budget": "lots"}, headers=hdr,
    ).status_code == 400
    assert client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/advisor/auto-care",
        json={"budget": 0}, headers=hdr,
    ).status_code == 400


def test_auto_care_unknown_plant_404(client):
    pid, key = _new_player(client, "ghostcare")
    r = client.post(
        f"/api/game/players/{pid}/plants/does-not-exist/advisor/auto-care",
        json={"budget": 50},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 404


def test_auto_care_requires_auth(client):
    pid, key = _new_player(client, "noauthcare")
    plant_id = _planted(client, pid, key)
    r = client.post(
        f"/api/game/players/{pid}/plants/{plant_id}/advisor/auto-care",
        json={"budget": 50},
    )
    assert r.status_code in (401, 403)
