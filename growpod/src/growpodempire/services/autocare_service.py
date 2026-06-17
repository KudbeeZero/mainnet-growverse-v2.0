"""
AutoCareService — drives the agentic auto-care loop (Phase 3b).

It binds the SimulationService care actions to a single plant behind a
SpendGuard (GROW budget + action cap), builds a compact context, and hands them
to an AutoCareProvider (real Claude tool runner or the offline mock rule loop).
Every executed tool goes through the normal ledger-posting care path, so the
loop is server-authoritative and can never spend beyond the cap.
"""

from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from ..economy.config import get_economy_config, EconomyConfig
from ..simulation.clock import Clock, SystemClock
from ..ai.autocare import AutoCareBudget, ActionRecord, AutoCareProvider
from ..ai.factory import get_auto_care_provider
from .game_service import GameError
from .simulation_service import SimulationService


class _SpendGuard:
    def __init__(self, max_grow: float, max_actions: int):
        self.max_grow = float(max_grow)
        self.max_actions = int(max_actions)
        self.spent = 0.0
        self.records: List[ActionRecord] = []

    @property
    def count(self) -> int:
        return len(self.records)

    def can_act(self) -> bool:
        return self.count < self.max_actions

    def can_afford(self, cost: float) -> bool:
        return self.spent + cost <= self.max_grow + 1e-9

    def record(self, rec: ActionRecord) -> ActionRecord:
        self.records.append(rec)
        self.spent += rec.cost
        return rec


class _CareTools:
    """Budget-guarded care tools bound to one plant (implements CareTools)."""

    def __init__(self, sim: SimulationService, player_id: str, plant, guard: _SpendGuard):
        self.sim = sim
        self.player_id = player_id
        self.plant = plant
        self.guard = guard

    def snapshot(self) -> dict:
        p = self.plant
        return {
            "growth_stage": p.growth_stage,
            "health": round(p.health, 1),
            "water_level": round(p.water_level, 1),
            "nutrient_level": round(p.nutrient_level, 1),
            "pest_level": round(p.pest_level, 1),
            "disease_level": round(p.disease_level, 1),
        }

    def remaining_budget(self) -> float:
        return round(self.guard.max_grow - self.guard.spent, 6)

    def actions_remaining(self) -> int:
        return self.guard.max_actions - self.guard.count

    def _cost(self, base) -> float:
        return float(self.sim._care_cost(self.player_id, base))

    def _gate(self, action: str, cost: float):
        if not self.guard.can_act():
            return ActionRecord(action, ok=False, detail="action cap reached")
        if cost > 0 and not self.guard.can_afford(cost):
            return ActionRecord(
                action, ok=False,
                detail=f"budget cap reached (needs {cost:g}, {self.remaining_budget():g} left)",
            )
        return None

    def water(self, amount: Optional[float] = None) -> ActionRecord:
        blocked = self._gate("water", 0.0)
        if blocked:
            return blocked
        self.sim.water(self.player_id, self.plant.id, amount=amount)
        return self.guard.record(
            ActionRecord("water", ok=True, cost=0.0, detail=f"water_level now {self.plant.water_level:.0f}")
        )

    def feed(self) -> ActionRecord:
        cost = self._cost(self.sim.cfg.nutrients_cost)
        blocked = self._gate("feed", cost)
        if blocked:
            return blocked
        self.sim.feed(self.player_id, self.plant.id)
        return self.guard.record(
            ActionRecord("feed", ok=True, cost=cost, detail=f"nutrient_level now {self.plant.nutrient_level:.0f}")
        )

    def treat_pests(self) -> ActionRecord:
        if self.plant.pest_level <= 0:
            return ActionRecord("treat_pests", ok=True, cost=0.0, detail="no pests present")
        cost = self._cost(self.sim.cfg.pest_treatment_cost)
        blocked = self._gate("treat_pests", cost)
        if blocked:
            return blocked
        self.sim.treat_pests(self.player_id, self.plant.id)
        return self.guard.record(
            ActionRecord("treat_pests", ok=True, cost=cost, detail="pests cleared")
        )

    def treat_disease(self) -> ActionRecord:
        if self.plant.disease_level <= 0:
            return ActionRecord("treat_disease", ok=True, cost=0.0, detail="no disease present")
        cost = self._cost(self.sim.cfg.disease_treatment_cost)
        blocked = self._gate("treat_disease", cost)
        if blocked:
            return blocked
        self.sim.treat_disease(self.player_id, self.plant.id)
        return self.guard.record(
            ActionRecord("treat_disease", ok=True, cost=cost, detail="disease cleared")
        )


class AutoCareService:
    def __init__(
        self,
        session: Session,
        provider: Optional[AutoCareProvider] = None,
        config: Optional[EconomyConfig] = None,
        clock: Optional[Clock] = None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        self.clock = clock or SystemClock()
        self.sim = SimulationService(session, config=self.cfg, clock=self.clock)
        self.provider = provider or get_auto_care_provider()

    def run(
        self,
        player_id: str,
        plant_id: str,
        budget: Optional[float] = None,
        max_actions: Optional[int] = None,
    ) -> dict:
        ac = self.cfg.auto_care
        max_budget = float(ac.get("max_budget", 1000))
        default_budget = float(ac.get("default_budget", 200))
        cap_actions = int(ac.get("max_actions", 8))

        max_grow = min(float(budget) if budget is not None else default_budget, max_budget)
        if max_grow <= 0:
            raise GameError("budget must be positive")
        n_actions = min(int(max_actions) if max_actions is not None else cap_actions, cap_actions)

        plant = self.sim.get_state(player_id, plant_id)  # ownership check + catch-up
        self.sim._require_living(plant)

        guard = _SpendGuard(max_grow, n_actions)
        tools = _CareTools(self.sim, player_id, plant, guard)
        context = {
            "plant": tools.snapshot(),
            "budget": {"max_grow": max_grow, "max_actions": n_actions},
        }
        message = self.provider.run(context, tools, AutoCareBudget(max_grow, n_actions))

        return {
            "provider": self.provider.name(),
            "message": message,
            "actions": [rec.__dict__ for rec in guard.records],
            "spent": round(guard.spent, 6),
            "plant": plant,  # serialized by the route
        }
