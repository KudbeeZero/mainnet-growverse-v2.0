"""Equipment/consumables shop + seasonal strain gating (Phase 2)."""

import os
import sys
from datetime import datetime
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain
from growpodempire.economy.ledger import balance, post
from growpodempire.economy.config import load_economy_config
from growpodempire.enums import LedgerEntryType
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.simulation_service import SimulationService
from growpodempire.simulation.clock import FrozenClock

BASE = datetime(2025, 1, 1)


def _player(s, funds=2000):
    svc = GameService(s)
    p = svc.create_player("shopper")
    post(s, p.id, Decimal(funds), LedgerEntryType.REWARD, ref_type="test")
    s.flush()
    return svc, p


def _plant(svc, s, p, clock):
    strain = s.query(Strain).filter(Strain.slug == "blue-dream").one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Room", charge=False)
    return svc.plant_seed(p.id, stack.id, pod.id)


def test_buy_consumable_debits_and_adds(db):
    with session_scope() as s:
        svc, p = _player(s)
        before = balance(s, p.id)
        stack = svc.buy_consumable(p.id, "ladybugs", 2)
        assert stack.quantity == 2
        assert balance(s, p.id) == before - Decimal("90")  # 45 * 2
        items = {i["key"]: i for i in svc.list_consumables(p.id)}
        assert items["ladybugs"]["owned"] == 2


def test_buy_unknown_consumable_fails(db):
    with session_scope() as s:
        svc, p = _player(s)
        with pytest.raises(GameError):
            svc.buy_consumable(p.id, "moon_dust")


def test_apply_ladybugs_clears_pests(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, p = _player(s)
        plant = _plant(svc, s, p, clock)
        plant.pest_level = 8.0
        s.flush()
        svc.buy_consumable(p.id, "ladybugs", 1)

        sim = SimulationService(s, clock=clock)
        out = sim.apply_consumable(p.id, plant.id, "ladybugs")
        assert out.pest_level == 0.0
        # consumed
        assert svc.list_consumables(p.id)[0] is not None
        items = {i["key"]: i for i in svc.list_consumables(p.id)}
        assert items["ladybugs"]["owned"] == 0


def test_apply_without_owning_fails(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, p = _player(s)
        plant = _plant(svc, s, p, clock)
        sim = SimulationService(s, clock=clock)
        with pytest.raises(GameError):
            sim.apply_consumable(p.id, plant.id, "ladybugs")


def test_bloom_booster_requires_flowering(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, p = _player(s)
        plant = _plant(svc, s, p, clock)  # starts at seed stage
        svc.buy_consumable(p.id, "bloom_booster", 1)
        sim = SimulationService(s, clock=clock)
        with pytest.raises(GameError):
            sim.apply_consumable(p.id, plant.id, "bloom_booster")


def test_seasonal_strain_gating(db):
    with session_scope() as s:
        cfg = load_economy_config()
        cfg.raw.setdefault("events", {})["current_season"] = "summer"
        svc = GameService(s, config=cfg)
        p = svc.create_player("seasonal")
        post(s, p.id, Decimal("2000"), LedgerEntryType.REWARD, ref_type="test")
        s.flush()

        winter = s.query(Strain).filter(Strain.slug == "blue-dream").one()
        winter.season = "winter"
        summer = s.query(Strain).filter(Strain.slug == "afghani").one()
        summer.season = "summer"
        s.flush()

        with pytest.raises(GameError):
            svc.buy_seed(p.id, winter.id)        # out of season
        assert svc.buy_seed(p.id, summer.id).quantity == 1  # in season
