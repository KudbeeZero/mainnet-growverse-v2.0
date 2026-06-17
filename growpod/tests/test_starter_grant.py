"""Starter-grant rail: signup hands every new player a one-shot pod + seed so the
first-run loop (plant → care → harvest → sell) is reachable with zero setup."""

import os
import sys
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.api.flask_api import create_app
from growpodempire.db.session import session_scope
from growpodempire.db.models import GrowPod, SeedInventory, GrantClaim, Plant
from growpodempire.services.game_service import GameService
from growpodempire.economy.ledger import balance


@pytest.fixture()
def client(db):
    return create_app(init_database=False).test_client()


def _pods(s, pid):
    return s.query(GrowPod).filter(GrowPod.player_id == pid).all()


def _seeds(s, pid):
    return s.query(SeedInventory).filter(SeedInventory.player_id == pid).all()


def test_signup_endpoint_grants_starter_pod_and_seed(client):
    resp = client.post("/api/game/players", json={"username": "newbie"})
    assert resp.status_code == 201
    pid = resp.get_json()["id"]
    with session_scope() as s:
        pods = _pods(s, pid)
        seeds = _seeds(s, pid)
        assert len(pods) == 1
        assert pods[0].name == "Starter Pod" and pods[0].tier == "basic"
        assert len(seeds) == 1
        assert seeds[0].quantity == 1 and seeds[0].source == "starter"
        # Grants are free — the starting balance is untouched.
        assert balance(s, pid) == Decimal("500.000000")


def test_starter_grant_is_idempotent(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("again")
        # Re-running the grant (or a raced double signup) must not double-grant.
        svc.grant_starter_items(p.id)
        svc.grant_starter_items(p.id)
        assert len(_pods(s, p.id)) == 1
        seeds = _seeds(s, p.id)
        assert len(seeds) == 1 and seeds[0].quantity == 1
        claims = s.query(GrantClaim).filter(GrantClaim.player_id == p.id).all()
        assert {c.grant_key for c in claims} == {"pod", "seed"}


def test_starter_grant_enables_full_grow_loop(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("grower")
        svc.grant_starter_items(p.id)
        # Use ONLY the granted starter pod + seed — no buying anything.
        pod = _pods(s, p.id)[0]
        stack = _seeds(s, p.id)[0]
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        before = balance(s, p.id)
        h = svc.harvest_plant(p.id, plant.id, weight_g=100, quality=100)
        assert h.sold is True and h.sale_value > 0
        assert balance(s, p.id) == before + h.sale_value
        assert s.get(Plant, plant.id).harvested is True
