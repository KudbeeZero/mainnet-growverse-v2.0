"""API-key auth on write endpoints."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.api.flask_api import create_app


@pytest.fixture()
def client(db):
    return create_app(init_database=False).test_client()


def _new_player(client):
    resp = client.post("/api/game/players", json={"username": "authuser"})
    body = resp.get_json()
    return body["id"], body["api_key"]


def test_create_returns_api_key(client):
    pid, key = _new_player(client)
    assert key and isinstance(key, str) and len(key) > 20


def test_write_requires_key(client):
    pid, key = _new_player(client)
    strains = client.get("/api/game/strains").get_json()
    sid = strains[0]["id"]

    # No key -> 401
    r = client.post(f"/api/game/players/{pid}/seeds/buy", json={"strain_id": sid})
    assert r.status_code == 401

    # Wrong key -> 403
    r = client.post(
        f"/api/game/players/{pid}/seeds/buy",
        json={"strain_id": sid},
        headers={"X-API-Key": "nope"},
    )
    assert r.status_code == 403

    # Correct key -> success
    r = client.post(
        f"/api/game/players/{pid}/seeds/buy",
        json={"strain_id": sid},
        headers={"X-API-Key": key},
    )
    assert r.status_code == 201


def test_reads_stay_public(client):
    # Strain catalog needs no key.
    assert client.get("/api/game/strains").status_code == 200
