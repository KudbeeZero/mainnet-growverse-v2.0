"""
ContractService — timed NPC orders.

A player draws a contract (deliver N grams of a rarity by a deadline), then
fulfills it from their *unsold* harvests of matching rarity. Fulfilling consumes
those harvests and pays a GROW + XP reward through the ledger / leveling.
"""

import random
from datetime import timedelta
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from ..economy.config import get_economy_config, EconomyConfig
from ..economy.ledger import post, balance
from ..enums import LedgerEntryType
from ..db.models import Contract, Harvest
from ..simulation.clock import Clock, SystemClock
from . import leveling_service
from .game_service import GameService, GameError


class ContractService:
    def __init__(
        self,
        session: Session,
        config: Optional[EconomyConfig] = None,
        clock: Optional[Clock] = None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        self.clock = clock or SystemClock()
        self._cfg = self.cfg.raw.get("contracts", {})

    def offer(self, player_id: str, rng_seed: Optional[int] = None) -> Contract:
        GameService(self.session).get_player(player_id)
        templates = self._cfg.get("templates", [])
        if not templates:
            raise GameError("No contract templates configured")

        rng = random.Random(rng_seed)
        tmpl = rng.choices(templates, weights=[t.get("weight", 1) for t in templates], k=1)[0]
        now = self.clock.now()
        contract = Contract(
            player_id=player_id,
            description=f"Deliver {tmpl['grams']}g of {tmpl['rarity']} flower",
            target_rarity=tmpl["rarity"],
            target_grams=float(tmpl["grams"]),
            reward_grow=Decimal(str(tmpl["reward"])),
            reward_xp=int(tmpl.get("xp", 0)),
            deadline_at=now + timedelta(days=self._cfg.get("duration_days", 7)),
        )
        self.session.add(contract)
        self.session.flush()
        return contract

    def list_contracts(self, player_id: str, status: Optional[str] = None) -> List[Contract]:
        q = self.session.query(Contract).filter(Contract.player_id == player_id)
        if status:
            q = q.filter(Contract.status == status)
        return q.order_by(Contract.created_at.desc()).all()

    def fulfill(self, player_id: str, contract_id: str) -> dict:
        contract = self.session.get(Contract, contract_id)
        if contract is None or contract.player_id != player_id:
            raise GameError("Contract not found")
        if contract.status != "open":
            raise GameError(f"Contract is {contract.status}")

        now = self.clock.now()
        if now > contract.deadline_at:
            contract.status = "expired"
            # Commit the status flip before raising (2026-07-05 audit finding):
            # the caller's session_scope() rolls back on the GameError below,
            # which would otherwise silently discard this write and leave the
            # contract "open" forever — only re-flipping (and re-discarding) on
            # each subsequent fulfill attempt. No other writes are pending at
            # this point in the method, so committing here is safe.
            self.session.commit()
            raise GameError("Contract deadline has passed")

        # Eligible deliveries: the player's unsold harvests of matching rarity.
        self.session.flush()
        harvests = (
            self.session.query(Harvest)
            .filter(
                Harvest.player_id == player_id,
                Harvest.sold.is_(False),
                Harvest.rarity_snapshot == contract.target_rarity,
            )
            .order_by(Harvest.harvested_at)
            .all()
        )
        available = sum(h.weight_g for h in harvests)
        if available < contract.target_grams:
            raise GameError(
                f"Need {contract.target_grams}g of {contract.target_rarity}; "
                f"you have {available:.1f}g available (harvest with sell=false to stock up)"
            )

        # Consume harvests (oldest first) until the target is met.
        remaining = contract.target_grams
        for h in harvests:
            if remaining <= 0:
                break
            h.sold = True  # consumed by the contract
            h.sale_value = Decimal("0")
            remaining -= h.weight_g

        post(
            self.session, player_id, contract.reward_grow, LedgerEntryType.REWARD,
            ref_type="contract", ref_id=contract.id,
        )
        if contract.reward_xp:
            leveling_service.award_xp(self.session, player_id, contract.reward_xp, self.cfg)

        contract.status = "fulfilled"
        contract.fulfilled_at = now
        return {
            "contract_id": contract.id,
            "reward_grow": float(contract.reward_grow),
            "reward_xp": contract.reward_xp,
            "balance": float(balance(self.session, player_id)),
        }
