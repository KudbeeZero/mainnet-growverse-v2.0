"""
ResearchService — a player-scoped tech tree (Phase 2 expansion).

Players spend GROW (gated by level + prerequisites) to unlock permanent
operation-wide upgrades. `research_effects()` aggregates every unlocked node's
effects into a single additive modifier dict, which player-scoped game logic
consults at compute time (harvest yield/quality, curing bonus, care/seed/
breeding discounts, pod capacity, terpene expression, consumable potency). The
deterministic simulation engine is never touched — effects are applied in
service code that already runs in a player's context.
"""

from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from ..economy.config import get_economy_config, EconomyConfig
from ..economy.ledger import post, to_money
from ..enums import LedgerEntryType
from ..db.models import Player, ResearchProgress
from . import leveling_service
from .game_service import GameError

# Effect keys the rest of the game understands. Aggregation is additive.
_EFFECT_KEYS = (
    "yield_pct",
    "quality_bonus",
    "cure_bonus_pct",
    "care_discount_pct",
    "breeding_discount_pct",
    "seed_discount_pct",
    "terpene_pct",
    "consumable_potency_pct",
    "pod_capacity_bonus",
)


def _unlocked_keys(session: Session, player_id: str) -> set:
    rows = (
        session.query(ResearchProgress)
        .filter(ResearchProgress.player_id == player_id)
        .all()
    )
    return {r.node_key for r in rows}


def research_effects(
    session: Session, player_id: str, cfg: Optional[EconomyConfig] = None
) -> Dict[str, float]:
    """Aggregate the effects of every node a player has unlocked."""
    cfg = cfg or get_economy_config()
    nodes = cfg.research_nodes
    effects: Dict[str, float] = {k: 0.0 for k in _EFFECT_KEYS}
    for key in _unlocked_keys(session, player_id):
        node = nodes.get(key)
        if not node:
            continue
        for ek, ev in (node.get("effects") or {}).items():
            if ek in effects:
                effects[ek] += float(ev)
    return effects


class ResearchService:
    def __init__(self, session: Session, config: Optional[EconomyConfig] = None):
        self.session = session
        self.cfg = config or get_economy_config()

    def _player(self, player_id: str) -> Player:
        player = self.session.get(Player, player_id)
        if player is None:
            raise GameError("Player not found")
        return player

    def effects(self, player_id: str) -> Dict[str, float]:
        return research_effects(self.session, player_id, self.cfg)

    def list_tree(self, player_id: str) -> List[dict]:
        """Every node with its unlocked / available state for this player."""
        player = self._player(player_id)
        unlocked = _unlocked_keys(self.session, player_id)
        level = player.level or 1
        tree: List[dict] = []
        for key, node in self.cfg.research_nodes.items():
            requires = node.get("requires", []) or []
            prereqs_met = all(r in unlocked for r in requires)
            is_unlocked = key in unlocked
            available = (
                not is_unlocked
                and prereqs_met
                and level >= int(node.get("level_req", 1))
            )
            tree.append({
                "key": key,
                "name": node.get("name", key),
                "branch": node.get("branch"),
                "cost": float(node.get("cost", 0)),
                "level_req": int(node.get("level_req", 1)),
                "requires": requires,
                "effects": node.get("effects", {}),
                "description": node.get("description", ""),
                "unlocked": is_unlocked,
                "available": available,
                "prereqs_met": prereqs_met,
            })
        return tree

    def unlock(self, player_id: str, node_key: str) -> ResearchProgress:
        player = self._player(player_id)
        node = self.cfg.research_nodes.get(node_key)
        if node is None:
            raise GameError(f"Unknown research node '{node_key}'")

        if node_key in _unlocked_keys(self.session, player_id):
            raise GameError("Research already unlocked")

        unlocked = _unlocked_keys(self.session, player_id)
        missing = [r for r in (node.get("requires") or []) if r not in unlocked]
        if missing:
            raise GameError(f"Requires first: {', '.join(missing)}")

        level_req = int(node.get("level_req", 1))
        if (player.level or 1) < level_req:
            raise GameError(f"Requires level {level_req}")

        cost = to_money(node.get("cost", 0))
        post(
            self.session, player_id, -cost, LedgerEntryType.RESEARCH_UNLOCK,
            ref_type="research", ref_id=node_key,
        )
        progress = ResearchProgress(player_id=player_id, node_key=node_key)
        self.session.add(progress)
        self.session.flush()

        xp = int(self.cfg.research.get("xp_per_unlock", 0))
        if xp:
            leveling_service.award_xp(self.session, player_id, xp, self.cfg)
        return progress
