"""
Leveling: award XP for actions and derive a level from cumulative XP.

`award()` is a small static helper the game services call after harvest, breed,
and mint, so leveling stays decoupled from their core logic.
"""

from typing import Optional

from sqlalchemy.orm import Session

from ..economy.config import get_economy_config, EconomyConfig
from ..db.models import Player


def _curve_base(cfg: EconomyConfig) -> int:
    return int(cfg.raw.get("leveling", {}).get("curve_base", 100))


def xp_for_level(level: int, cfg: EconomyConfig) -> int:
    """Cumulative XP required to *reach* a given level (level 1 = 0)."""
    base = _curve_base(cfg)
    return base * level * (level - 1) // 2


def level_for_xp(xp: int, cfg: EconomyConfig) -> int:
    level = 1
    while xp >= xp_for_level(level + 1, cfg):
        level += 1
    return level


def award_xp(session: Session, player_id: str, amount: int, cfg: Optional[EconomyConfig] = None) -> Player:
    """Add a raw XP amount and recompute the player's level."""
    cfg = cfg or get_economy_config()
    player = session.get(Player, player_id)
    if player is None or amount <= 0:
        return player
    player.xp = (player.xp or 0) + int(amount)
    player.level = level_for_xp(player.xp, cfg)
    return player


def award(session: Session, player_id: str, action: str, cfg: Optional[EconomyConfig] = None) -> Player:
    """Award the configured XP for an action and recompute the player's level."""
    cfg = cfg or get_economy_config()
    amount = int(cfg.raw.get("leveling", {}).get("xp", {}).get(action, 0))
    return award_xp(session, player_id, amount, cfg)


def progress(player: Player, cfg: Optional[EconomyConfig] = None) -> dict:
    cfg = cfg or get_economy_config()
    level = player.level or 1
    current_floor = xp_for_level(level, cfg)
    next_floor = xp_for_level(level + 1, cfg)
    span = max(1, next_floor - current_floor)
    return {
        "xp": player.xp or 0,
        "level": level,
        "xp_into_level": (player.xp or 0) - current_floor,
        "xp_for_next_level": next_floor - (player.xp or 0),
        "progress_pct": round(((player.xp or 0) - current_floor) / span * 100, 1),
    }
