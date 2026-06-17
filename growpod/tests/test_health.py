"""Health/readiness probes and request-id header."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.api.flask_api import create_app


@pytest.fixture()
def client(db):
    return create_app(init_database=False).test_client()


def test_health_is_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.get_json()["status"] == "ok"
    assert r.headers.get("X-Request-ID")


def test_readiness_pings_db(client):
    r = client.get("/readiness")
    assert r.status_code == 200
    body = r.get_json()
    assert body["status"] == "ready" and body["database"] == "ok"


def test_request_id_is_echoed(client):
    r = client.get("/health", headers={"X-Request-ID": "abc123"})
    assert r.headers.get("X-Request-ID") == "abc123"
