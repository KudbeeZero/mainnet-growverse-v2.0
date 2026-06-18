"""Bundle-purchase edge branches in game_api.py (around lines 1693-1788).

test_store.py already covers the happy path of a seeded all-consumable bundle and
the 404 for a missing/inactive bundle. This file targets the UNCOVERED edge
branches of POST /players/<id>/store/bundles/<id>/purchase by seeding bundles with
edge-shaped components directly via the real ORM:

  * strain component price calc + seed delivery   (1693-1703, 1728-1742)
  * a strain whose rarity is unpriceable -> price-calc exception -> +0.0 fallback (1702-1703)
  * a component with qty < 1 is skipped on delivery (1713)
  * a consumable component with no key is skipped on delivery (1717)
  * a strain component with no strain_id is skipped on delivery (1730-1731)

All offline: real models + Flask test client, no SDK mocking, no network.
"""

import os
import sys
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Bundle, Strain, SeedInventory, ConsumableInventory
from growpodempire.economy.ledger import post, balance
from growpodempire.enums import LedgerEntryType


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app
    return create_app(init_database=False).test_client()


@pytest.fixture()
def player(client):
    """A funded player; returns (id, X-API-Key headers)."""
    p = client.post("/api/game/players", json={"username": "bundler"}).get_json()
    with session_scope() as s:
        post(s, p["id"], Decimal("100000"), LedgerEntryType.REWARD)
    return p["id"], {"X-API-Key": p["api_key"]}


def _make_bundle(components, *, name="Edge Bundle", discount=0.10, active=True):
    """Insert a bundle with arbitrary component shapes; return its id."""
    with session_scope() as s:
        b = Bundle(
            name=name,
            description="edge-case bundle for coverage",
            discount_pct=discount,
            components=components,
            active=active,
        )
        s.add(b)
        s.flush()
        return b.id


def _a_real_strain_id():
    with session_scope() as s:
        st = s.query(Strain).filter(Strain.is_base_catalog.is_(True)).first()
        return st.id


def _bogus_rarity_strain_id():
    """A strain row with an unpriceable rarity so seed_price() raises and the
    purchase route falls back to +0.0 (game_api.py 1702-1703)."""
    with session_scope() as s:
        st = Strain(
            name="Glitch Kush",
            slug="glitch-kush-coverage",
            lineage_type="hybrid",
            rarity="mythical_unpriceable",  # not a valid Rarity -> seed_price raises
            indica_ratio=0.5,
            thc_min=10.0, thc_max=20.0,
            cbd_min=0.0, cbd_max=1.0,
            flowering_days_min=50, flowering_days_max=60,
            yield_min=100.0, yield_max=200.0,
            difficulty=3,
            genome={},
            is_base_catalog=False,
        )
        s.add(st)
        s.flush()
        return st.id


# ----- strain component: price calc + delivery (1693-1703, 1728-1742) -----

def test_bundle_with_strain_component_prices_and_delivers_seed(client, player):
    pid, hdr = player
    strain_id = _a_real_strain_id()
    with session_scope() as s:
        existing = (
            s.query(SeedInventory)
            .filter(SeedInventory.player_id == pid, SeedInventory.strain_id == strain_id)
            .one_or_none()
        )
        before_qty = existing.quantity if existing else 0
    bid = _make_bundle(
        [{"type": "strain", "strain_id": strain_id, "qty": 2}],
        name="Strain Pack",
    )

    resp = client.post(
        f"/api/game/players/{pid}/store/bundles/{bid}/purchase", headers=hdr
    )
    assert resp.status_code == 201
    body = resp.get_json()
    delivered = body["items_delivered"]
    # Strain price-calc branch (1693-1703) ran; seed delivered (1728-1742).
    assert delivered == [{"type": "strain", "strain_id": strain_id, "qty": 2}]

    # Seed stack carries the bundle-sourced quantity added on top of any starter.
    with session_scope() as s:
        stack = (
            s.query(SeedInventory)
            .filter(SeedInventory.player_id == pid, SeedInventory.strain_id == strain_id)
            .one()
        )
        assert stack.quantity == before_qty + 2


