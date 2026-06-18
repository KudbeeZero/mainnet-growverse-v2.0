"""Player badges + level ranks.

Covers BadgeService.list_badges (full catalog with earned status) and
rank_for_level (the level→rank mapping), plus check_all on a fresh player
(no thresholds crossed → nothing awarded).
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.services.game_service import GameService
from growpodempire.services.badge_service import BadgeService, rank_for_level, BADGES, RANKS


def test_rank_for_level_progression():
    first = rank_for_level(1)
    assert first["level_min"] == RANKS[0]["level_min"]
    assert first["next_level_min"] == RANKS[1]["level_min"]
    # A very high level lands on the top rank with no next.
    top = rank_for_level(9999)
    assert top["level_min"] == RANKS[-1]["level_min"]
    assert top["next_level_min"] is None


def test_list_badges_full_catalog_unearned(db):
    with session_scope() as s:
        p = GameService(s).create_player("badger")
        badges = BadgeService(s).list_badges(p.id)
    assert len(badges) == len(BADGES)
    assert all(b["earned"] is False and b["earned_at"] is None for b in badges)
    # Every catalog field is surfaced for the UI.
    for b in badges:
        assert {"key", "label", "description", "icon", "category"} <= set(b)


def test_check_all_awards_nothing_for_fresh_player(db):
    with session_scope() as s:
        p = GameService(s).create_player("rookie")
        svc = BadgeService(s)
        assert svc.check_all(p.id) == []
        # Idempotent + still nothing earned.
        assert svc.check_all(p.id) == []
        assert all(b["earned"] is False for b in svc.list_badges(p.id))
