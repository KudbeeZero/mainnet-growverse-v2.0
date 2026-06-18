"""Launch-critical API coverage — the store, seasonal drops, economy dashboard,
and settlement endpoints that the economy depends on but were untested.

Test-only: drives the real HTTP routes (admin uses the dev fallback: any valid
player key is accepted off-production). No production behavior is changed here.
"""

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.api.flask_api import create_app
from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, Bundle


@pytest.fixture()
def client(db):
    return create_app(init_database=False).test_client()


def _player(client):
    p = client.post("/api/game/players", json={"username": "shopper"}).get_json()
    return p["id"], {"X-API-Key": p["api_key"]}


def _a_strain_id(client):
    return client.get("/api/game/strains").get_json()[0]["id"]


# ----- Store: partners -------------------------------------------------------
def test_store_partner_admin_and_purchase_flow(client):
    pid, hdr = _player(client)
    # admin create (consumable partner, cheap)
    created = client.post(
        "/api/game/admin/store/partners",
        json={"name": "GrowCo", "logo_url": "http://x/y.png", "tagline": "best",
              "product_type": "consumable", "product_id": "neem_oil", "price_gc": 10},
        headers=hdr,
    )
    assert created.status_code == 201
    partner_id = created.get_json()["id"]

    assert client.get("/api/game/store/partners").status_code == 200
    assert client.get("/api/game/admin/store/partners", headers=hdr).status_code == 200

    patched = client.patch(
        f"/api/game/admin/store/partners/{partner_id}",
        json={"price_gc": 12, "display_order": 1, "active": True, "tagline": "fresh"},
        headers=hdr,
    )
    assert patched.status_code == 200

    bought = client.post(
        f"/api/game/players/{pid}/store/partners/{partner_id}/purchase", headers=hdr
    )
    assert bought.status_code == 201

    assert client.delete(
        f"/api/game/admin/store/partners/{partner_id}", headers=hdr
    ).status_code == 200


# ----- Store: featured shelf -------------------------------------------------
def test_store_featured_admin_flow(client):
    pid, hdr = _player(client)
    created = client.post(
        "/api/game/admin/store/featured",
        json={"item_type": "consumable", "item_id": "neem_oil", "label": "Pick"},
        headers=hdr,
    )
    assert created.status_code == 201
    fid = created.get_json()["id"]
    assert client.get("/api/game/store/featured").status_code == 200
    assert client.delete(
        f"/api/game/admin/store/featured/{fid}", headers=hdr
    ).status_code == 200


# ----- Store: bundles --------------------------------------------------------
def test_store_bundle_list_and_purchase(client):
    pid, hdr = _player(client)
    # Seed a bundle directly (no admin endpoint for bundles).
    with session_scope() as s:
        b = Bundle(
            name="Starter Pack", description="two consumables", discount_pct=0.1,
            components=[{"type": "consumable", "key": "neem_oil", "qty": 2}],
            active=True,
        )
        s.add(b)
        s.flush()
        bundle_id = b.id

    assert client.get("/api/game/store/bundles").status_code == 200
    bought = client.post(
        f"/api/game/players/{pid}/store/bundles/{bundle_id}/purchase", headers=hdr
    )
    assert bought.status_code == 201
    assert bought.get_json()["items_delivered"]


# ----- Seasonal strain drops -------------------------------------------------
def test_seasonal_admin_and_purchase_flow(client):
    pid, hdr = _player(client)
    strain_id = _a_strain_id(client)
    month = datetime.utcnow().strftime("%Y-%m")

    created = client.post(
        "/api/game/admin/seasonal/strains",
        json={"strain_id": strain_id, "available_month": month, "price_gc": 20,
              "auto_renew": True},
        headers=hdr,
    )
    assert created.status_code == 201
    seasonal_id = created.get_json()["id"]

    assert client.get("/api/game/seasonal/strains").status_code == 200
    assert client.get("/api/game/admin/seasonal/strains", headers=hdr).status_code == 200

    bought = client.post(
        f"/api/game/players/{pid}/seasonal/strains/{seasonal_id}/purchase", headers=hdr
    )
    assert bought.status_code == 201

    assert client.post(
        "/api/game/admin/seasonal/strains/rollover", headers=hdr
    ).status_code == 200
    assert client.delete(
        f"/api/game/admin/seasonal/strains/{seasonal_id}", headers=hdr
    ).status_code == 204


# ----- Read sweep (player + strain GET surfaces) -----------------------------
def test_player_and_strain_read_endpoints(client):
    pid, hdr = _player(client)
    sid = _a_strain_id(client)
    for path in [
        f"/api/game/players/{pid}/wallet",
        f"/api/game/players/{pid}/level",
        f"/api/game/players/{pid}/ledger",
        f"/api/game/players/{pid}/profile",
        f"/api/game/players/{pid}/pods",
        f"/api/game/players/{pid}/plants",
        f"/api/game/players/{pid}/harvests",
        f"/api/game/players/{pid}/shop",
        f"/api/game/players/{pid}/research",
        f"/api/game/players/{pid}/achievements",
        f"/api/game/players/{pid}/favorites",
        f"/api/game/strains/{sid}",
        f"/api/game/strains/{sid}/provenance",
        f"/api/game/strains/{sid}/lineage",
        f"/api/game/strains/{sid}/knowledge",
        f"/api/game/strains/{sid}/effects",
    ]:
        r = client.get(path, headers=hdr)
        assert r.status_code == 200, f"{path} -> {r.status_code}"


# ----- Economy dashboard (ledger summary) ------------------------------------
def test_admin_economy_ledger_summary(client):
    pid, hdr = _player(client)
    # Generate a little ledger activity (the starting grant always exists).
    r = client.get("/api/game/admin/economy/ledger-summary?days=7", headers=hdr)
    assert r.status_code == 200
    body = r.get_json()
    assert body["days"] == 7
    assert "daily" in body and "period_gc" in body
    assert isinstance(body["totals"]["minted"], (int, float))
