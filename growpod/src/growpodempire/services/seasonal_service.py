"""
SeasonalService — monthly exclusive strain drops.

A SeasonalStrain row marks a strain as purchasable only during `available_month`
(YYYY-MM format). Once the month ends the strain is no longer available to
purchase, but any seeds already planted continue to grow normally.

Purchasing a seasonal seed is a token sink: the `price_gc` is debited from the
player's wallet via the ledger.
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from ..db.models import SeasonalStrain, SeedInventory, Strain
from ..economy.ledger import post, to_money, InsufficientFundsError
from ..enums import LedgerEntryType
from ..services.game_service import GameService, GameError


def _current_month() -> str:
    return datetime.utcnow().strftime("%Y-%m")


def _next_month(month: str) -> str:
    """Return YYYY-MM for the month following `month`."""
    year, mon = int(month[:4]), int(month[5:7])
    if mon == 12:
        return f"{year + 1}-01"
    return f"{year}-{mon + 1:02d}"


class SeasonalService:
    def __init__(self, session: Session):
        self.session = session

    # ----- read-only --------------------------------------------------------

    def current_month_strains(self) -> List[dict]:
        """Return all seasonal strains available this calendar month."""
        month = _current_month()
        rows = (
            self.session.query(SeasonalStrain)
            .filter(SeasonalStrain.available_month == month)
            .all()
        )
        return [_seasonal_dict(r) for r in rows]

    def all_seasonal_strains(self) -> List[dict]:
        """Return all seasonal strain records (admin view)."""
        rows = self.session.query(SeasonalStrain).order_by(
            SeasonalStrain.available_month.desc()
        ).all()
        return [_seasonal_dict(r) for r in rows]

    # ----- purchase ---------------------------------------------------------

    def purchase(self, player_id: str, seasonal_id: str) -> dict:
        """Debit price_gc from the player and add 1 seed to their inventory.

        Raises GameError if the seasonal drop is not available this month or
        InsufficientFundsError if the player cannot afford it.
        """
        GameService(self.session).get_player(player_id)  # validates existence

        row = self.session.get(SeasonalStrain, seasonal_id)
        if row is None:
            raise GameError("Seasonal strain not found")

        current = _current_month()
        if row.available_month != current:
            raise GameError(
                f"This exclusive strain was only available in {row.available_month} — "
                "it can no longer be purchased."
            )

        price = to_money(row.price_gc)
        post(
            self.session, player_id, -price, LedgerEntryType.SEED_PURCHASE,
            ref_type="seasonal_strain", ref_id=seasonal_id,
        )

        # Add one seed to inventory (or increment an existing stack).
        existing = (
            self.session.query(SeedInventory)
            .filter(
                SeedInventory.player_id == player_id,
                SeedInventory.strain_id == row.strain_id,
                SeedInventory.source == "seasonal",
            )
            .first()
        )
        if existing:
            existing.quantity += 1
        else:
            self.session.add(SeedInventory(
                player_id=player_id,
                strain_id=row.strain_id,
                quantity=1,
                source="seasonal",
                feminized=True,
            ))
        self.session.flush()

        strain = self.session.get(Strain, row.strain_id)
        return {
            "seasonal_id": seasonal_id,
            "strain_id": row.strain_id,
            "strain_name": strain.name if strain else "Unknown",
            "available_month": row.available_month,
            "price_gc": float(row.price_gc),
        }

    # ----- admin: seed / manage the table ----------------------------------

    def upsert(
        self,
        strain_id: str,
        available_month: str,
        price_gc: Decimal,
        auto_renew: bool = False,
    ) -> dict:
        """Create or update a seasonal strain entry (admin / seeding use)."""
        strain = self.session.get(Strain, strain_id)
        if strain is None:
            raise GameError(f"Strain '{strain_id}' not found")

        existing = (
            self.session.query(SeasonalStrain)
            .filter(
                SeasonalStrain.strain_id == strain_id,
                SeasonalStrain.available_month == available_month,
            )
            .first()
        )
        if existing:
            existing.price_gc = to_money(price_gc)
            existing.auto_renew = auto_renew
            self.session.flush()
            return _seasonal_dict(existing)

        row = SeasonalStrain(
            strain_id=strain_id,
            available_month=available_month,
            price_gc=to_money(price_gc),
            auto_renew=auto_renew,
        )
        self.session.add(row)
        self.session.flush()
        return _seasonal_dict(row)

    def delete(self, seasonal_id: str) -> None:
        """Remove a seasonal strain entry by ID.

        Raises GameError if the record does not exist.
        """
        row = self.session.get(SeasonalStrain, seasonal_id)
        if row is None:
            raise GameError("Seasonal strain not found")
        self.session.delete(row)
        self.session.flush()

    def rollover_renewals(self) -> List[dict]:
        """Carry forward all auto_renew=True strains into the next calendar month.

        For each current-month strain with auto_renew set, creates (or skips if
        already present) an entry for the following month with the same price and
        auto_renew flag.  Returns the list of newly created rows.
        """
        current = _current_month()
        upcoming = _next_month(current)

        renewables = (
            self.session.query(SeasonalStrain)
            .filter(
                SeasonalStrain.available_month == current,
                SeasonalStrain.auto_renew.is_(True),
            )
            .all()
        )

        created = []
        for r in renewables:
            already = (
                self.session.query(SeasonalStrain)
                .filter(
                    SeasonalStrain.strain_id == r.strain_id,
                    SeasonalStrain.available_month == upcoming,
                )
                .first()
            )
            if already:
                continue
            new_row = SeasonalStrain(
                strain_id=r.strain_id,
                available_month=upcoming,
                price_gc=r.price_gc,
                auto_renew=r.auto_renew,
            )
            self.session.add(new_row)
            self.session.flush()
            created.append(_seasonal_dict(new_row))

        return created


def _seasonal_dict(row: SeasonalStrain) -> dict:
    strain = row.strain
    return {
        "id": row.id,
        "strain_id": row.strain_id,
        "strain_name": strain.name if strain else "Unknown",
        "strain_rarity": strain.rarity if strain else "common",
        "strain_thc_max": strain.thc_max if strain else None,
        "strain_terpenes": strain.terpenes if strain else [],
        "available_month": row.available_month,
        "price_gc": float(row.price_gc),
        "auto_renew": bool(row.auto_renew),
        "is_current": row.available_month == _current_month(),
    }
