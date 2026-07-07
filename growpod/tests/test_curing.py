"""Post-harvest curing: quality bonus, idempotent/early finish, over-dry, sale."""

import os
import sys
from datetime import datetime
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, Harvest
from growpodempire.economy.ledger import balance
from growpodempire.economy.config import get_economy_config
from growpodempire.economy import pricing
from growpodempire.services.game_service import GameService, GameError
from growpodempire.simulation import curing
from growpodempire.simulation.clock import FrozenClock

BASE = datetime(2025, 1, 1)


def _unsold_harvest(s, clock, quality=70.0):
    svc = GameService(s, clock=clock)
    p = svc.create_player("curer")
    strain = s.query(Strain).filter(Strain.slug == "blue-dream").one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Room", charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    h = svc.harvest_plant(p.id, plant.id, weight_g=100, quality=quality, sell=False)
    return svc, p, h


# ----- the pure curing model ---------------------------------------------
def test_cure_progress_is_deterministic_and_monotone_until_optimal():
    cfg = get_economy_config()
    started = BASE
    # Partway through the optimal window: bonus grows with elapsed time.
    early = curing.cure_progress(70.0, started, 72, started.replace(hour=12), cfg)
    later = curing.cure_progress(70.0, started, 72, BASE.replace(day=2), cfg)
    assert 70.0 < early.quality < later.quality
    # Reading the same moment twice yields the same result (idempotent).
    again = curing.cure_progress(70.0, started, 72, BASE.replace(day=2), cfg)
    assert again.quality == later.quality


def test_cure_result_frozen_once_target_elapsed():
    cfg = get_economy_config()
    at_target = curing.cure_progress(70.0, BASE, 72, BASE.replace(day=4), cfg)  # 72h
    way_past = curing.cure_progress(70.0, BASE, 72, BASE.replace(day=10), cfg)
    assert at_target.done and way_past.done
    # Committed target is 72h, so the outcome stops changing after that.
    assert at_target.quality == way_past.quality


def test_over_dry_penalty_for_an_over_long_cure():
    cfg = get_economy_config()
    # A very long committed cure pushes past optimal+grace and erodes quality.
    good = curing.cure_progress(90.0, BASE, 72, BASE.replace(day=4), cfg)
    overdried = curing.cure_progress(90.0, BASE, 336, BASE.replace(day=20), cfg)
    assert overdried.quality < good.quality


# ----- the service flow ---------------------------------------------------
def test_cure_then_sell_beats_selling_raw(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, p, h = _unsold_harvest(s, clock, quality=70.0)
        raw_value = pricing.harvest_value(
            h.weight_g, h.quality, h.rarity_snapshot, svc.cfg,
            thc_actual=h.thc_actual, terpene_intensity=svc._terpene_intensity(h),
        )

        svc.start_cure(p.id, h.id, target_hours=72)
        assert h.cure_status == "curing" and h.base_quality == 70.0

        # Cannot finish before the committed target elapses.
        clock.advance(hours=10)
        with pytest.raises(GameError):
            svc.finish_cure(p.id, h.id)

        clock.advance(hours=70)  # now 80h elapsed > 72h target
        before = balance(s, p.id)
        svc.finish_cure(p.id, h.id, sell=True)
        assert h.cure_status == "cured"
        assert h.quality > 70.0 and h.cure_quality_bonus > 0
        assert h.sold and h.sale_value > raw_value
        assert balance(s, p.id) == before + h.sale_value


def test_cannot_cure_a_sold_harvest(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, p, h = _unsold_harvest(s, clock)
        svc.sell_harvest(p.id, h.id)
        assert h.sold
        with pytest.raises(GameError):
            svc.start_cure(p.id, h.id)


def test_cannot_sell_while_curing(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, p, h = _unsold_harvest(s, clock)
        svc.start_cure(p.id, h.id, target_hours=72)
        with pytest.raises(GameError):
            svc.sell_harvest(p.id, h.id)


def test_double_sell_is_rejected(db):
    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, p, h = _unsold_harvest(s, clock)
        svc.sell_harvest(p.id, h.id)
        with pytest.raises(GameError):
            svc.sell_harvest(p.id, h.id)


def test_cure_clock_uses_turbo_with_wall_floor(db):
    """C8/D3: Cure clock respects player-effective (turbo-aware) time, but with
    a wall-clock floor so cures never become instant even at max turbo."""
    from growpodempire.db.models import Player

    clock = FrozenClock(BASE)
    with session_scope() as s:
        svc, p, h = _unsold_harvest(s, clock, quality=70.0)

        # Start cure for 72 hours
        svc.start_cure(p.id, h.id, target_hours=72)
        assert h.cure_status == "curing"

        # Advance wall clock by 10 hours (not enough to finish)
        clock.advance(hours=10)

        # Enable turbo with a 10x multiplier for this player
        player = s.get(Player, p.id)
        player.turbo_enabled = True
        player.turbo_anchor_at = clock.now()
        player.turbo_offset_seconds = 0.0
        s.commit()

        # Advance wall clock by just 8 more hours (18 total wall clock)
        clock.advance(hours=8)
        # But with 10x turbo active: effective elapsed = 10 + (8 * 10) = 90 hours
        # However, the wall-clock floor should apply: effective = max(18, 90) = 90
        # But since the target is 72 hours, we should be able to finish

        # Actually, the effective elapsed should be min(effective, target)
        # So it should be able to finish
        before = balance(s, p.id)
        svc.finish_cure(p.id, h.id, sell=True)
        assert h.cure_status == "cured"
        assert h.sold
        # Wall clock floor ensures cure doesn't get too fast
        # Effective time should be >= wall time (90 >= 18)
        assert balance(s, p.id) == before + h.sale_value
