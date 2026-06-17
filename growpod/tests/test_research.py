"""Research tree: gating, unlock/debit/XP, effect aggregation, and the
gameplay bonuses (yield, quality, discounts, pod capacity)."""

import os
import sys
from datetime import datetime
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain
from growpodempire.economy.ledger import balance, post
from growpodempire.enums import LedgerEntryType
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.research_service import ResearchService, research_effects
from growpodempire.services import leveling_service
from growpodempire.economy.config import get_economy_config

BASE = datetime(2025, 1, 1)


def _rich_player(s, level=10, funds=10000):
    svc = GameService(s)
    p = svc.create_player("researcher")
    # Level is derived from XP, so seed enough XP to *be* that level (setting
    # level directly would be overwritten the next time XP is awarded).
    p.xp = leveling_service.xp_for_level(level, get_economy_config())
    p.level = level
    post(s, p.id, Decimal(funds), LedgerEntryType.REWARD, ref_type="test")
    s.flush()
    return svc, p


def test_unlock_requires_level(db):
    with session_scope() as s:
        _, p = _rich_player(s, level=1)
        with pytest.raises(GameError):
            ResearchService(s).unlock(p.id, "hydroponics")  # needs level 2


def test_unlock_requires_prerequisite(db):
    with session_scope() as s:
        _, p = _rich_player(s, level=10)
        with pytest.raises(GameError):
            ResearchService(s).unlock(p.id, "aeroponics")  # needs hydroponics


def test_unlock_debits_records_and_awards_xp(db):
    with session_scope() as s:
        _, p = _rich_player(s, level=10)
        rs = ResearchService(s)
        before, xp_before = balance(s, p.id), p.xp
        rs.unlock(p.id, "hydroponics")
        assert balance(s, p.id) == before - Decimal("400")
        assert p.xp > xp_before
        assert research_effects(s, p.id)["yield_pct"] == 0.08
        with pytest.raises(GameError):           # no double-unlock
            rs.unlock(p.id, "hydroponics")


def test_effects_aggregate_across_branch(db):
    with session_scope() as s:
        _, p = _rich_player(s, level=10)
        rs = ResearchService(s)
        rs.unlock(p.id, "hydroponics")   # +0.08
        rs.unlock(p.id, "aeroponics")    # +0.12
        assert abs(rs.effects(p.id)["yield_pct"] - 0.20) < 1e-9


def test_research_boosts_harvest_yield_and_quality(db):
    with session_scope() as s:
        svc, p = _rich_player(s, level=10)
        rs = ResearchService(s)
        rs.unlock(p.id, "hydroponics")      # +8% yield
        rs.unlock(p.id, "nutrient_science") # +4 quality
        strain = s.query(Strain).filter(Strain.slug == "blue-dream").one()
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Room", charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        h = svc.harvest_plant(p.id, plant.id, weight_g=100, quality=80, sell=False)
        assert h.weight_g == 108.0
        assert h.quality == 84.0


def test_research_grants_pod_capacity(db):
    with session_scope() as s:
        svc, p = _rich_player(s, level=10)
        rs = ResearchService(s)
        rs.unlock(p.id, "bulk_supplier")     # prereq
        rs.unlock(p.id, "vertical_racking")  # +2 capacity
        pod = svc.create_pod(p.id, "Big", charge=False)
        assert pod.capacity == 6   # default 4 + 2


def test_breeding_discount_lowers_fee(db):
    with session_scope() as s:
        svc, p = _rich_player(s, level=10)
        a = s.query(Strain).filter(Strain.slug == "blue-dream").one()
        b = s.query(Strain).filter(Strain.slug == "afghani").one()
        # Baseline fee from a no-research breed.
        before = balance(s, p.id)
        svc.breed(p.id, a.id, b.id, offspring_name="F1A", rng_seed=1)
        baseline_fee = before - balance(s, p.id)

        ResearchService(s).unlock(p.id, "tissue_culture")  # -25% breeding fee
        before2 = balance(s, p.id)
        svc.breed(p.id, a.id, b.id, offspring_name="F1B", rng_seed=2)
        discounted_fee = before2 - balance(s, p.id)
        assert discounted_fee < baseline_fee
