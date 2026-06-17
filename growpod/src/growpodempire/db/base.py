"""
Declarative base and shared column helpers for all ORM models.

A stable naming convention is set on the metadata so that Alembic autogenerate
produces deterministic constraint names across SQLite (local/test) and Postgres
(production) — required for batch migrations to stay in lockstep.
"""

import uuid
from datetime import datetime

from sqlalchemy import MetaData, DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Shared declarative base with a deterministic naming convention."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def new_uuid() -> str:
    """Generate a string UUID primary key (portable across SQLite/Postgres)."""
    return uuid.uuid4().hex


class TimestampMixin:
    """created_at / updated_at columns for audit trails."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class UUIDPrimaryKeyMixin:
    """String UUID primary key."""

    id: Mapped[str] = mapped_column(
        String(32), primary_key=True, default=new_uuid
    )
