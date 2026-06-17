"""Uniform JSON error handling."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.api.flask_api import create_app


@pytest.fixture()
def client(db):
    return create_app(init_database=False).test_client()


def test_unknown_route_returns_json_404(client):
    r = client.get("/api/game/does-not-exist")
    assert r.status_code == 404
    body = r.get_json()
    assert body is not None and "error" in body and body["status"] == 404


def test_wrong_method_returns_json_405(client):
    # /api/game/strains is GET-only.
    r = client.delete("/api/game/strains")
    assert r.status_code == 405
    body = r.get_json()
    assert body is not None and "error" in body


def test_max_content_length_configured(client):
    assert client.application.config["MAX_CONTENT_LENGTH"] == 1 * 1024 * 1024
