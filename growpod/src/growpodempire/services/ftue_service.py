"""First-Time-User-Experience orchestration — a deterministic guided tutorial
that walks a brand-new player through the core loop on EXISTING rails:

    welcome → plant → water → environment → grow → harvest → completed

Signup already grants a Starter Pod + seed (GameService.grant_starter_items); this
service drives the player through using them. It is pure orchestration: every step
calls a real game/sim action — no new economy, no Phase-2 systems. The "grow" step
is a tutorial-only time-compression so the player reaches their first harvest in
seconds instead of days. Step progress lives on Player.ftue_step; each advance is
guarded against replay/out-of-sync.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from ..ai.ftue_coach import coach_for_step
from ..ai.provider import AdvisorReport
from ..economy.config import EconomyConfig, get_economy_config
from ..enums import GrowthStage
from ..simulation.clock import Clock, SystemClock
from ..db.models import Player, GrowPod, SeedInventory, Plant
from .game_service import GameService, GameError
from .simulation_service import SimulationService

# The ordered tutorial steps and the next-step transitions.
STEPS = ["welcome", "plant", "water", "environment", "grow", "harvest", "completed"]
_NEXT = dict(zip(STEPS, STEPS[1:]))

# Nominal seed→harvest window (balance.yaml growth stages + a typical flowering
# span) used only to backdate the tutorial plant for the compressed "grow" step.
_FULL_CYCLE_DAYS = 44 + 60

# A healthy climate squarely in the optimal bands (mirrors the chamber defaults).
_GOOD_ENV = dict(temperature=24.0, humidity=50.0, co2_level=900.0, light_intensity=600.0, ph_level=6.5)


class FTUEService:
    def __init__(
        self,
        session: Session,
        config: Optional[EconomyConfig] = None,
        clock: Optional[Clock] = None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        self.clock = clock or SystemClock()

    # ----- reads ----------------------------------------------------------
    def get_status(self, player_id: str) -> dict:
        player = self._player(player_id)
        return {
            "step": player.ftue_step,
            "plant_id": player.ftue_plant_id,
            "completed": player.ftue_step == "completed",
            "completed_at": player.ftue_completed_at.isoformat() if player.ftue_completed_at else None,
        }

    def get_coaching(self, player_id: str, step: str) -> AdvisorReport:
        """The Master Grower's scripted line for a step (deterministic; no live AI)."""
        self._player(player_id)  # 404 if the player doesn't exist
        return coach_for_step(step)

    # ----- the state machine ---------------------------------------------
    def advance(self, player_id: str, current_step: str) -> dict:
        """Complete `current_step` (performing its real game action) and move to the
        next. Guarded so a stale/replayed request can't double-apply a step."""
        player = self._player(player_id)
        if player.ftue_step == "completed":
            raise GameError("Tutorial already completed")
        if current_step != player.ftue_step:
            raise GameError(
                f"FTUE out of sync: you're on '{player.ftue_step}', not '{current_step}'"
            )

        game = GameService(self.session, config=self.cfg, clock=self.clock)
        if current_step == "plant":
            self._do_plant(player, game)
        elif current_step == "water":
            self._do_water(player)
        elif current_step == "environment":
            self._do_environment(player)
        elif current_step == "grow":
            self._do_grow(player)
        elif current_step == "harvest":
            self._do_harvest(player, game)
        # "welcome" is purely narrative — no action.

        player.ftue_step = _NEXT[current_step]
        if player.ftue_step == "completed":
            player.ftue_completed_at = self.clock.now()
        self.session.flush()
        return self.get_status(player_id)

    # ----- step actions ---------------------------------------------------
    def _do_plant(self, player: Player, game: GameService) -> None:
        pod = (
            self.session.query(GrowPod)
            .filter(GrowPod.player_id == player.id)
            .order_by(GrowPod.created_at.asc())
            .first()
        )
        stack = (
            self.session.query(SeedInventory)
            .filter(SeedInventory.player_id == player.id, SeedInventory.quantity > 0)
            .order_by(SeedInventory.created_at.asc())
            .first()
        )
        if pod is None or stack is None:
            raise GameError("Starter pod or seed missing — cannot start the tutorial")
        plant = game.plant_seed(player.id, stack.id, pod.id)
        player.ftue_plant_id = plant.id

    def _do_water(self, player: Player) -> None:
        plant = self._ftue_plant(player)
        SimulationService(self.session, config=self.cfg, clock=self.clock).water(
            player.id, plant.id
        )

    def _do_environment(self, player: Player) -> None:
        plant = self._ftue_plant(player)
        SimulationService(self.session, config=self.cfg, clock=self.clock).set_environment(
            player.id, plant.pod_id, **_GOOD_ENV
        )

    def _do_grow(self, player: Player) -> None:
        """Tutorial-only time compression: present a mature, harvest-ready plant
        without retro-decaying it. Backdating `planted_at` makes the chamber render
        a flowering plant; setting `last_tick_at = now` means the authoritative
        catch-up does nothing (no simulated drought/death over the skipped span),
        so the well-tended plant keeps its health for a rewarding first harvest.
        Scoped to the single tutorial plant — global sim/time is untouched."""
        plant = self._ftue_plant(player)
        now = self.clock.now()
        plant.planted_at = now - timedelta(days=_FULL_CYCLE_DAYS)
        plant.stage_entered_at = now - timedelta(days=2)
        plant.last_tick_at = now
        plant.growth_stage = GrowthStage.FLOWERING.value

    def _do_harvest(self, player: Player, game: GameService) -> None:
        plant = self._ftue_plant(player)
        # Harvest & sell in one action — mirrors the real "Harvest & Sell" button.
        # weight/quality default from the plant's (healthy) state.
        game.harvest_plant(player.id, plant.id, sell=True)

    # ----- helpers --------------------------------------------------------
    def _player(self, player_id: str) -> Player:
        player = self.session.get(Player, player_id)
        if player is None:
            raise GameError(f"Player {player_id} not found")
        return player

    def _ftue_plant(self, player: Player) -> Plant:
        if not player.ftue_plant_id:
            raise GameError("No tutorial plant yet — plant your starter seed first")
        plant = self.session.get(Plant, player.ftue_plant_id)
        if plant is None:
            raise GameError("Tutorial plant not found")
        return plant
