"""
BadgeService — tracks and awards specialization badges earned via gameplay.

Badges are permanent unlocks stored in player_badges, distinct from the
economy-gated achievement rewards in progression_service.py. They're evaluated
automatically at the end of relevant game actions via check_all().
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db.models import (
    PlayerBadge,
    BreedingEvent,
    CourseEnrollment,
    Harvest,
    LedgerEntry,
    MarketListing,
    CannabisCup,
    Contract,
)
from ..enums import LedgerEntryType

TERPENE_COURSE_KEYS = {"chem-101", "chem-201"}


# ---------------------------------------------------------------------------
# Badge catalog
# ---------------------------------------------------------------------------

BADGES: dict[str, dict] = {
    "master_breeder": {
        "label": "Master Breeder",
        "description": "Breed 10 distinct strains",
        "icon": "🧬",
        "category": "specialization",
    },
    "yield_king": {
        "label": "Yield King",
        "description": "Achieve 5 harvests with quality ≥ 75",
        "icon": "👑",
        "category": "specialization",
    },
    "pest_warden": {
        "label": "Pest Warden",
        "description": "Treat pests 20 times",
        "icon": "🛡️",
        "category": "specialization",
    },
    "market_mogul": {
        "label": "Market Mogul",
        "description": "Complete 50 marketplace sales",
        "icon": "💰",
        "category": "specialization",
    },
    "cup_champion": {
        "label": "Cup Champion",
        "description": "Win any Cannabis Cup",
        "icon": "🏆",
        "category": "specialization",
    },
    "nft_pioneer": {
        "label": "NFT Pioneer",
        "description": "Mint your first NFT",
        "icon": "🌐",
        "category": "specialization",
    },
    "contract_king": {
        "label": "Contract King",
        "description": "Complete 100 delivery contracts",
        "icon": "📜",
        "category": "specialization",
    },
    "terpene_tactician": {
        "label": "Terpene Tactician",
        "description": "Complete all chemistry / terpene university courses",
        "icon": "🧪",
        "category": "specialization",
    },
}


# ---------------------------------------------------------------------------
# Rank ladder  (derived from player level, no DB needed)
# ---------------------------------------------------------------------------

RANKS: list[dict] = [
    {"index": 1,  "name": "Seedling Scout",    "icon": "🌱", "level_min": 1},
    {"index": 2,  "name": "Sprout Keeper",     "icon": "🪴", "level_min": 2},
    {"index": 3,  "name": "Clone Crafter",     "icon": "🔬", "level_min": 3},
    {"index": 4,  "name": "Garden Hand",       "icon": "🤲", "level_min": 4},
    {"index": 5,  "name": "Terpene Tracker",   "icon": "🧪", "level_min": 5},
    {"index": 6,  "name": "Strain Seeker",     "icon": "🔭", "level_min": 6},
    {"index": 7,  "name": "Phenotype Hunter",  "icon": "🎯", "level_min": 8},
    {"index": 8,  "name": "Harvest Master",    "icon": "🌿", "level_min": 10},
    {"index": 9,  "name": "Genetics Artisan",  "icon": "⚗️", "level_min": 13},
    {"index": 10, "name": "Terpene Tactician", "icon": "🧠", "level_min": 16},
    {"index": 11, "name": "Grand Cultivar",    "icon": "🌳", "level_min": 20},
    {"index": 12, "name": "Supreme Cultivar",  "icon": "👸", "level_min": 25},
]


def rank_for_level(level: int) -> dict:
    """Return the rank dict for a given player level."""
    rank = RANKS[0]
    for r in RANKS:
        if level >= r["level_min"]:
            rank = r
        else:
            break
    next_min: Optional[int] = None
    for r in RANKS:
        if r["level_min"] > rank["level_min"]:
            next_min = r["level_min"]
            break
    return {**rank, "next_level_min": next_min}


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class BadgeService:
    def __init__(self, session: Session):
        self.session = session

    # -- Public API ----------------------------------------------------------

    def list_badges(self, player_id: str) -> List[dict]:
        """Return every badge in the catalog with the player's earned status."""
        earned = self._earned_map(player_id)
        out = []
        for key, meta in BADGES.items():
            row = earned.get(key)
            out.append(
                {
                    "key": key,
                    "label": meta["label"],
                    "description": meta["description"],
                    "icon": meta["icon"],
                    "category": meta["category"],
                    "earned": row is not None,
                    "earned_at": row.earned_at.isoformat() if row else None,
                }
            )
        return out

    def check_all(self, player_id: str) -> List[str]:
        """Evaluate all badge thresholds and award any newly earned ones.

        Safe to call after any game action — it's a handful of COUNT queries
        and only writes when a new threshold is crossed for the first time.
        Returns the list of newly awarded badge keys.
        """
        earned_keys = set(self._earned_map(player_id).keys())
        newly_earned: List[str] = []

        checks = {
            "master_breeder":     self._count_breeds(player_id) >= 10,
            "yield_king":         self._count_quality_harvests(player_id) >= 5,
            "pest_warden":        self._count_pest_treatments(player_id) >= 20,
            "market_mogul":       self._count_market_sales(player_id) >= 50,
            "cup_champion":       self._has_won_cup(player_id),
            "nft_pioneer":        self._has_minted_nft(player_id),
            "contract_king":      self._count_fulfilled_contracts(player_id) >= 100,
            "terpene_tactician":  self._has_completed_terpene_courses(player_id),
        }

        for key, qualified in checks.items():
            if qualified and key not in earned_keys:
                self.session.add(
                    PlayerBadge(
                        player_id=player_id,
                        badge_key=key,
                        earned_at=datetime.utcnow(),
                    )
                )
                newly_earned.append(key)

        return newly_earned

    # -- Private query helpers -----------------------------------------------

    def _earned_map(self, player_id: str) -> dict:
        rows = (
            self.session.query(PlayerBadge)
            .filter(PlayerBadge.player_id == player_id)
            .all()
        )
        return {r.badge_key: r for r in rows}

    def _count_breeds(self, player_id: str) -> int:
        return (
            self.session.query(func.count(BreedingEvent.id))
            .filter(BreedingEvent.player_id == player_id)
            .scalar()
            or 0
        )

    def _count_quality_harvests(self, player_id: str) -> int:
        return (
            self.session.query(func.count(Harvest.id))
            .filter(Harvest.player_id == player_id, Harvest.quality >= 75)
            .scalar()
            or 0
        )

    def _count_pest_treatments(self, player_id: str) -> int:
        return (
            self.session.query(func.count(LedgerEntry.id))
            .filter(
                LedgerEntry.player_id == player_id,
                LedgerEntry.entry_type == LedgerEntryType.PEST_TREATMENT.value,
            )
            .scalar()
            or 0
        )

    def _count_market_sales(self, player_id: str) -> int:
        return (
            self.session.query(func.count(MarketListing.id))
            .filter(
                MarketListing.seller_id == player_id,
                MarketListing.status == "sold",
            )
            .scalar()
            or 0
        )

    def _has_won_cup(self, player_id: str) -> bool:
        return (
            self.session.query(CannabisCup)
            .filter(CannabisCup.winner_id == player_id)
            .first()
        ) is not None

    def _has_minted_nft(self, player_id: str) -> bool:
        return (
            self.session.query(Harvest)
            .filter(
                Harvest.player_id == player_id,
                Harvest.nft_status == "minted",
            )
            .first()
        ) is not None

    def _count_fulfilled_contracts(self, player_id: str) -> int:
        return (
            self.session.query(func.count(Contract.id))
            .filter(
                Contract.player_id == player_id,
                Contract.status == "fulfilled",
            )
            .scalar()
            or 0
        )

    def _has_completed_terpene_courses(self, player_id: str) -> bool:
        completed = (
            self.session.query(CourseEnrollment.course_key)
            .filter(
                CourseEnrollment.player_id == player_id,
                CourseEnrollment.course_key.in_(list(TERPENE_COURSE_KEYS)),
                CourseEnrollment.status == "completed",
            )
            .count()
        )
        return completed >= len(TERPENE_COURSE_KEYS)
