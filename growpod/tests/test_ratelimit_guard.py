"""The production rate-limit storage guard (api/ratelimit.init_limiter).

This guard 502'd the first production deploy that carried it (2026-07-02):
APP_ENV=production with no Redis attached → RuntimeError on boot → every
gunicorn worker dead. These tests pin all three arms so the behavior can
never change silently again:

  1. prod + memory://              → refuses to boot (RuntimeError)
  2. prod + memory:// + explicit   → boots, with per-worker limits
     RATELIMIT_ALLOW_MEMORY=true
  3. non-prod + memory://          → boots (zero-config dev/CI)
"""

import pytest
from flask import Flask

from growpodempire.api.ratelimit import init_limiter
from growpodempire.config import get_settings


@pytest.fixture()
def app():
    a = Flask(__name__)
    a.config["RATELIMIT_ENABLED"] = True
    a.config["RATELIMIT_STORAGE_URI"] = "memory://"
    return a


@pytest.fixture(autouse=True)
def _fresh_settings(monkeypatch):
    """Each test rebuilds Settings from its own env."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_production_with_memory_storage_refuses_to_boot(app, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("RATELIMIT_ALLOW_MEMORY", raising=False)
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="memory://"):
        init_limiter(app)


def test_production_with_explicit_memory_override_boots(app, monkeypatch, caplog):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("RATELIMIT_ALLOW_MEMORY", "true")
    get_settings.cache_clear()
    init_limiter(app)  # must not raise
    assert any("per-worker" in r.message for r in caplog.records)


def test_non_production_memory_storage_boots(app, monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("RATELIMIT_ALLOW_MEMORY", raising=False)
    get_settings.cache_clear()
    init_limiter(app)  # must not raise
