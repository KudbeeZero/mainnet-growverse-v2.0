"""Targeted edge-branch coverage for three services (service-level, not HTTP):

  * simulation_service.py  — apply_consumable unknown/effect branches; _require_living
  * cup_service.py         — disabled cup, sold harvest, idempotent judge, prize tiers,
                             list_cups, champion mint with no genome
  * university_service.py  — module-level course_effects/degree_effects edge loops,
                             enroll-when-closed, complete_course unknown/already-done,
                             unknown practical type

These deliberately reach only the branches the existing suites leave uncovered;
they do not duplicate cases in test_simulation.py / test_cup.py / test_university.py
/ test_shop.py.
"""

import copy
import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import (
    Strain, CourseEnrollment, DegreeProgress, CannabisCup, CupEntry,
)
from growpodempire.economy.config import EconomyConfig, load_economy_config
from growpodempire.enums import LedgerEntryType
from growpodempire.economy.ledger import post, balance
from growpodempire.services import leveling_service
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.simulation_service import SimulationService
from growpodempire.services.cup_service import CupService
from growpodempire.services.university_service import (
    UniversityService, course_effects, degree_effects,
)
from growpodempire.simulation.clock import FrozenClock

CFG = load_economy_config()
SIM_BASE = datetime(2025, 1, 1)
CUP_BASE = datetime(2026, 1, 1)
CUP_LATE = CUP_BASE + timedelta(days=91)
UNI_BASE = datetime(2026, 1, 1)
UNI_LATER = UNI_BASE + timedelta(hours=72)


# ===========================================================================
# simulation_service.py — lines 165, 193, 195, 199, 243, 245
# ===========================================================================

def _sim_plant(session):
    svc = GameService(session)
    p = svc.create_player("edgesim")
    strain = session.query(Strain).filter(Strain.slug == "white-widow").one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    for attr in ("last_tick_at", "stage_entered_at", "planted_at"):
        setattr(plant, attr, SIM_BASE)
    session.flush()
    return svc, p, plant


def test_apply_unknown_consumable_raises(db):
    # Line 165: apply_consumable with an item_key absent from the shop config.
    with session_scope() as s:
        svc, p, plant = _sim_plant(s)
        sim = SimulationService(s, clock=FrozenClock(SIM_BASE))
        with pytest.raises(GameError):
            sim.apply_consumable(p.id, plant.id, "moon_dust_999")


def test_rejuvenation_tonic_sets_all_levels(db):
    # rejuvenation_tonic carries water_set, nutrient_set, pest_set, disease_set,
    # health_add — exercising the set-effect branches at lines 193, 195, 199
    # (197/201 are already covered elsewhere, but this hits them too).
    with session_scope() as s:
        svc, p, plant = _sim_plant(s)
        plant.water_level = 10.0
        plant.nutrient_level = 10.0
        plant.pest_level = 40.0
        plant.disease_level = 40.0
        plant.health = 50.0
        s.flush()
        svc.buy_consumable(p.id, "rejuvenation_tonic", 1)
        sim = SimulationService(s, clock=FrozenClock(SIM_BASE))
        out = sim.apply_consumable(p.id, plant.id, "rejuvenation_tonic")
        assert out.water_level == 70.0      # water_set (line 193)
        assert out.nutrient_level == 70.0   # nutrient_set (line 195)
        assert out.pest_level == 0.0        # pest_set
        assert out.disease_level == 0.0     # disease_set (line 199)
        assert out.health > 50.0            # health_add


def test_require_living_rejects_harvested_plant(db):
    # Line 243: _require_living raises on an already-harvested plant.
    with session_scope() as s:
        svc, p, plant = _sim_plant(s)
        plant.harvested = True
        s.flush()
        sim = SimulationService(s, clock=FrozenClock(SIM_BASE))
        with pytest.raises(GameError):
            sim.water(p.id, plant.id)


def test_require_living_rejects_dead_plant(db):
    # Line 245: _require_living raises on a dead (not-harvested) plant.
    with session_scope() as s:
        svc, p, plant = _sim_plant(s)
        plant.is_alive = False
        s.flush()
        sim = SimulationService(s, clock=FrozenClock(SIM_BASE))
        with pytest.raises(GameError):
            sim.water(p.id, plant.id)


