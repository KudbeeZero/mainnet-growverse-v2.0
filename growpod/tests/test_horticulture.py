"""Phase A scientist-grade sim: VPD/DLI derivations + light wiring in the engine."""

import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import copy

from growpodempire.db.models import Strain
from growpodempire.economy.config import EconomyConfig, load_economy_config
from growpodempire.services.game_service import GameService
from growpodempire.simulation import engine, horticulture

from test_simulation import _plant, BASE  # reuse the existing single-plant helper

CFG = load_economy_config()


def _make_plant(session, username, light=500, slug="white-widow"):
    """Like test_simulation._plant but with a caller-chosen username + light, so
    several plants can coexist in one session (the shared helper pins one name)."""
    svc = GameService(session)
    p = svc.create_player(username)
    strain = session.query(Strain).filter(Strain.slug == slug).one()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    for attr in ("last_tick_at", "stage_entered_at", "planted_at"):
        setattr(plant, attr, BASE)
    pod.temperature, pod.humidity, pod.ph_level = 24, 50, 6.5
    pod.co2_level, pod.light_intensity = 1000, light
    session.flush()
    return plant


# ----- Pure derivations -------------------------------------------------------
def test_svp_matches_known_value():
    # Saturation vapour pressure at 20 C is ~2.34 kPa (Tetens).
    assert abs(horticulture.svp_kpa(20.0) - 2.338) < 0.02


def test_vpd_rises_as_humidity_falls():
    hot_dry = horticulture.vpd_kpa(26.0, 30.0)
    cool_damp = horticulture.vpd_kpa(26.0, 80.0)
    assert hot_dry > cool_damp > 0.0


def test_vpd_is_zero_at_saturation():
    # No leaf offset: at 100% RH the air is saturated -> VPD collapses to 0.
    assert horticulture.vpd_kpa(24.0, 100.0, leaf_offset_c=0.0) == 0.0


def test_dli_from_ppfd_and_photoperiod():
    # 500 PPFD * 18h -> 32.4 mol/m^2/day.
    assert abs(horticulture.dli(500, 18) - 32.4) < 1e-6


def test_optimal_env_has_no_vpd_or_light_stress():
    # The default test environment (24 C / 50% RH / 500 PPFD) sits in-band, so
    # the new terms add no health penalty — this is why existing tests stay green.
    sim = CFG.raw["simulation"]
    v_lo, v_hi = sim["vpd"]["optimal"]
    vpd = horticulture.vpd_kpa(24.0, 50.0, sim["vpd"]["leaf_offset_c"])
    assert v_lo <= vpd <= v_hi
    l_lo, l_hi = sim["light"]["optimal_ppfd"]
    assert l_lo <= 500 <= l_hi


# ----- Engine wiring ----------------------------------------------------------
def test_engine_now_reads_light(session):
    env = engine.environment_for(*_pod_env(session))
    assert "light" in env and env["light"] == 500


def test_darkness_lowers_health_versus_good_light(session):
    """A pod left dark must end up less healthy than one with adequate light.

    Pests are the only stochastic term and are seeded per plant-id, so disable
    them to isolate the light effect (same approach as the pro-pod sim test).
    """
    raw = copy.deepcopy(CFG.raw)
    raw["simulation"]["pests"]["base_spawn_chance_per_hour"] = 0.0
    calm = EconomyConfig(raw=raw)

    bright = _make_plant(session, "bright_grower", light=500)
    dark = _make_plant(session, "dark_grower", light=0)
    engine.catch_up(session, bright, BASE + timedelta(days=7), calm)
    engine.catch_up(session, dark, BASE + timedelta(days=7), calm)
    assert dark.health < bright.health


def test_metrics_exposes_vpd_and_dli(session):
    from growpodempire.services.simulation_service import SimulationService
    _, _, plant = _plant(session)
    m = SimulationService(session).metrics(plant)
    assert m["vpd_kpa"] > 0 and m["dli_mol"] > 0 and m["ppfd"] == 500


# ----- helpers ----------------------------------------------------------------
def _pod_env(session):
    _, pod, plant = _plant(session)
    return plant, pod, CFG.raw["simulation"]
