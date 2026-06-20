"""Global per-account "10× test" speed faucet.

Turbo is a per-ACCOUNT toggle: when ON, the player's effective simulation clock
runs `simulation.turbo_multiplier`× wall time so EVERY pod advances together; it
is banked (forward-only) so toggling OFF never rewinds; and it touches plant
biology only — never the economy ledger.
"""

import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.models import Strain, Player
from growpodempire.economy.ledger import balance
from growpodempire.services.game_service import GameService
from growpodempire.services.simulation_service import SimulationService
from growpodempire.simulation.clock import FrozenClock
from growpodempire.api.serialize import player_dict

BASE = datetime(2025, 1, 1, 0, 0, 0)
M = 10.0  # simulation.turbo_multiplier


def _player_two_pods(session, clock, username="turbofarmer"):
    """A player with two pods, each holding a fresh seedling pinned to BASE."""
    svc = GameService(session, clock=clock)
    p = svc.create_player(username)
    strain = session.query(Strain).filter(Strain.slug == "white-widow").one()
    plants = []
    for i in range(2):
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, f"Tent{i}", capacity=4, charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        for attr in ("last_tick_at", "stage_entered_at", "planted_at"):
            setattr(plant, attr, BASE)
        plants.append(plant)
    session.flush()
    return svc, p, plants


def test_turbo_accelerates_every_pod_by_the_multiplier(session):
    """One global toggle accelerates ALL of the account's pods at once: after one
    wall hour, every plant has advanced `M` hours."""
    fc = FrozenClock(BASE)
    svc, p, plants = _player_two_pods(session, fc)

    svc.set_turbo(p.id, True)            # anchor at BASE
    fc.set(BASE + timedelta(hours=1))    # one wall hour elapses
    sim = SimulationService(session, clock=fc)
    for plant in plants:
        sim.sync(plant)

    for plant in plants:                 # 10× across the whole account
        assert plant.last_tick_at == BASE + timedelta(hours=M)


def test_no_turbo_advances_at_wall_rate(session):
    """Control: with turbo OFF, one wall hour advances a plant exactly one hour."""
    fc = FrozenClock(BASE)
    _svc, _p, plants = _player_two_pods(session, fc)
    fc.set(BASE + timedelta(hours=1))
    SimulationService(session, clock=fc).sync(plants[0])
    assert plants[0].last_tick_at == BASE + timedelta(hours=1)


def test_turbo_is_banked_and_never_rewinds(session):
    """Toggling OFF banks the accrued acceleration (forward-only); afterwards the
    clock advances at wall rate again from the banked point — progress is kept."""
    fc = FrozenClock(BASE)
    svc, p, plants = _player_two_pods(session, fc)
    plant = plants[0]

    svc.set_turbo(p.id, True)            # anchor BASE
    fc.set(BASE + timedelta(hours=1))    # 1 wall hour at 10×  → +10h effective
    GameService(session, clock=fc).set_turbo(p.id, False)  # banks 9h, syncs pods

    player = session.get(Player, p.id)
    assert player.turbo_enabled is False
    assert player.turbo_anchor_at is None
    assert abs(player.turbo_offset_seconds - 9 * 3600) < 1
    assert plant.last_tick_at == BASE + timedelta(hours=10)  # caught up on toggle

    # A further wall hour with turbo OFF advances only ONE more hour (wall rate),
    # never rewinding the banked 10h.
    fc.set(BASE + timedelta(hours=2))
    SimulationService(session, clock=fc).sync(plant)
    assert plant.last_tick_at == BASE + timedelta(hours=11)


def test_turbo_toggle_posts_nothing_to_the_ledger(session):
    """Turbo accelerates biology, not currency: toggling it (and the resulting
    catch-up of non-harvest-ready plants) moves no money — no faucet."""
    fc = FrozenClock(BASE)
    svc, p, _plants = _player_two_pods(session, fc)
    before = balance(session, p.id)

    svc.set_turbo(p.id, True)
    fc.set(BASE + timedelta(hours=1))
    GameService(session, clock=fc).set_turbo(p.id, False)

    assert balance(session, p.id) == before


def test_set_turbo_reports_state_and_synced_pods(session):
    """The toggle returns account-truthful state and how many pods it caught up."""
    fc = FrozenClock(BASE)
    svc, p, plants = _player_two_pods(session, fc)
    state = svc.set_turbo(p.id, True)
    assert state["enabled"] is True
    assert state["multiplier"] == M
    assert state["synced_pods"] == len(plants)


def test_player_payload_reflects_turbo_state(session):
    """The serialized player carries the server-truth toggle (no client guessing)."""
    fc = FrozenClock(BASE)
    svc, p, _plants = _player_two_pods(session, fc)
    assert player_dict(session.get(Player, p.id))["turbo_enabled"] is False
    svc.set_turbo(p.id, True)
    assert player_dict(session.get(Player, p.id))["turbo_enabled"] is True


def test_forecast_eta_is_compressed_to_wall_time_under_turbo(session):
    """Under turbo the harvest ETA is expressed in WALL time, ~M× sooner, so a
    wall-clock countdown ticks down truthfully instead of pointing far away."""
    fc = FrozenClock(BASE)
    svc, p, plants = _player_two_pods(session, fc)
    plant = plants[0]

    svc.set_turbo(p.id, True)            # anchor BASE
    fc.set(BASE + timedelta(hours=1))    # wall ahead of anchor → turbo active
    fcst = SimulationService(session, clock=fc).forecast(plant)

    wall_now = fc.now()
    eta = datetime.fromisoformat(fcst["harvest_eta"])
    wall_hours = (eta - wall_now).total_seconds() / 3600.0
    # The wall countdown is ~M× shorter than the biological hours remaining.
    assert wall_hours < fcst["hours_to_harvest"]
    assert abs(wall_hours - fcst["hours_to_harvest"] / M) < 0.5


def test_forecast_eta_not_overcompressed_after_turbo_off(session):
    """Regression: once turbo is switched OFF the banked offset keeps eff_now
    ahead of wall, but time now advances at 1× — so the ETA must be re-anchored
    at the CURRENT rate (1×), NOT divided by the multiplier. A naive `/ M` would
    show the harvest countdown ~M× too soon, permanently (banked offset never
    clears)."""
    fc = FrozenClock(BASE)
    svc, p, plants = _player_two_pods(session, fc)
    plant = plants[0]

    svc.set_turbo(p.id, True)               # anchor BASE
    fc.set(BASE + timedelta(hours=1))       # bank ~9h of acceleration
    GameService(session, clock=fc).set_turbo(p.id, False)   # OFF, offset banked

    fcst = SimulationService(session, clock=fc).forecast(plant)
    assert not fcst["is_harvest_ready"]
    wall_now = fc.now()
    eta = datetime.fromisoformat(fcst["harvest_eta"])
    wall_hours = (eta - wall_now).total_seconds() / 3600.0
    # Rate is 1× now → wall countdown ≈ the biological hours remaining (NOT /M).
    assert abs(wall_hours - fcst["hours_to_harvest"]) < 0.5
