"""TrichomeResinGland telemetry read-model: ripeness, density, harvest window."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.simulation.engines.flowers import trichome_resin_gland as trg
from growpodempire.economy.config import load_economy_config

SIM = load_economy_config().raw.get("simulation", {})
GEN = {"trichome_density": 0.8, "amber_bias": 0.2}


def _tel(stage, pct, health=100.0, light=600.0, gen=GEN):
    return trg.telemetry(stage, pct, health, light, gen, SIM)


def test_inactive_before_flowering():
    for stage in ("seed", "germination", "seedling", "vegetative"):
        out = _tel(stage, 50.0)
        assert out["active"] is False
        assert out["density"] == 0.0
        assert out["harvest_window"] == "not_flowering"


def test_ripeness_progresses_clear_to_amber():
    early = _tel("flowering", 5.0)
    mid = _tel("late_flower", 30.0)
    late = _tel("harvest", 100.0)
    # Clear falls, amber rises across the lifecycle.
    assert early["clear_pct"] > mid["clear_pct"] > late["clear_pct"]
    assert late["amber_pct"] > mid["amber_pct"] >= early["amber_pct"]
    assert early["dominant"] == "clear"


def test_percentages_sum_to_about_100():
    out = _tel("late_flower", 60.0)
    total = out["clear_pct"] + out["cloudy_pct"] + out["amber_pct"]
    assert abs(total - 100.0) < 0.2


def test_density_rises_through_flowering():
    a = _tel("flowering", 10.0)["density"]
    b = _tel("late_flower", 80.0)["density"]
    assert b > a > 0.0


def test_more_light_more_frost():
    lo = _tel("late_flower", 50.0, light=300.0)["density"]
    hi = _tel("late_flower", 50.0, light=1000.0)["density"]
    assert hi > lo


def test_amber_bias_pushes_amber_up():
    base = trg.telemetry("harvest", 100.0, 100.0, 600.0, {"trichome_density": 0.8, "amber_bias": 0.0}, SIM)
    biased = trg.telemetry("harvest", 100.0, 100.0, 600.0, {"trichome_density": 0.8, "amber_bias": 1.0}, SIM)
    assert biased["amber_pct"] > base["amber_pct"]


def test_harvest_window_transitions():
    assert _tel("flowering", 2.0)["harvest_window"] in ("developing", "early")
    # A mid/late plant should report a real window, peaking before ambering.
    windows = {_tel("flowering", p)["harvest_window"] for p in (40.0, 80.0)}
    windows |= {_tel("late_flower", p)["harvest_window"] for p in (40.0, 90.0)}
    assert "peak" in windows or "ripe" in windows


def test_deterministic():
    assert _tel("late_flower", 55.0) == _tel("late_flower", 55.0)


def test_genetics_from_genes_tracks_thc_and_vigor():
    weak = trg.genetics_from_genes(thc=10.0, vigor=0.3, indica_ratio=0.2)
    strong = trg.genetics_from_genes(thc=30.0, vigor=0.9, indica_ratio=0.9)
    assert strong["trichome_density"] > weak["trichome_density"]
    assert strong["amber_bias"] > weak["amber_bias"]
