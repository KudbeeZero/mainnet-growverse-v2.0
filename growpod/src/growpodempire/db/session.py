"""
Engine / session management.

Exposes a process-wide engine + sessionmaker bound to the configured
DATABASE_URL, plus a `session_scope` context manager that commits on success and
rolls back on error.
"""

from contextlib import contextmanager
from typing import Iterator, Optional

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from ..config import get_settings
from .base import Base

_engine: Optional[Engine] = None
_SessionLocal: Optional[sessionmaker] = None


def _apply_sqlite_pragmas(engine: Engine) -> None:
    """Bring dev/test SQLite in line with prod Postgres semantics.

    SQLite defaults leave foreign keys UNenforced, so FK/orphan bugs that
    Postgres rejects would pass the whole test suite and only surface in prod.
    WAL + a busy_timeout also let the second writer queue instead of getting an
    immediate "database is locked" — relevant because compute-on-read writes on
    every `/state`. Postgres ignores all of this.
    """
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _record):  # pragma: no cover - driver hook
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA busy_timeout=5000")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.close()


def get_engine() -> Engine:
    """Return (creating on first use) the global SQLAlchemy engine."""
    global _engine
    if _engine is None:
        settings = get_settings()
        connect_args = {}
        is_sqlite = settings.database_url.startswith("sqlite")
        if is_sqlite:
            # Allow cross-thread use under Flask's dev server.
            connect_args["check_same_thread"] = False
        _engine = create_engine(
            settings.database_url,
            echo=settings.sql_echo,
            future=True,
            connect_args=connect_args,
            # pool_pre_ping (2026-07-05 audit): Postgres/Fly recycle idle
            # connections; without this the first request after a quiet period
            # draws a dead connection from the pool and 500s. Pinging on
            # checkout is a no-op for SQLite's single file connection, so this
            # is safe to set unconditionally.
            pool_pre_ping=True,
        )
        if is_sqlite:
            _apply_sqlite_pragmas(_engine)
    return _engine


def get_sessionmaker() -> sessionmaker:
    """Return (creating on first use) the global sessionmaker."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(), autoflush=False, expire_on_commit=False, future=True
        )
    return _SessionLocal


def init_db() -> None:
    """Create all tables from the ORM metadata (used by tests / first boot).

    Production uses Alembic migrations; this is a convenience for SQLite and
    fresh local databases.
    """
    # Import models so their tables register on Base.metadata.
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=get_engine(), checkfirst=True)


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional session scope: commit on success, rollback on exception."""
    session = get_sessionmaker()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def reset_engine_for_tests(database_url: str) -> None:
    """Rebind the engine to a specific URL (test helper)."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    is_sqlite = database_url.startswith("sqlite")
    _engine = create_engine(
        database_url,
        future=True,
        connect_args={"check_same_thread": False} if is_sqlite else {},
    )
    if is_sqlite:
        _apply_sqlite_pragmas(_engine)
    _SessionLocal = sessionmaker(
        bind=_engine, autoflush=False, expire_on_commit=False, future=True
    )
