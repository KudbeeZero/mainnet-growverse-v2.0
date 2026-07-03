"""Equipment condition & depreciation: durable gear wears with use (not
calendar time), never fully breaks, can be serviced but with a dropping
ceiling each time (real refurbished-gear economics), and resells for a
condition-scaled fraction of its original price."""

import os
import sys
from datetime import datetime
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, GearInventory
from growpodempire.economy.ledger import balance, post
from growpodempire.enums import LedgerEntryType
from growpodempire.services.game_service import GameService, GameError

BASE = datetime(2025, 1, 1)

_counter = [0]


def _grower(s, funds=5000):
    _counter[0] += 1
    svc = GameService(s)
    p = svc.create_player(f"geargrower{_counter[0]}")
    post(s, p.id, Decimal(funds), LedgerEntryType.REWARD, ref_type="test")
    return svc, p


def _harvest_ready_plant(svc, p, pod):
    strain = svc.session.query(Strain).filter(Strain.slug == "white-widow").one()
    stack = svc.buy_seed(p.id, strain.id)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    plant.growth_stage = "harvest"
    return plant


def test_harvest_wears_equipped_light_not_unequipped_one(db):
    with session_scope() as s:
        svc, p = _grower(s)
        pod = svc.create_pod(p.id, "Tent", charge=False)
        svc.buy_gear(p.id, "led_320w", 1)
        svc.equip_light(p.id, pod.id, "led_320w")
        svc.buy_gear(p.id, "led_125w", 1)  # owned but never equipped

        plant = _harvest_ready_plant(svc, p, pod)
        s.flush()
        svc.harvest_plant(p.id, plant.id, sell=False)

        gear = {g.gear_key: g for g in s.query(GearInventory).filter(GearInventory.player_id == p.id)}
        assert gear["led_320w"].condition_pct == pytest.approx(96.0)  # 100 - 4.0 wear_per_cycle
        assert gear["led_320w"].grow_cycles_used == 1
        assert gear["led_125w"].condition_pct == 100.0  # never equipped, never worn


def test_gear_condition_floors_and_never_fully_breaks(db):
    with session_scope() as s:
        svc, p = _grower(s)
        pod = svc.create_pod(p.id, "Tent", charge=False)
        svc.buy_gear(p.id, "clip_fan", 1)
        svc.equip_fan(p.id, pod.id, "clip_fan")
        stack = (
            s.query(GearInventory)
            .filter(GearInventory.player_id == p.id, GearInventory.gear_key == "clip_fan")
            .one()
        )
        stack.condition_pct = 51.0  # one wear-tick (fan wear = 6.0) from the floor
        s.flush()

        plant = _harvest_ready_plant(svc, p, pod)
        s.flush()
        svc.harvest_plant(p.id, plant.id, sell=False)

        s.refresh(stack) if hasattr(s, "refresh") else None
        assert stack.condition_pct == 50.0  # floor_pct, not 45.0


def test_service_restores_toward_ceiling_and_debits(db):
    with session_scope() as s:
        svc, p = _grower(s)
        pod = svc.create_pod(p.id, "Tent", charge=False)
        svc.buy_gear(p.id, "led_320w", 1)
        stack = (
            s.query(GearInventory)
            .filter(GearInventory.player_id == p.id, GearInventory.gear_key == "led_320w")
            .one()
        )
        stack.condition_pct = 60.0
        s.flush()
        before = balance(s, p.id)

        svc.service_gear(p.id, "led_320w")

        assert stack.condition_pct == 95.0  # first_ceiling_pct
        assert stack.times_serviced == 1
        assert balance(s, p.id) == before - Decimal(str(380 * 0.35))  # led_320w cost 380


def test_service_ceiling_drops_each_time_and_never_reaches_100(db):
    with session_scope() as s:
        svc, p = _grower(s)
        svc.buy_gear(p.id, "led_320w", 1)
        stack = (
            s.query(GearInventory)
            .filter(GearInventory.player_id == p.id, GearInventory.gear_key == "led_320w")
            .one()
        )
        stack.condition_pct = 10.0
        s.flush()

        ceilings = []
        for _ in range(8):
            stack.condition_pct = 10.0  # simulate it wearing back down between services
            svc.service_gear(p.id, "led_320w")
            ceilings.append(stack.condition_pct)

        assert ceilings == sorted(ceilings, reverse=True)  # strictly non-increasing
        assert max(ceilings) < 100.0
        assert min(ceilings) >= 70.0  # min_ceiling_pct floor


def test_service_rejected_when_already_at_ceiling(db):
    with session_scope() as s:
        svc, p = _grower(s)
        svc.buy_gear(p.id, "led_320w", 1)
        with pytest.raises(GameError):
            svc.service_gear(p.id, "led_320w")  # already at 100, ceiling is 95


def test_sell_gear_pays_condition_scaled_resale_and_removes_stock(db):
    with session_scope() as s:
        svc, p = _grower(s)
        svc.buy_gear(p.id, "led_320w", 1)
        stack = (
            s.query(GearInventory)
            .filter(GearInventory.player_id == p.id, GearInventory.gear_key == "led_320w")
            .one()
        )
        stack.condition_pct = 80.0
        s.flush()
        before = balance(s, p.id)

        proceeds = svc.sell_gear(p.id, "led_320w", 1)

        expected = round(380 * 0.55 * 0.8, 2)
        assert proceeds == pytest.approx(expected)
        assert balance(s, p.id) == before + Decimal(str(expected))
        owned = {i["key"]: i for i in svc.list_gear(p.id)}
        assert owned["led_320w"]["owned"] == 0


def test_cannot_sell_last_equipped_gear(db):
    with session_scope() as s:
        svc, p = _grower(s)
        pod = svc.create_pod(p.id, "Tent", charge=False)
        svc.buy_gear(p.id, "led_320w", 1)
        svc.equip_light(p.id, pod.id, "led_320w")
        with pytest.raises(GameError):
            svc.sell_gear(p.id, "led_320w", 1)


def test_list_gear_exposes_condition_fields_for_owned_lights_and_fans(db):
    with session_scope() as s:
        svc, p = _grower(s)
        svc.buy_gear(p.id, "led_320w", 1)
        items = {i["key"]: i for i in svc.list_gear(p.id)}
        assert items["led_320w"]["condition_pct"] == 100.0
        assert items["led_320w"]["times_serviced"] == 0
        assert "service_cost" in items["led_320w"]
        assert "resale_value" in items["led_320w"]
        # Soils aren't equippable/wearable — no condition fields.
        assert "condition_pct" not in items["worm_castings"]