# ===========================================================================
# cup_service.py — lines 68, 108, 120, 129, 189, 238-240, 248
# ===========================================================================

def _cup_disabled_cfg():
    raw = copy.deepcopy(CFG.raw)
    raw["cannabis_cup"]["enabled"] = False
    return EconomyConfig(raw=raw)


def _cup_harvest(svc, pid, slug="blue-dream", grams=100, quality=80):
    strain = svc.session.query(Strain).filter(Strain.slug == slug).one()
    stack = svc.buy_seed(pid, strain.id)
    pod = svc.create_pod(pid, "Tent", charge=False)
    plant = svc.plant_seed(pid, stack.id, pod.id)
    return svc.harvest_plant(pid, plant.id, weight_g=grams, quality=quality, sell=False)


def test_open_current_cup_returns_none_when_disabled(db):
    # Line 68: open_current_cup short-circuits to None when the Cup is disabled.
    with session_scope() as s:
        cup = CupService(s, config=_cup_disabled_cfg(), clock=FrozenClock(CUP_BASE))
        assert cup.open_current_cup() is None


def test_enter_when_no_cup_running_raises(db):
    # Line 120: enter() raises when open_current_cup() yields None (disabled).
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("nocup")
        h = _cup_harvest(svc, p.id)
        cup = CupService(s, config=_cup_disabled_cfg(), clock=FrozenClock(CUP_BASE))
        with pytest.raises(GameError):
            cup.enter(p.id, h.id)


def test_enter_sold_harvest_raises(db):
    # Line 129: entering a harvest that has been sold/consumed is rejected.
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("seller")
        h = _cup_harvest(svc, p.id)
        h.sold = True
        s.flush()
        cup = CupService(s, clock=FrozenClock(CUP_BASE))
        with pytest.raises(GameError):
            cup.enter(p.id, h.id)


def test_list_cups_returns_existing(db):
    # Line 108: list_cups returns the created cups.
    with session_scope() as s:
        cup = CupService(s, clock=FrozenClock(CUP_BASE))
        cup.open_current_cup()
        rows = cup.list_cups()
        assert len(rows) >= 1
        assert all(isinstance(c, CannabisCup) for c in rows)


def test_judge_is_noop_when_already_judged(db):
    # Line 189: judge() returns immediately if the cup is no longer 'open'.
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("once")
        CupService(s, clock=FrozenClock(CUP_BASE)).enter(p.id, _cup_harvest(svc, p.id).id)
        # Auto-judge on read past the window.
        c1 = CupService(s, clock=FrozenClock(CUP_LATE)).current_cup()
        assert c1.status == "judged"
        # Direct re-judge of an already-judged cup is a no-op (returns it unchanged).
        svc2 = CupService(s, clock=FrozenClock(CUP_LATE))
        returned = svc2.judge(c1)
        assert returned.status == "judged"


def test_prize_for_tiers_cover_top_n_and_zero(db):
    # Lines 238-240: _prize_for ranks beyond 3rd — within top_n -> top_each,
    # beyond top_n -> 0.0.
    with session_scope() as s:
        cup = CupService(s, clock=FrozenClock(CUP_BASE))
        prizes = cup._cfg.get("prizes", {})
        assert cup._prize_for(4, prizes) == float(prizes["top_each"])   # line 238-239
        beyond = int(prizes.get("top_n", 10)) + 1
        assert cup._prize_for(beyond, prizes) == 0.0                    # line 240


def test_mint_champion_returns_none_without_genome(db):
    # Line 248: _mint_champion bails (None) when the source strain has no genome.
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("ghost")
        # Take a seeded strain and blank its genome -> mint must refuse (line 248).
        strain = s.query(Strain).filter(Strain.slug == "white-widow").one()
        strain.genome = {}
        s.flush()
        cup = CannabisCup(
            edition="2026-test", season="all", title="Test Cup", status="open",
            entry_fee=Decimal("0"), prize_pool=Decimal("0"),
            starts_at=CUP_BASE, ends_at=CUP_LATE,
        )
        s.add(cup)
        s.flush()
        # _mint_champion only reads entry.strain_id / entry.player_id, so an
        # unpersisted CupEntry is sufficient (avoids the harvest_id NOT NULL).
        entry = CupEntry(
            cup_id=cup.id, player_id=p.id,
            strain_id=strain.id, strain_name=strain.name, score=1.0,
            submitted_at=CUP_BASE,
        )
        svc_cup = CupService(s, clock=FrozenClock(CUP_BASE))
        assert svc_cup._mint_champion(cup, entry) is None


