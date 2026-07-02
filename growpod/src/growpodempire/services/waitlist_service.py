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

import re
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

# Pragmatic email sanity check: one @, non-empty local part, a dotted domain.
# Not RFC-complete (that's a losing game) — just enough to reject junk before we
# persist it as a contact string for a future reward.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_MAX_EMAIL_LEN = 254

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
    def _public_dict(row: WaitlistSignup, *, include_id: bool) -> dict:
        """Sanitized, caller-safe view of a signup.

        The waitlist endpoints are PUBLIC and dedupe by *unverified* email or
        address, so the response must never echo stored contact PII: doing so
        would let anyone POST a guessed email and learn the linked Algorand
        wallet address (and vice-versa). We therefore never return
        ``algorand_address`` or ``email``.

        ``id`` (the signup_id) is a capability — it unlocks ``add_engagement``
        for that row — so it is returned ONLY on a fresh creation, where the
        caller demonstrably owns the row, never on a dedupe hit against an
        identifier the caller may not control.
        """
        out = {
            "faction": row.faction,
            "engagement_points": row.engagement_points,
            "source": row.source,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        out["id"] = row.id if include_id else None
        return out

    @staticmethod
    def _valid_email(email: str) -> bool:
        return len(email) <= _MAX_EMAIL_LEN and bool(_EMAIL_RE.match(email))

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
        if em is not None and not self._valid_email(em):
            raise GameError("That doesn't look like a valid email address.")

        existing = self._find(algorand_address=addr, email=em)
        if existing is not None:
            existing.faction = faction
            if addr:
                existing.algorand_address = addr
            if em:
                existing.email = em
            self.session.flush()
            # Dedupe hit: the caller matched an existing row via an UNVERIFIED
            # identifier, so withhold the signup_id (capability) and all stored
            # PII — return only a generic acknowledgement.
            return self._public_dict(existing, include_id=False)

        row = WaitlistSignup(
            faction=faction,
            algorand_address=addr,
            email=em,
            engagement_points=0,
            source=(source or "web").strip() or "web",
        )
        self.session.add(row)
        self.session.flush()
        return self._public_dict(row, include_id=True)

    def add_engagement(
        self,
        *,
        algorand_address: Optional[str] = None,
        email: Optional[str] = None,
        signup_id: Optional[str] = None,
        points: int,
    ) -> dict:
        """Add (clamped, non-negative) engagement points to an existing signup.

        This endpoint is PUBLIC and unauthenticated, so it must NOT behave as an
        existence oracle: returning a hit/found result but a miss/404 would let
        anyone probe which emails/addresses are on the waitlist. We therefore
        return an identical generic acknowledgement whether or not a row matched
        (and never echo the row), so hit and miss are indistinguishable.
        """
        addr = (algorand_address or "").strip() or None
        em = (email or "").strip() or None
        row = self._find(algorand_address=addr, email=em, signup_id=signup_id)
        if row is not None:
            row.engagement_points += max(0, int(points or 0))
            self.session.flush()
        return {"ok": True}

    # ----- read -----------------------------------------------------------
    def standings(self) -> dict:
        """Per-faction signup counts (zero-filled for every known faction) plus
        the grand total — drives the live signup meter.

        Counts are aggregated in the database (``GROUP BY faction``) rather than
        materializing every row in Python: this endpoint is public and polled, so
        an O(N) full-table load per request would be an easy amplification DoS
        once the waitlist has many signups.
        """
        counts = {fid: 0 for fid in faction_ids()}
        rows = (
            self.session.query(WaitlistSignup.faction, func.count(WaitlistSignup.id))
            .group_by(WaitlistSignup.faction)
            .all()
        )
        total = 0
        for faction, count in rows:
            count = int(count or 0)
            total += count
            counts[faction] = counts.get(faction, 0) + count
        return {"factions": counts, "total": total}
