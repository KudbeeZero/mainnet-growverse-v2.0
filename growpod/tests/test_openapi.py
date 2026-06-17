"""OpenAPI spec + Swagger UI."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.api.flask_api import create_app


@pytest.fixture()
def client(db):
    return create_app(init_database=False).test_client()


def test_openapi_spec_is_valid(client):
    spec = client.get("/openapi.json").get_json()
    assert spec["openapi"].startswith("3.0")
    assert "/api/game/strains" in spec["paths"]
    # Write routes carry the API-key security scheme.
    buy = spec["paths"]["/api/game/players/{player_id}/seeds/buy"]["post"]
    assert buy["security"] == [{"ApiKeyAuth": []}]
    assert spec["components"]["securitySchemes"]["ApiKeyAuth"]["name"] == "X-API-Key"


def test_docs_page_served(client):
    r = client.get("/docs")
    assert r.status_code == 200
    assert "swagger" in r.get_data(as_text=True).lower()
