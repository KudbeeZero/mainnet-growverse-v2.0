"""Strain search/filter + favorites."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, StrainFavorite
from growpodempire.services.game_service import GameService


def test_search_by_name_and_rarity(db):
    with session_scope() as s:
        svc = GameService(s)
        by_name = svc.list_strains(q="kush")
        assert by_name and all("kush" in st.name.lower() for st in by_name)

        rares = svc.list_strains(rarity="rare")
        assert rares and all(st.rarity == "rare" for st in rares)


def test_filter_by_thc_and_indica(db):
    with session_scope() as s:
        svc = GameService(s)
        high_thc = svc.list_strains(min_thc=24)
        assert all(st.thc_max >= 24 for st in high_thc)

        indica_leaning = svc.list_strains(min_indica=0.8)
        assert indica_leaning and all(st.indica_ratio >= 0.8 for st in indica_leaning)


def test_favorites_add_list_remove(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("fan")
        strain = s.query(Strain).filter(Strain.slug == "blue-dream").one()

        svc.add_favorite(p.id, strain.id)
        svc.add_favorite(p.id, strain.id)  # idempotent
        assert s.query(StrainFavorite).filter_by(player_id=p.id).count() == 1
        assert [st.id for st in svc.list_favorites(p.id)] == [strain.id]

        svc.remove_favorite(p.id, strain.id)
        assert svc.list_favorites(p.id) == []
