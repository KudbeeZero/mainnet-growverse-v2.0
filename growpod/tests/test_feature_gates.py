"""Route gating is driven by the single balance.yaml feature-flag source.

After the BE-003 reconciliation there is ONE flag system: balance.yaml
`feature_flags:` resolved by ``growpodempire.feature_flags`` (env override via
``FEATURE_<NAME>``), gated on routes with ``feature_required`` and surfaced at
``GET /api/game/flags``. These tests prove the route gates and the ``/flags``
map never disagree, that a gated route 404s before auth when its flag is off,
and that the core loop is unaffected.
"""
import pytest

from growpodempire.api.flask_api import create_app


def _client(monkeypatch, **flags):
    """A test client; ``flags`` are FEATURE_<NAME> env overrides (str values)."""
    for key, val in flags.items():
        monkeypatch.setenv(key, val)
    return create_app(init_database=False).test_client()


# One representative public read per gated surface → its balance.yaml flag.
GATED_READS = [
    ("FEATURE_MARKETPLACE", "marketplace", "/api/game/market"),
    ("FEATURE_CUP_COMPETITIONS", "cup_competitions", "/api/game/cup/current"),
    ("FEATURE_CUP_COMPETITIONS", "cup_competitions", "/api/game/cup/hall-of-fame"),
    ("FEATURE_UNIVERSITY", "university", "/api/game/university/catalog"),
]


@pytest.mark.parametrize("env,flag,path", GATED_READS)
def test_gated_read_404_when_disabled(db, monkeypatch, env, flag, path):
    client = _client(monkeypatch, **{env: "false"})
    assert client.get(path).status_code == 404


@pytest.mark.parametrize("env,flag,path", GATED_READS)
def test_gated_read_reachable_when_enabled(db, monkeypatch, env, flag, path):
    # Defaults are ON; assert explicitly-on works too.
    client = _client(monkeypatch, **{env: "true"})
    assert client.get(path).status_code == 200


@pytest.mark.parametrize("env,flag,path", GATED_READS)
def test_route_gate_agrees_with_flags_endpoint(db, monkeypatch, env, flag, path):
    """The route's reachability must match GET /api/game/flags for that flag —
    the two can never diverge (the bug the reconciliation fixed)."""
    for state, want_ok in (("true", True), ("false", False)):
        client = _client(monkeypatch, **{env: state})
        flags = client.get("/api/game/flags").get_json()["flags"]
        assert flags[flag] is want_ok
        reachable = client.get(path).status_code != 404
        assert reachable is want_ok, (
            f"{path} reachable={reachable} but flags[{flag}]={flags[flag]}"
        )


def test_gate_runs_before_auth(db, monkeypatch):
    """A gated write 404s even with no API key — the gate precedes auth."""
    client = _client(monkeypatch, FEATURE_CHAIN="false")
    r = client.post(
        "/api/game/players/nobody/wallet/link", json={"address": "ADDR"}
    )
    assert r.status_code == 404  # not 401: hidden system looks absent


def test_core_loop_unaffected_when_all_disabled(db, monkeypatch):
    """With every gated surface off, the core grow loop stays reachable."""
    client = _client(
        monkeypatch,
        FEATURE_MARKETPLACE="false",
        FEATURE_CHAIN="false",
        FEATURE_CUP_COMPETITIONS="false",
        FEATURE_UNIVERSITY="false",
        FEATURE_CONTRACTS="false",
    )
    assert client.get("/api/game/strains").status_code == 200


# ----- economy master kill-switch ---------------------------------------
# A representative core-loop WRITE per economy faucet/sink. These are the routes
# the audit flagged as ungated; the `economy` flag now gates them.
ECONOMY_WRITES = [
    "/api/game/players/nobody/seeds/buy",
    "/api/game/players/nobody/harvests/h1/sell",
    "/api/game/players/nobody/shop/buy",
    "/api/game/players/nobody/breed",
    "/api/game/players/nobody/daily",
]


@pytest.mark.parametrize("path", ECONOMY_WRITES)
def test_economy_off_freezes_core_loop_before_auth(db, monkeypatch, path):
    """OFF → a core money route 404s even with no API key (gate precedes auth):
    the whole economy can be frozen in an incident, no deploy required."""
    client = _client(monkeypatch, FEATURE_ECONOMY="false")
    assert client.post(path, json={}).status_code == 404


@pytest.mark.parametrize("path", ECONOMY_WRITES)
def test_economy_on_by_default_lets_core_loop_through_to_auth(db, path):
    """Default ON → the gate passes and the request reaches auth (not 404), which
    preserves current free-playtest behavior. (No env override set here.)"""
    client = create_app(init_database=False).test_client()
    # Bogus player + no key → auth rejects (401/403), but crucially NOT a 404 gate.
    assert client.post(path, json={}).status_code != 404


def test_flags_endpoint_reports_economy(db):
    client = create_app(init_database=False).test_client()
    flags = client.get("/api/game/flags").get_json()["flags"]
    assert flags["economy"] is True
