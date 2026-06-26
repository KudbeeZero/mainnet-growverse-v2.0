"""
WaitlistService — the pre-launch FACTION + launch-waitlist loop (NON-ECONOMIC).

A visitor joins a waitlist by choosing a faction and optionally submitting an
Algorand wallet address and/or email; engagement points accrue. The service
shape mirrors ``engagement_service.py`` (injected ``session`` + optional
``clock``, returns JSON-able dicts, raises ``GameError``).

HARD RULE: nothing here touches the GROW ledger, a Wallet, ``balance.yaml``
economy values, or ``economy/ledger.py``. The Algorand address is stored only as
a well-formed string for a FUTURE reward — NO on-chain action is performed here.
``engagement_points`` is a self-contained tally, wholly distinct from GROW
currency and from game XP/level.

Dedupe is service-level: a signup is keyed by its Algorand address when one is
given, else by its email. A re-submit updates the chosen faction in place rather
than creating a duplicate row (matching the non-unique address index on the
model, which tolerates many NULL addresses across SQLite/Postgres).
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from ..db.models import WaitlistSignup
from ..simulation.clock import Clock, SystemClock
from .factions import faction_ids
from .game_service import GameError


class WaitlistService:
    def __init__(self, session: Session, clock: Optional[Clock] = None):
        self.session = session
        self.clock = clock or SystemClock()

    # ----- internals ------------------------------------------------------
    @staticmethod
    def _valid_address(addr: str) -> bool:
        # Lazy import: algosdk is only needed when an address is actually
        # supplied (mirrors game_service.link_wallet).
        from algosdk import encoding

        return bool(encoding.is_valid_address(addr))

    @staticmethod
    def _to_dict(row: WaitlistSignup) -> dict:
        return {
            "id": row.id,
            "faction": row.faction,
            "algorand_address": row.algorand_address,
            "email": row.email,
            "engagement_points": row.engagement_points,
            "source": row.source,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }

    def _find(
        self,
        *,
        algorand_address: Optional[str] = None,
        email: Optional[str] = None,
        signup_id: Optional[str] = None,
    ) -> Optional[WaitlistSignup]:
        q = self.session.query(WaitlistSignup)
        if signup_id:
            return q.filter(WaitlistSignup.id == signup_id).one_or_none()
        if algorand_address:
            return q.filter(
                WaitlistSignup.algorand_address == algorand_address
            ).first()
        if email:
            return q.filter(WaitlistSignup.email == email).first()
        return None

    # ----- write ----------------------------------------------------------
    def join(
        self,
        *,
        faction: str,
        algorand_address: Optional[str] = None,
        email: Optional[str] = None,
        source: str = "web",
    ) -> dict:
        """Join (or re-join) the waitlist for ``faction``.

        Validates the faction id and, if given, the Algorand address checksum.
        Dedupes by address (else email): an existing signup has its faction
        updated and is returned; otherwise a new row is created.
        """
        faction = (faction or "").strip()
        if faction not in faction_ids():
            raise GameError("Unknown faction.")

        addr: Optional[str] = None
        if algorand_address is not None and str(algorand_address).strip():
            addr = str(algorand_address).strip()
            if not self._valid_address(addr):
                raise GameError("That doesn't look like a valid Algorand address.")

        em = (email or "").strip() or None

        existing = self._find(algorand_address=addr, email=em)
        if existing is not None:
            existing.faction = faction
            if addr:
                existing.algorand_address = addr
            if em:
                existing.email = em
            self.session.flush()
            return self._to_dict(existing)

        row = WaitlistSignup(
            faction=faction,
            algorand_address=addr,
            email=em,
            engagement_points=0,
            source=(source or "web").strip() or "web",
        )
        self.session.add(row)
        self.session.flush()
        return self._to_dict(row)

    def add_engagement(
        self,
        *,
        algorand_address: Optional[str] = None,
        email: Optional[str] = None,
        signup_id: Optional[str] = None,
        points: int,
    ) -> dict:
        """Add (clamped, non-negative) engagement points to an existing signup."""
        addr = (algorand_address or "").strip() or None
        em = (email or "").strip() or None
        row = self._find(algorand_address=addr, email=em, signup_id=signup_id)
        if row is None:
            raise GameError("Waitlist signup not found.")
        row.engagement_points += max(0, int(points or 0))
        self.session.flush()
        return self._to_dict(row)

    # ----- read -----------------------------------------------------------
    def standings(self) -> dict:
        """Per-faction signup counts (zero-filled for every known faction) plus
        the grand total — drives the live signup meter."""
        counts = {fid: 0 for fid in faction_ids()}
        rows = (
            self.session.query(
                WaitlistSignup.faction, WaitlistSignup.id
            ).all()
        )
        for faction, _ in rows:
            if faction in counts:
                counts[faction] += 1
            else:
                counts[faction] = counts.get(faction, 0) + 1
        return {"factions": counts, "total": len(rows)}