# ===========================================================================
# university_service.py — lines 65, 97-102, 150, 192, 197, 382
# ===========================================================================

def _uni_player(session, name="edge", level=2, grow=2000):
    svc = GameService(session)
    p = svc.create_player(name)
    need = 100 * level * (level - 1) // 2
    if need:
        leveling_service.award_xp(session, p.id, need)
    post(session, p.id, Decimal(str(grow)), LedgerEntryType.ADJUSTMENT)
    session.flush()
    return svc, p


def _uni_disabled_cfg():
    raw = copy.deepcopy(CFG.raw)
    raw["university"]["enabled"] = False
    return EconomyConfig(raw=raw)


def test_degree_effects_skips_unknown_degree_key(db):
    # Line 65: degree_effects() `continue`s over a DegreeProgress whose key is
    # absent from the curriculum.
    with session_scope() as s:
        svc, p = _uni_player(s, "phantomdeg")
        s.add(DegreeProgress(player_id=p.id, degree_key="nonexistent-degree"))
        s.flush()
        fx = degree_effects(s, p.id, CFG)
        # No perks applied; every effect stays at its 0.0 baseline.
        assert all(v == 0.0 for v in fx.values())


def test_course_effects_aggregates_and_skips_unknown(db):
    # Lines 97-102: course_effects() sums perks of completed courses (cult-101
    # grants quality_bonus) and `continue`s over an unknown completed course key.
    with session_scope() as s:
        svc, p = _uni_player(s, "courseperk")
        s.add(CourseEnrollment(
            player_id=p.id, course_key="cult-101", status="completed",
            started_at=UNI_BASE,
        ))
        s.add(CourseEnrollment(
            player_id=p.id, course_key="ghost-course-999", status="completed",
            started_at=UNI_BASE,
        ))
        s.flush()
        fx = course_effects(s, p.id, CFG)
        assert fx["quality_bonus"] == 1.0   # cult-101 perk applied (lines 100-102)


def test_enroll_when_university_closed_raises(db):
    # Line 150: enroll raises when the university feature is disabled in config.
    with session_scope() as s:
        svc, p = _uni_player(s, "closedout")
        uni = UniversityService(s, config=_uni_disabled_cfg(), clock=FrozenClock(UNI_BASE))
        with pytest.raises(GameError):
            uni.enroll(p.id, "cult-101")


def test_complete_unknown_course_raises(db):
    # Line 192: complete_course raises on a course key absent from curriculum.
    with session_scope() as s:
        svc, p = _uni_player(s, "compunknown")
        uni = UniversityService(s, clock=FrozenClock(UNI_BASE))
        with pytest.raises(GameError):
            uni.complete_course(p.id, "no-such-course-999")


def test_complete_already_completed_course_raises(db):
    # Line 197: completing a course already marked completed is rejected.
    with session_scope() as s:
        svc, p = _uni_player(s, "redo")
        s.add(CourseEnrollment(
            player_id=p.id, course_key="cult-101", status="completed",
            started_at=UNI_BASE, completed_at=UNI_BASE,
        ))
        s.flush()
        uni = UniversityService(s, clock=FrozenClock(UNI_LATER))
        with pytest.raises(GameError):
            uni.complete_course(p.id, "cult-101")


def test_practical_unknown_type_passes(db):
    # Line 382: _practical_met returns (True, "none") for an unrecognised type.
    with session_scope() as s:
        svc, p = _uni_player(s, "weirdpractical", level=1)
        uni = UniversityService(s)
        met, detail = uni._practical_met(p.id, {"type": "telekinesis"})
        assert met is True and detail == "none"
