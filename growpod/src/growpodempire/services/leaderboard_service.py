"""
Leaderboards — read-only aggregate rankings over existing game state.
"""

from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db.models import Player, Wallet, BreedingEvent, Harvest, ResearchProgress


class LeaderboardService:
    def __init__(self, session: Session):
        self.session = session

    def richest(self, limit: int = 10) -> List[dict]:
        rows = (
            self.session.query(Player.id, Player.username, Wallet.cached_balance)
            .join(Wallet, Wallet.player_id == Player.id)
            .order_by(Wallet.cached_balance.desc())
            .limit(limit)
            .all()
        )
        return [
            {"player_id": pid, "username": name, "value": float(bal)}
            for pid, name, bal in rows
        ]

    def top_breeders(self, limit: int = 10) -> List[dict]:
        return self._count_rank(BreedingEvent.player_id, limit)

    def top_researchers(self, limit: int = 10) -> List[dict]:
        return self._count_rank(ResearchProgress.player_id, limit)

    def biggest_harvesters(self, limit: int = 10) -> List[dict]:
        rows = (
            self.session.query(
                Player.id, Player.username, func.coalesce(func.sum(Harvest.weight_g), 0)
            )
            .join(Harvest, Harvest.player_id == Player.id)
            .group_by(Player.id, Player.username)
            .order_by(func.sum(Harvest.weight_g).desc())
            .limit(limit)
            .all()
        )
        return [
            {"player_id": pid, "username": name, "value": float(total)}
            for pid, name, total in rows
        ]

    def top_levels(self, limit: int = 10) -> List[dict]:
        rows = (
            self.session.query(Player.id, Player.username, Player.level, Player.xp)
            .order_by(Player.level.desc(), Player.xp.desc())
            .limit(limit)
            .all()
        )
        return [
            {"player_id": pid, "username": name, "value": level, "xp": xp}
            for pid, name, level, xp in rows
        ]

    def _count_rank(self, count_col, limit: int) -> List[dict]:
        rows = (
            self.session.query(Player.id, Player.username, func.count(count_col))
            .join(count_col.class_, count_col == Player.id)
            .group_by(Player.id, Player.username)
            .order_by(func.count(count_col).desc())
            .limit(limit)
            .all()
        )
        return [
            {"player_id": pid, "username": name, "value": int(cnt)}
            for pid, name, cnt in rows
        ]
