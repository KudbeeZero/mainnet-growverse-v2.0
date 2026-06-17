"""Timed NPC contracts: offer, fulfill, deadline."""

import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, Harvest
from growpodempire.economy.ledger import balance
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.contract_service import ContractService
from growpodempire.simulation.clock import FrozenClock

BASE = datetime(2025, 1, 1)


def _stock_unsold(svc, pid, slug, grams, n=1):
    strain = svc.session.query(Strain).filter(Strain.slug == slug).one()
    for _ in range(n):
        stack = svc.buy_seed(pid, strain.id)
        pod = svc.create_pod(pid, "Tent", charge=False)
        plant = svc.plant_seed(pid, stack.id, pod.id)
        svc.harvest_plant(pid, plant.id, weight_g=grams, quality=80, sell=False)


def test_offer_creates_open_contract(db):
    with session_scope() as s:
        p = GameService(s).create_player("contractor")
        c = ContractService(s, clock=FrozenClock(BASE)).offer(p.id, rng_seed=1)
        assert c.status == "open" and c.target_grams > 0 and c.reward_grow > 0


def test_fulfill_consumes_harvests_and_pays(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("filler")
        # Two common harvests of 60g each -> 120g >= 100g common target.
        _stock_unsold(svc, p.id, "blue-dream", 60, n=2)
        cs = ContractService(s, clock=FrozenClock(BASE))
        # Force a common-rarity contract by seeding until rarity matches.
        contract = cs.offer(p.id, rng_seed=1)
        while contract.target_rarity != "common":
            contract = cs.offer(p.id, rng_seed=hash(contract.id) % 1000)

        before = balance(s, p.id)
        result = cs.fulfill(p.id, contract.id)
        assert result["reward_grow"] == float(contract.reward_grow)
        assert balance(s, p.id) == before + contract.reward_grow
        # Harvests consumed.
        s.flush()
        unsold = s.query(Harvest).filter_by(player_id=p.id, sold=False).count()
        assert unsold == 0
        assert p.xp >= contract.reward_xp


def test_insufficient_grams_errors(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("short")
        cs = ContractService(s, clock=FrozenClock(BASE))
        contract = cs.offer(p.id, rng_seed=1)
        with pytest.raises(GameError):
            cs.fulfill(p.id, contract.id)  # no harvests stocked


def test_deadline_expiry(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("late")
        clock = FrozenClock(BASE)
        cs = ContractService(s, clock=clock)
        contract = cs.offer(p.id, rng_seed=1)
        clock.advance(days=30)  # well past the 7-day deadline
        with pytest.raises(GameError):
            cs.fulfill(p.id, contract.id)
        assert s.get(type(contract), contract.id).status == "expired"
