"""Leaderboard rankings."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain
from growpodempire.services.game_service import GameService
from growpodempire.services.leaderboard_service import LeaderboardService


def _grow_and_harvest(svc, player_id, slug, weight):
    strain = svc.session.query(Strain).filter(Strain.slug == slug).one()
    stack = svc.buy_seed(player_id, strain.id)
    pod = svc.create_pod(player_id, "Tent", charge=False)
    plant = svc.plant_seed(player_id, stack.id, pod.id)
    svc.harvest_plant(player_id, plant.id, weight_g=weight, quality=80)


def test_richest_and_harvest_leaderboards(db):
    with session_scope() as s:
        svc = GameService(s)
        whale = svc.create_player("whale")
        minnow = svc.create_player("minnow")

        # whale harvests more weight than minnow
        _grow_and_harvest(svc, whale.id, "blue-dream", 200)
        _grow_and_harvest(svc, minnow.id, "blue-dream", 50)

        lb = LeaderboardService(s)
        harvests = lb.biggest_harvesters()
        assert harvests[0]["username"] == "whale"

        richest = lb.richest()
        # whale earned more from the bigger harvest
        assert richest[0]["username"] == "whale"


def test_breeders_and_level_leaderboards(db):
    with session_scope() as s:
        svc = GameService(s)
        breeder = svc.create_player("breeder")
        idler = svc.create_player("idler")
        a = s.query(Strain).filter(Strain.slug == "blue-dream").one()
        b = s.query(Strain).filter(Strain.slug == "white-widow").one()
        svc.breed(breeder.id, a.id, b.id, rng_seed=1)
        svc.breed(breeder.id, a.id, b.id, rng_seed=2)

        lb = LeaderboardService(s)
        breeders = lb.top_breeders()
        assert breeders[0]["username"] == "breeder" and breeders[0]["value"] == 2

        levels = lb.top_levels()
        # breeder has XP from breeding; idler has none -> breeder ranks first
        assert levels[0]["username"] == "breeder"


def test_researchers_leaderboard(db):
    from decimal import Decimal
    from growpodempire.economy.ledger import post
    from growpodempire.enums import LedgerEntryType
    from growpodempire.services import leveling_service
    from growpodempire.economy.config import get_economy_config
    from growpodempire.services.research_service import ResearchService

    with session_scope() as s:
        svc = GameService(s)
        scholar = svc.create_player("scholar")
        scholar.xp = leveling_service.xp_for_level(10, get_economy_config())
        scholar.level = 10
        post(s, scholar.id, Decimal("10000"), LedgerEntryType.REWARD, ref_type="t")
        svc.create_player("rookie")
        s.flush()

        rs = ResearchService(s)
        rs.unlock(scholar.id, "hydroponics")
        rs.unlock(scholar.id, "ipm_basics")

        board = LeaderboardService(s).top_researchers()
        assert board[0]["username"] == "scholar" and board[0]["value"] == 2
