"""
Cold-start coverage for db/session.py engine + sessionmaker construction.

conftest's `db` fixture rebinds the global engine via reset_engine_for_tests()
at import/first-use, so by the time any test runs the module-level singletons
(`_engine`, `_SessionLocal`) are already populated. That hides the lazy
first-use branches inside get_engine() / get_sessionmaker():

- session.py 45-58 : get_engine() first call -> read settings.database_url,
                     (for sqlite) set connect_args check_same_thread=False,
                     create_engine(...), and register the pragma listener.
- session.py 66    : get_sessionmaker() first call constructs the sessionmaker;
                     this file also exercises the cache-hit (second call) return.

SAFETY: these singletons are process-global and shared by the seeded test DB
used across the whole suite. We never permanently reset them. Every reset goes
through monkeypatch.setattr(sess, "_engine", None) / ("_SessionLocal", None),
which RESTORES the original objects at teardown even though the function under
test reassigns the global. The engine-init test points settings at a throwaway
tmp_path / in-memory sqlite URL, never the real test DB file, and never seeds.
"""

import os
import sys

from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import growpodempire.db.session as sess  # noqa: E402


class _FakeSettings:
    """Minimal stand-in for Settings exposing only what get_engine() reads."""

    def __init__(self, database_url: str, sql_echo: bool = False) -> None:
        self.database_url = database_url
        self.sql_echo = sql_echo


# --------------------------------------------------------------------------- #
# session.py 45-58: get_engine() cold start, sqlite -> connect_args + pragmas  #
# --------------------------------------------------------------------------- #
def test_get_engine_cold_start_sqlite_sets_connect_args_and_pragmas(
    monkeypatch, tmp_path
):
    """First call with _engine=None builds the engine from settings, applies the
    sqlite cross-thread connect arg, and registers the pragma `connect` listener."""
    db_url = f"sqlite:///{tmp_path / 'cold_start.db'}"

    # Restored at teardown -> the shared suite engine is untouched.
    monkeypatch.setattr(sess, "_engine", None)
    # The module reads settings via the name it imported (`get_settings`).
    monkeypatch.setattr(
        sess, "get_settings", lambda: _FakeSettings(db_url, sql_echo=False)
    )

    engine = sess.get_engine()

    assert isinstance(engine, Engine)
    assert engine is sess._engine  # cached into the (monkeypatched) global
    assert engine.url.drivername.startswith("sqlite")

    # sqlite cross-thread arg (line 50): create_engine stores it on the pool's
    # connect args / dialect connect args.
    connect_args = engine.dialect.create_connect_args(engine.url)[1]
    assert connect_args.get("check_same_thread") is False

    # Pragma listener registered (lines 57-58 -> _apply_sqlite_pragmas).
    assert _connect_listeners(engine), "expected a `connect` listener"

    # The listener actually fires and enforces FK on a real connection.
    with engine.connect() as conn:
        fk = conn.exec_driver_sql("PRAGMA foreign_keys").scalar()
        assert fk == 1


def _connect_listeners(engine):
    """User `connect` listeners on the engine's pool (empty if none).

    `event.listens_for(engine, "connect")` propagates the handler to the pool's
    dispatch. create_engine itself always pre-registers two internal handlers
    (`on_connect` + a once-only setup), so the sqlite pragma listener shows up as
    the THIRD entry; a plain (non-sqlite, no-pragma) engine has only the two.
    `engine.dispatch.connect` raises AttributeError, so read the pool dispatch.
    """
    try:
        all_listeners = list(engine.pool.dispatch.connect)
    except AttributeError:
        return []
    # Drop the two create_engine internals; what remains is our pragma listener.
    return all_listeners[2:]


def test_get_engine_cold_start_non_sqlite_skips_connect_args(monkeypatch):
    """Non-sqlite URL skips the check_same_thread arg and the pragma listener
    (the `is_sqlite` False side of lines 48 and 57). Postgres has no driver
    installed in this offline env, so we never connect — only build the engine."""
    monkeypatch.setattr(sess, "_engine", None)
    monkeypatch.setattr(
        sess,
        "get_settings",
        lambda: _FakeSettings("postgresql://u:p@localhost/db", sql_echo=False),
    )

    engine = sess.get_engine()

    assert isinstance(engine, Engine)
    assert engine.dialect.name == "postgresql"
    # No sqlite pragma listener registered on a non-sqlite engine.
    assert _connect_listeners(engine) == []


def test_get_engine_caches_after_first_build(monkeypatch, tmp_path):
    """Second get_engine() call returns the cached object (the `if _engine is
    None` guard is False on the second pass) without rebuilding."""
    db_url = f"sqlite:///{tmp_path / 'cache.db'}"
    monkeypatch.setattr(sess, "_engine", None)
    monkeypatch.setattr(sess, "get_settings", lambda: _FakeSettings(db_url))

    e1 = sess.get_engine()
    e2 = sess.get_engine()

    assert e1 is e2


# --------------------------------------------------------------------------- #
# session.py 66: get_sessionmaker() cold start + cache-hit return              #
# --------------------------------------------------------------------------- #
def test_get_sessionmaker_cold_start_and_cache_hit(monkeypatch, tmp_path):
    """First call constructs the sessionmaker (line 66); second call returns the
    cached object (the cache-hit branch). Both monkeypatched globals restore at
    teardown, leaving the shared suite engine/sessionmaker intact."""
    db_url = f"sqlite:///{tmp_path / 'sm.db'}"
    monkeypatch.setattr(sess, "_engine", None)
    monkeypatch.setattr(sess, "_SessionLocal", None)
    monkeypatch.setattr(sess, "get_settings", lambda: _FakeSettings(db_url))

    sm1 = sess.get_sessionmaker()
    assert isinstance(sm1, sessionmaker)
    assert sm1 is sess._SessionLocal  # cached into the (monkeypatched) global

    sm2 = sess.get_sessionmaker()
    assert sm1 is sm2  # cache-hit branch returns the same object
