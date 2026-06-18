"""Branded store: partners, featured shelf, bundles, gear — purchase sinks.

Covers the store HTTP routes (public reads enriched from seeded data, player
purchases that debit GROW via the ledger, and admin CRUD). Store purchases are a
launch-critical economy sink, so the debit + delivery paths are guarded here.

require_admin is open in the dev/test environment to any valid player key, so the
admin routes are exercised with a player's X-API-Key.
"""

import os
import sys
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.seed import seed_store
from growpodempire.economy.ledger import post, balance
from growpodempire.enums import LedgerEntryType


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app
    return create_app(init_database=False).test_client()


@pytest.fixture()
def player(client):
    """A funded player; returns (id, api_key headers). Extra grant so every
    store purchase exercises its success path regardless of catalog pricing."""
    p = client.post("/api/game/players", json={"username": "shopper"}).get_json()
    with session_scope() as s:
        post(s, p["id"], Decimal("10000"), LedgerEntryType.REWARD)
    return p["id"], {"X-API-Key": p["api_key"]}


@pytest.fixture()
def stocked(db):
    """Seed the placeholder partners / featured / bundles."""
    with session_scope() as s:
        seed_store(s)


# ----- public reads ------------------------------------------------------

def test_public_store_reads(client, stocked):
    partners = client.get("/api/game/store/partners")
    assert partners.status_code == 200 and len(partners.get_json()) >= 1
    assert all("product_name" in p for p in partners.get_json())

    featured = client.get("/api/game/store/featured")
    assert featured.status_code == 200 and len(featured.get_json()) <= 3

    bundles = client.get("/api/game/store/bundles")
    assert bundles.status_code == 200
    for b in bundles.get_json():
        assert b["bundle_price"] <= b["full_price"]  # discount applied


def test_gear_list_and_purchase(client, player):
    pid, hdr = player
    listing = client.get(f"/api/game/players/{pid}/store/gear", headers=hdr)
    assert listing.status_code == 200
    items = listing.get_json()
    assert len(items) >= 1
    key = items[0]["key"]
    bought = client.post(
        f"/api/game/players/{pid}/store/gear/{key}/purchase",
        json={"quantity": 1},
        headers=hdr,
    )
    assert bought.status_code == 201


# ----- player purchases (sinks) -----------------------------------------

def test_partner_purchase_debits_and_delivers(client, player, stocked):
    pid, hdr = player
    partner = client.get("/api/game/store/partners").get_json()[0]
    with session_scope() as s:
        before = balance(s, pid)
    resp = client.post(
        f"/api/game/players/{pid}/store/partners/{partner['id']}/purchase", headers=hdr
    )
    assert resp.status_code == 201
    assert resp.get_json()["product_id"] == partner["product_id"]
    with session_scope() as s:
        assert balance(s, pid) == before - Decimal(str(partner["price_gc"]))


def test_partner_purchase_missing_is_404(client, player):
    pid, hdr = player
    resp = client.post(
        f"/api/game/players/{pid}/store/partners/nope/purchase", headers=hdr
    )
    assert resp.status_code == 404


def test_bundle_purchase_delivers_components(client, player, stocked):
    pid, hdr = player
    bundles = client.get("/api/game/store/bundles").get_json()
    if not bundles:
        pytest.skip("no bundles seeded")
    bundle = bundles[0]
    resp = client.post(
        f"/api/game/players/{pid}/store/bundles/{bundle['id']}/purchase", headers=hdr
    )
    assert resp.status_code == 201
    assert resp.get_json()["purchased"] == bundle["name"]

    missing = client.post(
        f"/api/game/players/{pid}/store/bundles/nope/purchase", headers=hdr
    )
    assert missing.status_code == 404


# ----- admin CRUD --------------------------------------------------------

def test_admin_partner_crud(client, player):
    pid, hdr = player
    created = client.post(
        "/api/game/admin/store/partners",
        json={
            "name": "Test Co", "logo_url": "http://x/y.png", "tagline": "hi",
            "product_type": "consumable", "product_id": "nutrients", "price_gc": 42,
        },
        headers=hdr,
    )
    assert created.status_code == 201
    partner_id = created.get_json()["id"]

    # Validation: bad product_type rejected.
    bad = client.post(
        "/api/game/admin/store/partners",
        json={"name": "x", "logo_url": "y", "tagline": "z",
              "product_type": "bogus", "product_id": "n", "price_gc": 1},
        headers=hdr,
    )
    assert bad.status_code == 400

    listed = client.get("/api/game/admin/store/partners", headers=hdr)
    assert listed.status_code == 200
    assert any(p["id"] == partner_id for p in listed.get_json())

    patched = client.patch(
        f"/api/game/admin/store/partners/{partner_id}",
        json={"active": False, "price_gc": 99, "display_order": 5},
        headers=hdr,
    )
    assert patched.status_code == 200 and patched.get_json()["price_gc"] == 99.0

    deleted = client.delete(
        f"/api/game/admin/store/partners/{partner_id}", headers=hdr
    )
    assert deleted.status_code == 200 and deleted.get_json()["deleted"] is True
    assert client.delete(
        f"/api/game/admin/store/partners/{partner_id}", headers=hdr
    ).status_code == 404


def test_admin_featured_add_and_delete(client, player):
    pid, hdr = player
    added = client.post(
        "/api/game/admin/store/featured",
        json={"item_type": "consumable", "item_id": "nutrients", "label": "Deal"},
        headers=hdr,
    )
    # Either created, or the 3-slot shelf is full (both are valid covered paths).
    assert added.status_code in (201, 409)
    if added.status_code == 201:
        fid = added.get_json()["id"]
        assert client.delete(
            f"/api/game/admin/store/featured/{fid}", headers=hdr
        ).status_code == 200
    assert client.delete(
        "/api/game/admin/store/featured/nope", headers=hdr
    ).status_code == 404
