"""Growing-medium choice (Plant.soil_key): real per-medium nutrient/water
decay tradeoffs (e.g. inert coco needs more frequent feeding+watering than a
dense, pre-loaded living soil), applied once at plant_seed() time."""

import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain
from growpodempire.economy.ledger import balance, post
from growpodempire.enums import LedgerEntryType
from growpodempire.services.game_service import GameService, GameError
from growpodempire.simulation import engine

BASE = datetime(2025, 1, 1)


_counter = [0]


def _setup(s, soil_key=None, funds=3000):
    _counter[0] += 1
    svc = GameService(s)
    p = svc.create_player(f"dirtfarmer{_counter[0]}")
    post(s, p.id, Decimal(funds), LedgerEntryType.REWARD, ref_type="test")
    strain = s.query(Strain).filter(Strain.slug == "white-widow").one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    if soil_key:
        svc.buy_gear(p.id, soil_key, 1)
    plant = svc.plant_seed(p.id, stack.id, pod.id, soil_key=soil_key)
    for attr in ("last_tick_at", "stage_entered_at", "planted_at"):
        setattr(plant, attr, BASE)
    pod.temperature, pod.humidity, pod.co2_level = 24, 50, 1000
    pod.light_intensity, pod.ph_level = 500, 6.5
    s.flush()
    return svc, p, pod, plant


def test_plant_seed_records_soil_choice(db):
    with session_scope() as s:
        svc, p, pod, plant = _setup(s, soil_key="coco_coir")
        assert plant.soil_key == "coco_coir"


def test_plant_seed_without_soil_defaults_to_none(db):
    with session_scope() as s:
        svc, p, pod, plant = _setup(s)
        assert plant.soil_key is None


def test_soil_purchase_is_consumed_on_plant(db):
    with session_scope() as s:
        svc, p = GameService(s), None
        p = svc.create_player("dirtfarmer2")
        post(s, p.id, Decimal(3000), LedgerEntryType.REWARD, ref_type="test")
        strain = s.query(Strain).filter(Strain.slug == "white-widow").one()
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
        svc.buy_gear(p.id, "super_soil", 1)
        svc.plant_seed(p.id, stack.id, pod.id, soil_key="super_soil")
        owned = {i["key"]: i for i in svc.list_gear(p.id)}
        assert owned["super_soil"]["owned"] == 0


def test_plant_seed_requires_owned_soil(db):
    with session_scope() as s:
        svc, p = GameService(s), None
        p = svc.create_player("dirtfarmer3")
        post(s, p.id, Decimal(3000), LedgerEntryType.REWARD, ref_type="test")
        strain = s.query(Strain).filter(Strain.slug == "white-widow").one()
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
        with pytest.raises(GameError):
            svc.plant_seed(p.id, stack.id, pod.id, soil_key="super_soil")


def test_plant_seed_rejects_non_soil_gear(db):
    with session_scope() as s:
        svc, p = GameService(s), None
        p = svc.create_player("dirtfarmer4")
        post(s, p.id, Decimal(3000), LedgerEntryType.REWARD, ref_type="test")
        strain = s.query(Strain).filter(Strain.slug == "white-widow").one()
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
        svc.buy_gear(p.id, "led_125w", 1)
        with pytest.raises(GameError):
            svc.plant_seed(p.id, stack.id, pod.id, soil_key="led_125w")


def test_super_soil_slows_nutrient_decay_vs_no_soil(db):
    """super_soil's nutrient_decay_multiplier (0.6) means a plant in it should
    still have MORE nutrient after the same number of hours than a plant with
    no soil chosen (multiplier 1.0) — the real "pre-loaded living soil needs
    no bottled nutrients" claim, made mechanically true."""
    with session_scope() as s:
        _, _, pod_plain, plain_plant = _setup(s, soil_key=None)
        _, _, pod_soil, soil_plant = _setup(s, soil_key="super_soil")
        cfg = svc_cfg = GameService(s).cfg
        for _ in range(40):
            engine.catch_up(s, plain_plant, plain_plant.last_tick_at + timedelta(hours=1), cfg)
            engine.catch_up(s, soil_plant, soil_plant.last_tick_at + timedelta(hours=1), cfg)
        assert soil_plant.nutrient_level > plain_plant.nutrient_level


def test_coco_water_retention_beats_perlite_drainage(db):
    """coco_coir (water_decay_multiplier 0.85, retains moisture) should hold
    MORE water after the same hours than perlite_mix (1.25, drains fast) —
    the real "coco = good retention, perlite = fast drainage" tradeoff."""
    with session_scope() as s:
        _, _, _, coco_plant = _setup(s, soil_key="coco_coir")
        _, _, _, perlite_plant = _setup(s, soil_key="perlite_mix")
        cfg = GameService(s).cfg
        for _ in range(20):
            engine.catch_up(s, coco_plant, coco_plant.last_tick_at + timedelta(hours=1), cfg)
            engine.catch_up(s, perlite_plant, perlite_plant.last_tick_at + timedelta(hours=1), cfg)
        assert coco_plant.water_level > perlite_plant.water_level
