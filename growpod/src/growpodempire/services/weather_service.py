"""
WeatherService — rolls a random weather event that shifts a pod's environment,
then re-syncs the pod's plants so the change feeds the grow simulation.

Deterministic given an injected RNG seed; events and magnitudes are configured
in data/balance.yaml (simulation.weather).
"""

import random
from typing import Optional

from sqlalchemy.orm import Session

from ..economy.config import get_economy_config, EconomyConfig
from ..db.models import GrowPod
from ..simulation.clock import Clock, SystemClock
from .game_service import GameError
from .simulation_service import SimulationService


class WeatherService:
    def __init__(
        self,
        session: Session,
        config: Optional[EconomyConfig] = None,
        clock: Optional[Clock] = None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        self.clock = clock or SystemClock()
        self._weather = self.cfg.raw.get("simulation", {}).get("weather", {})
        self._defaults = (
            self.cfg.raw.get("simulation", {}).get("environment", {}).get("defaults", {})
        )

    def roll(
        self,
        player_id: str,
        pod_id: str,
        event: Optional[str] = None,
        rng_seed: Optional[int] = None,
    ) -> dict:
        pod = self.session.get(GrowPod, pod_id)
        if pod is None or pod.player_id != player_id:
            raise GameError("Pod not found")

        events = self._weather.get("events", {})
        if not events:
            raise GameError("No weather events configured")

        if event is None:
            event = self._weighted_choice(events, random.Random(rng_seed))
        elif event not in events:
            raise GameError(f"Unknown weather event '{event}'")

        spec = events[event]
        new_env = self._apply(pod, spec)

        # Reuse the sim's environment setter (writes a reading + syncs plants).
        SimulationService(self.session, self.cfg, self.clock).set_environment(
            player_id, pod_id,
            new_env["temperature"], new_env["humidity"], new_env["co2_level"],
            new_env["light_intensity"], new_env["ph_level"],
        )
        return {"event": event, "environment": new_env}

    # ----- helpers --------------------------------------------------------
    def _weighted_choice(self, events: dict, rng: random.Random) -> str:
        names = list(events)
        weights = [float(events[n].get("weight", 1)) for n in names]
        return rng.choices(names, weights=weights, k=1)[0]

    def _current(self, pod: GrowPod) -> dict:
        return {
            "temperature": pod.temperature if pod.temperature is not None else self._defaults.get("temperature", 24),
            "humidity": pod.humidity if pod.humidity is not None else self._defaults.get("humidity", 50),
            "co2_level": pod.co2_level if pod.co2_level is not None else 1000,
            "light_intensity": pod.light_intensity if pod.light_intensity is not None else 500,
            "ph_level": pod.ph_level if pod.ph_level is not None else self._defaults.get("ph_level", 6.5),
        }

    def _apply(self, pod: GrowPod, spec: dict) -> dict:
        clamps = self._weather.get("clamps", {})
        env = self._current(pod)
        for key in list(env):
            if f"set_{key}" in spec:
                env[key] = float(spec[f"set_{key}"])
            elif key in spec:
                env[key] = env[key] + float(spec[key])
            # Each bound is applied independently (2026-07-05 audit): the prior
            # `if lo is not None: max(lo, min(hi, ...))` raised TypeError on a
            # one-sided [lo, null] clamp and silently no-opped on [null, hi].
            lo, hi = clamps.get(key, [None, None])
            if lo is not None:
                env[key] = max(lo, env[key])
            if hi is not None:
                env[key] = min(hi, env[key])
        return env
