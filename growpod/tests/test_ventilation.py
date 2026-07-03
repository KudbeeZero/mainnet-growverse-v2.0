"""Fans: equipping one lowers the pod's *effective* ambient humidity (the
sim's mold/mildew and VPD math all read this), scaled by the fan's condition —
only a real exhaust fan (which removes air from the room) gives a large
reduction, matching how HVAC actually works vs. simple recirculation."""

import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, GearInventory
from growpodempire.economy.ledger import post
from growpodempire.enums import LedgerEntryType
from growpodempire.services.game_service import GameService, GameError
from growpodempire.simulation import engine

BASE = datetime(2025, 1, 1)

_counter = [0]


def _setup(s, fan_key=None, funds=3000, humidity=80):
    _counter[0] += 1
    svc = GameService(s)
    p = svc.create_player(f"ventfarmer{_counter[0]}")
    post(s, p.id, Decimal(funds), LedgerEntryType.REWARD, ref_type="test")
    strain = s.query(Strain).filter(Strain.slug == "white-widow").one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    for attr in ("last_tick_at", "stage_entered_at", "planted_at"):
        setattr(plant, attr, BASE)
    pod.temperature, pod.co2_level = 24, 1000
    pod.humidity = humidity  # damp room — well above the mildew threshold
    pod.light_intensity, pod.ph_level = 500, 6.5
    if fan_key:
        svc.buy_gear(p.id, fan_key, 1)
        svc.equip_fan(p.id, pod.id, fan_key)
    s.flush()
    return svc, p, pod, plant


def test_equip_fan_writes_no_pod_field(db):
    """Unlike a light, a fan's effect is read live by the engine — equipping
    one shouldn't mutate any pod column."""
    with session_scope() as s:
        svc, p, pod, plant = _setup(s, fan_key="inline_exhaust_6in")
        assert pod.humidity == 80  # unchanged; only the *effective* env differs


def test_equip_non_fan_fails(db):
    with session_scope() as s:
        svc, p, pod, plant = _setup(s)
        svc.buy_gear(p.id, "led_125w", 1)
        with pytest.raises(GameError):
            svc.equip_fan(p.id, pod.id, "led_125w")


def test_environment_for_reflects_fan_reduction(db):
    with session_scope() as s:
        cfg = GameService(s).cfg
        _, _, pod_none, plant_none = _setup(s, fan_key=None)
        _, _, pod_fan, plant_fan = _setup(s, fan_key="inline_exhaust_6in")
        sim = cfg.raw.get("simulation", {})
        env_none = engine._env_for(plant_none, pod_none, sim)
        gear_fx = engine._equipped_condition_effects(s, pod_fan, cfg)
        env_fan = engine._env_for(
            plant_fan, pod_fan, sim, fan_reduction_pct=gear_fx.get("fan_reduction_pct", 0.0)
        )
        assert env_fan["humidity"] < env_none["humidity"]


def test_inline_exhaust_reduces_mildew_more_than_clip_fan(db):
    """The only fan that actually exhausts air (removing moisture from the
    room) should suppress disease/mildew growth far more than one that just
    recirculates air inside the tent — the real HVAC distinction."""
    with session_scope() as s:
        cfg = GameService(s).cfg
        _, _, pod_clip, plant_clip = _setup(s, fan_key="clip_fan")
        _, _, pod_exhaust, plant_exhaust = _setup(s, fan_key="inline_exhaust_6in")
        for _ in range(72):  # 3 damp days — long enough for mildew to build up
            engine.catch_up(s, plant_clip, plant_clip.last_tick_at + timedelta(hours=1), cfg)
            engine.catch_up(s, plant_exhaust, plant_exhaust.last_tick_at + timedelta(hours=1), cfg)
        assert plant_exhaust.disease_level < plant_clip.disease_level


def test_worn_fan_ventilates_less_than_new(db):
    """A fan at reduced condition should deliver a proportionally smaller
    humidity reduction — depreciation is a real performance tax."""
    with session_scope() as s:
        cfg = GameService(s).cfg
        _, p, pod, plant = _setup(s, fan_key="inline_exhaust_6in")
        fresh_fx = engine._equipped_condition_effects(s, pod, cfg)

        stack = (
            s.query(GearInventory)
            .filter(GearInventory.player_id == p.id, GearInventory.gear_key == "inline_exhaust_6in")
            .one()
        )
        stack.condition_pct = 50.0
        s.flush()
        worn_fx = engine._equipped_condition_effects(s, pod, cfg)

        assert worn_fx["fan_reduction_pct"] < fresh_fx["fan_reduction_pct"]
        assert worn_fx["fan_reduction_pct"] == pytest.approx(fresh_fx["fan_reduction_pct"] * 0.5)
