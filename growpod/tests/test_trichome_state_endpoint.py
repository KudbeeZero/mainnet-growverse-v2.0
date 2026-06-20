"""The plant /state payload includes deterministic trichome telemetry."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.models import Strain
from growpodempire.services.game_service import GameService
from growpodempire.services.simulation_service import SimulationService
from growpodempire.enums import GrowthStage


def _new_plant(session, stage=None, light=700):
    svc = GameService(session)
    p = svc.create_player("trichfarmer")
    strain = session.query(Strain).first()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    if stage:
        plant.growth_stage = stage
    pod.light_intensity = light
    session.flush()
    return plant


def test_trichomes_present_and_well_formed_in_flowering(session):
    plant = _new_plant(session, stage=GrowthStage.FLOWERING.value)
    tri = SimulationService(session).trichomes(plant)
    assert tri["active"] is True
    for k in ("density", "head_development", "clear_pct", "cloudy_pct", "amber_pct",
              "dominant", "harvest_window", "recommendation"):
        assert k in tri
    assert 0.0 <= tri["density"] <= 1.0
    assert tri["dominant"] in ("clear", "cloudy", "amber")


def test_trichomes_inactive_in_vegetative(session):
    plant = _new_plant(session)  # starts pre-flower
    tri = SimulationService(session).trichomes(plant)
    assert tri["active"] is False
    assert tri["density"] == 0.0
