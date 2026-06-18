"""
Branch coverage for the request-input validators (`api/validation.py`), the app
factory + error handlers (`api/flask_api.py`, `api/errors.py`).

The validators are tested DIRECTLY — import the helper, feed it bad input, assert
it raises `GameError`, plus the boundary values that must NOT raise. The factory
branches that previous tests skipped (the `init_database=True` path, the
ElevenLabs prewarm branch, the `/` index route) are driven through a test client.
The error handlers that only the framework can fire (StaleDataError -> 409,
unhandled Exception -> 500) are exercised with throwaway routes registered on a
fresh app that has the handlers installed.

Complements tests/test_errors.py (HTTP 404/405/cap) and tests/test_http_boundary.py
(route-level 400s) without duplicating them: this file hits the helpers and
factory/handler branches those don't reach.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from decimal import Decimal

import pytest

from growpodempire.api import validation as v
from growpodempire.services.game_service import GameError


# --- positive_int ------------------------------------------------------------

def test_positive_int_none_with_default_returns_default():
    # line 23-24: value is None but a default is supplied.
    assert v.positive_int(None, "qty", default=7) == 7


def test_positive_int_none_without_default_raises():
    # line 25: required field missing.
    with pytest.raises(GameError, match="qty is required"):
        v.positive_int(None, "qty")


def test_positive_int_non_integer_raises():
    # line 28-29: int() coercion fails.
    with pytest.raises(GameError, match="must be an integer"):
        v.positive_int("not-a-number", "qty")
    with pytest.raises(GameError, match="must be an integer"):
        v.positive_int(object(), "qty")  # TypeError path


def test_positive_int_below_one_raises():
    with pytest.raises(GameError, match="must be >= 1"):
        v.positive_int(0, "qty")


def test_positive_int_above_maximum_raises():
    # line 33: exceeds the explicit/ default maximum.
    with pytest.raises(GameError, match="must be <= 5"):
        v.positive_int(6, "qty", maximum=5)
    with pytest.raises(GameError, match=str(v.MAX_QUANTITY)):
        v.positive_int(v.MAX_QUANTITY + 1, "qty")


def test_positive_int_boundaries_ok():
    assert v.positive_int(1, "qty") == 1
    assert v.positive_int("5", "qty", maximum=5) == 5  # string coercion + upper bound
    assert v.positive_int(v.MAX_QUANTITY, "qty") == v.MAX_QUANTITY


# --- bounded_int -------------------------------------------------------------

def test_bounded_int_none_or_empty_returns_default():
    # line 40: None and "" both fall back to the default.
    assert v.bounded_int(None, "page", default=3, low=1, high=10) == 3
    assert v.bounded_int("", "page", default=3, low=1, high=10) == 3


def test_bounded_int_non_integer_raises():
    # line 43-44: int() coercion fails.
    with pytest.raises(GameError, match="must be an integer"):
        v.bounded_int("abc", "page", default=1, low=1, high=10)
    with pytest.raises(GameError, match="must be an integer"):
        v.bounded_int(object(), "page", default=1, low=1, high=10)


def test_bounded_int_clamps_to_range():
    # max(low, min(high, n)) on both sides of the band.
    assert v.bounded_int(100, "page", default=1, low=1, high=10) == 10
    assert v.bounded_int(-5, "page", default=1, low=1, high=10) == 1
    assert v.bounded_int(5, "page", default=1, low=1, high=10) == 5


# --- number ------------------------------------------------------------------

def test_number_non_numeric_raises():
    with pytest.raises(GameError, match="must be a number"):
        v.number("xyz", "temp", low=0, high=100)


def test_number_out_of_range_and_nan_raise():
    with pytest.raises(GameError, match="between 0 and 100"):
        v.number(101, "temp", low=0, high=100)
    # NaN fails the range test (all comparisons with NaN are False).
    with pytest.raises(GameError, match="between"):
        v.number(float("nan"), "temp", low=0, high=100)


def test_number_boundaries_ok():
    assert v.number(0, "temp", low=0, high=100) == 0.0
    assert v.number("100", "temp", low=0, high=100) == 100.0


# --- positive_money ----------------------------------------------------------

def test_positive_money_none_raises():
    # line 68: required field missing.
    with pytest.raises(GameError, match="amount is required"):
        v.positive_money(None, "amount")


def test_positive_money_non_numeric_raises():
    with pytest.raises(GameError, match="must be a number"):
        v.positive_money("not-money", "amount")


def test_positive_money_non_finite_raises():
    # line 74: inf/nan are valid Decimals but not finite.
    with pytest.raises(GameError, match="finite"):
        v.positive_money(float("inf"), "amount")
    with pytest.raises(GameError, match="finite"):
        v.positive_money("NaN", "amount")


def test_positive_money_nonpositive_raises():
    with pytest.raises(GameError, match="must be positive"):
        v.positive_money(0, "amount")
    with pytest.raises(GameError, match="must be positive"):
        v.positive_money("-1", "amount")


def test_positive_money_above_maximum_raises():
    # line 78: exceeds the cap.
    with pytest.raises(GameError, match="must be <="):
        v.positive_money(v.MAX_MONEY + 1, "amount")


def test_positive_money_boundaries_ok():
    assert v.positive_money("0.01", "amount") == Decimal("0.01")
    assert v.positive_money(v.MAX_MONEY, "amount") == v.MAX_MONEY


# --- flask_api factory branches ----------------------------------------------

def test_create_app_runs_init_db_when_requested(db, monkeypatch):
    """init_database=True path (line 52): init_db is invoked exactly once."""
    import growpodempire.api.flask_api as fa

    calls = []
    monkeypatch.setattr(fa, "init_db", lambda *a, **k: calls.append(True))
    app = fa.create_app(init_database=True)
    assert app is not None
    assert calls == [True]


def test_create_app_starts_prewarm_when_elevenlabs_key_set(db, monkeypatch):
    """ElevenLabs prewarm branch (lines 78-80): runs only when a key is set."""
    import growpodempire.api.flask_api as fa
    from growpodempire.config import get_settings

    # Make the resolved settings report an ElevenLabs key.
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-key")
    get_settings.cache_clear()

    started = []
    import growpodempire.api.audio_prewarm as ap
    monkeypatch.setattr(ap, "start_prewarm_thread", lambda *a, **k: started.append(True))

    fa.create_app(init_database=False)
    assert started == [True]


def test_index_route_returns_api_descriptor(db):
    """`/` index route (line 92) returns the JSON service descriptor."""
    from growpodempire.api.flask_api import create_app

    client = create_app(init_database=False).test_client()
    r = client.get("/")
    assert r.status_code == 200
    body = r.get_json()
    assert body["name"] == "GROWv2 API"
    assert "version" in body
    assert body["endpoints"]["game"] == "/api/game"
    assert body["endpoints"]["docs"] == "/docs"


# --- errors.py handler branches ----------------------------------------------

def _app_with_handlers():
    """Fresh Flask app with only the error handlers installed + test routes that
    raise the two exceptions the framework-level handlers exist to catch."""
    from flask import Flask
    from sqlalchemy.orm.exc import StaleDataError

    from growpodempire.api.errors import register_error_handlers

    app = Flask(__name__)
    app.config["PROPAGATE_EXCEPTIONS"] = False
    register_error_handlers(app)

    @app.route("/boom/stale")
    def _stale():
        raise StaleDataError("row changed under us")

    @app.route("/boom/unexpected")
    def _unexpected():
        raise RuntimeError("kaboom")

    return app


def test_stale_data_error_maps_to_409_json():
    """errors.py line 33: StaleDataError -> clean 409 retry hint."""
    client = _app_with_handlers().test_client()
    r = client.get("/boom/stale")
    assert r.status_code == 409
    body = r.get_json()
    assert body["status"] == 409
    assert "retry" in body["error"].lower()


def test_unhandled_exception_maps_to_500_json():
    """errors.py lines 40-41: any other Exception -> generic 500 (no leak)."""
    client = _app_with_handlers().test_client()
    r = client.get("/boom/unexpected")
    assert r.status_code == 500
    body = r.get_json()
    assert body["status"] == 500
    assert body["error"] == "Internal server error"
    # No internal detail ("kaboom") leaked to the client.
    assert "kaboom" not in body["error"]


def test_register_error_handlers_preserves_existing_content_length_cap():
    """errors.py line 21 false branch: a pre-set cap is not overwritten."""
    from flask import Flask

    from growpodempire.api.errors import register_error_handlers

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 4242
    register_error_handlers(app)
    assert app.config["MAX_CONTENT_LENGTH"] == 4242
