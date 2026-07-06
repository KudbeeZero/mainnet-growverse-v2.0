"""
Exhaustive feature-GATE coverage for ``api/game_api.py``.

Every route decorated with ``@require_feature(<flag>)`` must, when that flag is
turned OFF, return 404 ("the surface looks absent") instead of running its body
or its auth check. The gate (``feature_required`` -> ``FeatureDisabledError`` ->
the blueprint errorhandler) is the OUTERMOST decorator, so it fires *before*
``@require_player`` — a disabled gated write 404s with no API key at all.

Features default ON in balance.yaml, so the rest of the suite (and the
enabled-path tests in test_market_routes.py / test_*_routes.py) cover the
reachable side. This file is the complementary DISABLED side, walked route by
route so each gated view's gate-branch is exercised individually.

Flags are flipped per-test with ``monkeypatch.setenv("FEATURE_<NAME>", "false")``
(env override, the documented mechanism). monkeypatch auto-restores the env after
each test; the autouse ``_fresh_settings`` fixture in conftest already clears the
``get_settings`` cache around every test, so no manual teardown of cached state is
needed and nothing leaks into other tests.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest


@pytest.fixture()
def client(db):
    """Plain Flask test client over a fresh, seeded SQLite DB."""
    from growpodempire.api.flask_api import create_app

    return create_app(init_database=False).test_client()


# Every gated route, as (feature-flag name, HTTP method, URL path). Path params
# use throwaway ids — the gate fires before any lookup, so the values never
# matter (and the body never runs to validate them). Bodies are likewise
# irrelevant for the disabled path; we send a minimal valid-shaped JSON where the
# method is a write so request parsing isn't what differs.
GATED_ROUTES = [
    # ----- marketplace -----
    ("marketplace", "GET", "/api/game/market"),
    ("marketplace", "POST", "/api/game/players/p1/market/list"),
    ("marketplace", "POST", "/api/game/players/p1/market/auction"),
    ("marketplace", "POST", "/api/game/players/p1/market/L1/bid"),
    ("marketplace", "POST", "/api/game/players/p1/market/L1/settle"),
    ("marketplace", "POST", "/api/game/players/p1/market/L1/buy"),
    # ----- contracts -----
    ("contracts", "GET", "/api/game/players/p1/contracts"),
    ("contracts", "POST", "/api/game/players/p1/contracts/offer"),
    ("contracts", "POST", "/api/game/players/p1/contracts/C1/fulfill"),
    # ----- cup / competitions -----
    ("cup_competitions", "GET", "/api/game/cup/current"),
    ("cup_competitions", "GET", "/api/game/cup/CUP1/standings"),
    ("cup_competitions", "GET", "/api/game/cup/hall-of-fame"),
    ("cup_competitions", "POST", "/api/game/players/p1/cup/enter"),
    # ----- university -----
    ("university", "GET", "/api/game/university/catalog"),
    ("university", "GET", "/api/game/players/p1/university"),
    ("university", "POST", "/api/game/players/p1/courses/cultivation_101/enroll"),
    ("university", "POST", "/api/game/players/p1/courses/cultivation_101/complete"),
    ("university", "POST", "/api/game/players/p1/degrees/horticulture/claim"),
    ("university", "GET", "/api/game/players/p1/courses/cultivation_101/lecture"),
    ("university", "GET", "/api/game/university/courses/cultivation_101/audio"),
    # ----- seasonal strain drops -----
    ("seasonal_strains", "GET", "/api/game/seasonal/strains"),
    ("seasonal_strains", "POST", "/api/game/players/p1/seasonal/strains/S1/purchase"),
    # ----- chain / wallet / NFT -----
    ("chain", "POST", "/api/game/players/p1/wallet/link"),
    ("chain", "POST", "/api/game/players/p1/wallet/withdraw"),
    ("chain", "POST", "/api/game/players/p1/wallet/deposit"),
    ("chain", "POST", "/api/game/players/p1/harvests/H1/mint"),
    ("chain", "POST", "/api/game/players/p1/strains/ST1/mint"),
    ("chain", "GET", "/api/game/nft/harvest/H1.json"),
    # ----- NFT marketplace (Sprint 4, OFF by default) -----
    ("nft_marketplace", "GET", "/api/nft/players/p1/collection"),
    ("nft_marketplace", "POST", "/api/nft/players/p1/mint"),
    ("nft_marketplace", "GET", "/api/market/listings"),
    ("nft_marketplace", "GET", "/api/market/listings/L1"),
    ("nft_marketplace", "POST", "/api/market/players/p1/listings"),
    ("nft_marketplace", "DELETE", "/api/market/players/p1/listings/L1"),
    ("nft_marketplace", "POST", "/api/market/players/p1/execute/L1"),
    ("nft_marketplace", "GET", "/api/market/history/1"),
    # ----- NFT staking / curing room (Sprint 4, OFF by default) -----
    ("nft_staking", "POST", "/api/stakes/players/p1"),
    ("nft_staking", "GET", "/api/stakes/players/p1"),
    ("nft_staking", "GET", "/api/stakes/players/p1/LOCK1"),
    ("nft_staking", "POST", "/api/stakes/players/p1/LOCK1/claim"),
]


def _call(client, method, path):
    if method == "GET":
        return client.get(path)
    if method == "DELETE":
        return client.delete(path)
    # A minimal body so request.get_json doesn't change behaviour; the gate runs
    # before the body is ever inspected.
    return client.post(path, json={})


@pytest.mark.parametrize(
    "flag,method,path",
    GATED_ROUTES,
    ids=[f"{flag}:{method}:{path}" for flag, method, path in GATED_ROUTES],
)
def test_gated_route_404_when_feature_disabled(client, monkeypatch, flag, method, path):
    """With the feature OFF, the route returns 404 and the disabled-feature
    message — the gate, not auth or a not-found lookup, produced it."""
    monkeypatch.setenv(f"FEATURE_{flag.upper()}", "false")

    resp = _call(client, method, path)

    assert resp.status_code == 404, (
        f"{method} {path} returned {resp.status_code}, expected 404 when "
        f"FEATURE_{flag.upper()} is off"
    )
    body = resp.get_json(silent=True) or {}
    # The errorhandler renders FeatureDisabledError as {"error": "Feature '<flag>' is not available"}.
    assert "error" in body
    assert flag in body["error"]
    assert "not available" in body["error"]


def test_gate_precedes_auth_no_api_key(client, monkeypatch):
    """A gated WRITE 404s with no API key supplied — proving the feature gate is
    the outer decorator and short-circuits before @require_player (which would
    otherwise 401). Hidden surfaces read as absent, not as auth-protected."""
    monkeypatch.setenv("FEATURE_CHAIN", "false")
    resp = client.post("/api/game/players/p1/wallet/link", json={"address": "ADDR"})
    assert resp.status_code == 404
    # Not 401 — auth never ran.
    assert resp.status_code != 401


def test_flags_endpoint_reflects_disabled_state(client, monkeypatch):
    """The public /flags map reports the override-applied (disabled) state, so a
    client can gate UI without probing each route."""
    monkeypatch.setenv("FEATURE_MARKETPLACE", "false")
    monkeypatch.setenv("FEATURE_UNIVERSITY", "false")
    flags = client.get("/api/game/flags").get_json()["flags"]
    assert flags["marketplace"] is False
    assert flags["university"] is False
    # A flag we did not touch stays at its ON default.
    assert flags["contracts"] is True


def test_disabling_one_flag_does_not_gate_a_sibling(client, monkeypatch):
    """Turning marketplace OFF must not affect an unrelated gated surface:
    university (left ON) still serves its public catalog with 200."""
    monkeypatch.setenv("FEATURE_MARKETPLACE", "false")
    assert client.get("/api/game/market").status_code == 404
    assert client.get("/api/game/university/catalog").status_code == 200


@pytest.mark.parametrize(
    "flag,method,path",
    [
        ("marketplace", "GET", "/api/game/market"),
        ("cup_competitions", "GET", "/api/game/cup/current"),
        ("university", "GET", "/api/game/university/catalog"),
        ("seasonal_strains", "GET", "/api/game/seasonal/strains"),
    ],
)
def test_unrecognised_env_value_falls_back_to_on_default(
    client, monkeypatch, flag, method, path
):
    """An unrecognised FEATURE_<NAME> value (not in the true/false token sets) is
    ignored and the balance.yaml default (ON) wins — the route stays reachable."""
    monkeypatch.setenv(f"FEATURE_{flag.upper()}", "maybe")
    assert _call(client, method, path).status_code == 200