def test_bundle_strain_unpriceable_rarity_falls_back_to_zero(client, player):
    """seed_price() raises on the bogus rarity -> component contributes 0.0 to the
    full price (1702-1703), but the seed is still delivered."""
    pid, hdr = player
    strain_id = _bogus_rarity_strain_id()
    bid = _make_bundle(
        [{"type": "strain", "strain_id": strain_id, "qty": 1}],
        name="Glitch Pack",
        discount=0.0,
    )
    with session_scope() as s:
        before = balance(s, pid)

    resp = client.post(
        f"/api/game/players/{pid}/store/bundles/{bid}/purchase", headers=hdr
    )
    assert resp.status_code == 201
    assert resp.get_json()["items_delivered"] == [
        {"type": "strain", "strain_id": strain_id, "qty": 1}
    ]
    # Price fell back to 0.0 -> no money moved.
    with session_scope() as s:
        assert balance(s, pid) == before
        assert (
            s.query(SeedInventory)
            .filter(SeedInventory.player_id == pid, SeedInventory.strain_id == strain_id)
            .one()
            .quantity
            == 1
        )


# ----- delivery-skip branches (1713, 1717, 1730-1731) --------------------

def test_bundle_skips_qty_below_one(client, player):
    """A component with qty < 1 is skipped during delivery (1713)."""
    pid, hdr = player
    bid = _make_bundle(
        [
            {"type": "consumable", "key": "neem_oil", "qty": 0},
            {"type": "consumable", "key": "bloom_booster", "qty": 1},
        ],
        name="Zero Qty Bundle",
    )
    resp = client.post(
        f"/api/game/players/{pid}/store/bundles/{bid}/purchase", headers=hdr
    )
    assert resp.status_code == 201
    delivered = resp.get_json()["items_delivered"]
    keys = {d["key"] for d in delivered}
    assert keys == {"bloom_booster"}  # qty=0 component dropped
    with session_scope() as s:
        assert (
            s.query(ConsumableInventory)
            .filter(
                ConsumableInventory.player_id == pid,
                ConsumableInventory.item_key == "neem_oil",
            )
            .one_or_none()
            is None
        )


def test_bundle_skips_consumable_without_key(client, player):
    """A consumable component with an empty key is skipped (1717)."""
    pid, hdr = player
    bid = _make_bundle(
        [
            {"type": "consumable", "key": "", "qty": 1},
            {"type": "consumable", "key": "neem_oil", "qty": 1},
        ],
        name="No Key Bundle",
    )
    resp = client.post(
        f"/api/game/players/{pid}/store/bundles/{bid}/purchase", headers=hdr
    )
    assert resp.status_code == 201
    delivered = resp.get_json()["items_delivered"]
    assert [d["key"] for d in delivered] == ["neem_oil"]


def test_bundle_skips_strain_without_strain_id(client, player):
    """A strain component with no strain_id is skipped on delivery (1730-1731)."""
    pid, hdr = player
    bid = _make_bundle(
        [
            {"type": "strain", "strain_id": "", "qty": 1},
            {"type": "consumable", "key": "neem_oil", "qty": 1},
        ],
        name="No Strain Id Bundle",
    )
    resp = client.post(
        f"/api/game/players/{pid}/store/bundles/{bid}/purchase", headers=hdr
    )
    assert resp.status_code == 201
    delivered = resp.get_json()["items_delivered"]
    # Only the consumable delivered; the keyless strain produced nothing (no
    # delivered entry of type "strain").
    assert delivered == [{"type": "consumable", "key": "neem_oil", "qty": 1}]
    assert not any(d["type"] == "strain" for d in delivered)
