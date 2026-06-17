"""
AdvisorService — assembles a plant's live state and asks the AI advisor for a
diagnosis + care recommendations.

It reuses SimulationService.get_state (which runs the engine catch-up first, so
the advisor sees the plant exactly as it is "now"), then hands a compact context
dict to the configured AdvisorProvider (real Claude or the offline mock). The
advisor is advisory only — it never mutates game state.
"""

from typing import Optional

from sqlalchemy.orm import Session

from ..economy.config import get_economy_config, EconomyConfig
from ..simulation.clock import Clock, SystemClock
from ..db.models import GrowPod
from ..ai.provider import AdvisorProvider, AdvisorReport
from ..ai.factory import shared_advisor
from .game_service import GameError
from .simulation_service import SimulationService

# Genome traits worth surfacing to the advisor (kept compact for prompt economy).
_GENOME_KEYS = (
    "thc", "cbd", "indica_ratio", "flowering_time",
    "disease_resistance", "pest_resistance", "vigor",
    "myrcene", "limonene", "caryophyllene", "pinene",
)


class AdvisorService:
    def __init__(
        self,
        session: Session,
        provider: Optional[AdvisorProvider] = None,
        config: Optional[EconomyConfig] = None,
        clock: Optional[Clock] = None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        self.clock = clock or SystemClock()
        self.sim = SimulationService(session, config=self.cfg, clock=self.clock)
        self.provider = provider or shared_advisor()

    def _genome_summary(self, genome: dict) -> dict:
        out = {}
        for key in _GENOME_KEYS:
            gene = (genome or {}).get(key)
            if gene is not None:
                out[key] = round(float(gene["value"]), 3)
        return out

    def _research_context(self, player_id: str) -> dict:
        """Unlocked upgrades + the cheapest currently-available next ones, so the
        advisor can coach the player's progression, not just the plant."""
        from .research_service import ResearchService
        tree = ResearchService(self.session, config=self.cfg).list_tree(player_id)
        unlocked = [n["name"] for n in tree if n["unlocked"]]
        # Reachable next steps: prerequisites met and not yet unlocked. Cheapest
        # first, so the advisor can coach even a new player toward their first
        # upgrade (noting the level gate where relevant).
        candidates = sorted(
            (n for n in tree if n["prereqs_met"] and not n["unlocked"]),
            key=lambda n: n["cost"],
        )
        recommended = [
            {"key": n["key"], "name": n["name"], "cost": n["cost"],
             "effect": n["description"], "level_req": n["level_req"],
             "ready": n["available"]}
            for n in candidates[:3]
        ]
        return {"unlocked": unlocked, "recommended_next": recommended}

    def build_context(self, player_id: str, plant_id: str) -> dict:
        plant = self.sim.get_state(player_id, plant_id)  # runs catch-up
        pod = self.session.get(GrowPod, plant.pod_id)
        events = self.sim.get_events(plant_id, limit=10)

        return {
            "research": self._research_context(player_id),
            "plant": {
                "growth_stage": plant.growth_stage,
                "height_cm": round(plant.height, 1),
                "health": round(plant.health, 1),
                "water_level": round(plant.water_level, 1),
                "nutrient_level": round(plant.nutrient_level, 1),
                "pest_level": round(plant.pest_level, 1),
                "disease_level": round(plant.disease_level, 1),
                "is_alive": plant.is_alive,
                "harvested": plant.harvested,
                "condition_flags": plant.condition_flags or [],
            },
            "genome": self._genome_summary(plant.genome),
            "environment": {
                "temperature": pod.temperature if pod else None,
                "humidity": pod.humidity if pod else None,
                "ph_level": pod.ph_level if pod else None,
                "pod_tier": pod.tier if pod else None,
            },
            "recent_events": [
                {"type": e.event_type, "severity": e.severity} for e in events
            ],
        }

    def advise(self, player_id: str, plant_id: str) -> AdvisorReport:
        context = self.build_context(player_id, plant_id)
        return self.provider.diagnose(context)
