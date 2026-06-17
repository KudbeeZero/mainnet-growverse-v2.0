"""Weather events shifting pod environment + feeding the sim."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import GrowPod
from growpodempire.services.game_service import GameService
from growpodempire.services.weather_service import WeatherService


def _pod(s, name="weatherman"):
    svc = GameService(s)
    p = svc.create_player(name)
    pod = svc.create_pod(p.id, "Tent", charge=False)
    pod.temperature = 24
    pod.humidity = 50
    pod.co2_level = 1000
    pod.light_intensity = 500
    pod.ph_level = 6.5
    s.flush()
    return p.id, pod


def test_forced_heatwave_raises_temperature(db):
    with session_scope() as s:
        pid, pod = _pod(s)
        result = WeatherService(s).roll(pid, pod.id, event="heatwave")
        assert result["event"] == "heatwave"
        assert s.get(GrowPod, pod.id).temperature == 31  # 24 + 7
        assert s.get(GrowPod, pod.id).humidity == 38      # 50 - 12


def test_random_roll_is_deterministic(db):
    with session_scope() as s:
        pid, pod = _pod(s, name="rng_a")
        e1 = WeatherService(s).roll(pid, pod.id, rng_seed=7)["event"]
    with session_scope() as s2:
        pid2, pod2 = _pod(s2, name="rng_b")
        e2 = WeatherService(s2).roll(pid2, pod2.id, rng_seed=7)["event"]
    assert e1 == e2


def test_clamps_keep_humidity_in_range(db):
    with session_scope() as s:
        pid, pod = _pod(s)
        pod.humidity = 90
        s.flush()
        WeatherService(s).roll(pid, pod.id, event="humidity_spike")  # +20 -> clamp 95
        assert s.get(GrowPod, pod.id).humidity == 95
