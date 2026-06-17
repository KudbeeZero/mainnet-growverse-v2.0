"""Store grow-room gear: buy/own lights, fans, soils + the functional
light → pod.light_intensity hook (Phase 2)."""

import os
import sys
from datetime import datetime
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.economy.ledger import balance, post, InsufficientFundsError
from growpodempire.enums import LedgerEntryType
from growpodempire.services.game_service import GameService, GameError

BASE = datetime(2025, 1, 1)


def _player(s, funds=3000):
    svc = GameService(s)
    p = svc.create_player("gearhead")
    post(s, p.id, Decimal(funds), LedgerEntryType.REWARD, ref_type="test")
    s.flush()
    return svc, p


def test_buy_gear_debits_and_adds(db):
    with session_scope() as s:
        svc, p = _player(s)
        before = balance(s, p.id)
        stack = svc.buy_gear(p.id, "led_125w", 1)
        assert stack.quantity == 1
        assert stack.category == "light"
        assert balance(s, p.id) == before - Decimal("150")
        items = {i["key"]: i for i in svc.list_gear(p.id)}
        assert items["led_125w"]["owned"] == 1
        # catalog exposes specs + image for the storefront
        assert items["led_800w"]["specs"]["watts"] == 800
        assert items["worm_castings"]["category"] == "soil"


def test_buy_unknown_gear_fails(db):
    with session_scope() as s:
        svc, p = _player(s)
        with pytest.raises(GameError):
            svc.buy_gear(p.id, "fusion_reactor")


def test_buy_gear_insufficient_funds(db):
    with session_scope() as s:
        svc, p = _player(s, funds=100)  # SunForge 800W costs 1200
        with pytest.raises(InsufficientFundsError):
            svc.buy_gear(p.id, "led_800w", 1)


def test_equip_light_sets_pod_ppfd(db):
    with session_scope() as s:
        svc, p = _player(s)
        pod = svc.create_pod(p.id, "Room", charge=False)
        svc.buy_gear(p.id, "led_700w", 1)
        out = svc.equip_light(p.id, pod.id, "led_700w")
        assert out.light_intensity == 900.0  # led_700w ppfd
        items = {i["key"]: i for i in svc.list_gear(p.id)}
        assert items["led_700w"]["equipped_pod_id"] == pod.id


def test_equip_light_swaps_previous_light(db):
    with session_scope() as s:
        svc, p = _player(s)
        pod = svc.create_pod(p.id, "Room", charge=False)
        svc.buy_gear(p.id, "led_125w", 1)
        svc.buy_gear(p.id, "led_800w", 1)
        svc.equip_light(p.id, pod.id, "led_125w")
        svc.equip_light(p.id, pod.id, "led_800w")
        assert s.get(type(pod), pod.id).light_intensity == 1000.0
        items = {i["key"]: i for i in svc.list_gear(p.id)}
        assert items["led_125w"]["equipped_pod_id"] is None
        assert items["led_800w"]["equipped_pod_id"] == pod.id


def test_equip_non_light_fails(db):
    with session_scope() as s:
        svc, p = _player(s)
        pod = svc.create_pod(p.id, "Room", charge=False)
        svc.buy_gear(p.id, "clip_fan", 1)
        with pytest.raises(GameError):
            svc.equip_light(p.id, pod.id, "clip_fan")


def test_equip_unowned_light_fails(db):
    with session_scope() as s:
        svc, p = _player(s)
        pod = svc.create_pod(p.id, "Room", charge=False)
        with pytest.raises(GameError):
            svc.equip_light(p.id, pod.id, "led_480w")
