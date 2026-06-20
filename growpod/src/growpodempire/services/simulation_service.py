"""
SimulationService — runs the real-time engine on reads and applies player care
actions (water, feed, treat pests/disease, set environment).

Every action first brings the plant up to date via the engine's catch-up, then
applies its effect and logs an event. Costed actions go through the economy
ledger.
"""

from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from ..economy.config import get_economy_config, EconomyConfig
from ..economy.ledger import post, to_money
from ..enums import LedgerEntryType
from datetime import datetime, timedelta

from ..db.models import (
    Plant, GrowPod, Player, PlantEvent, EnvironmentReading, ConsumableInventory,
)
from ..simulation import engine
from ..simulation.clock import Clock, active_clock, player_clock
from .game_service import GameError


class SimulationService:
    def __init__(
        self,
        session: Session,
        config: Optional[EconomyConfig] = None,
        clock: Optional[Clock] = None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        # Default to the active clock: plain wall time, or the shared test clock
        # when it is enabled (dev/test only). Explicit injection (tests, other
        # services) always wins.
        self.clock = clock or active_clock()

    @property
    def _sim(self) -> dict:
        return self.cfg.raw.get("simulation", {})

    @property
    def _turbo_multiplier(self) -> float:
        return float(self._sim.get("turbo_multiplier", 10.0))

    def _player_clock(self, player_id: str):
        """``(effective_now, rate)`` for the player — wall time accelerated by the
        per-account turbo faucet. ``rate`` is the live speed (multiplier while ON,
        else 1.0). All of a player's plant reads MUST go through this so every pod
        advances on the same clock. Falls back to wall time when turbo never ran."""
        player = self.session.get(Player, player_id)
        wall = self.clock.now()
        if player is None:
            return wall, 1.0
        return player_clock(wall, player, self._turbo_multiplier)

    def _get_plant(self, player_id: str, plant_id: str) -> Plant:
        plant = self.session.get(Plant, plant_id)
        if plant is None or plant.player_id != player_id:
            raise GameError("Plant not found")
        return plant

    def _research(self, player_id: str) -> dict:
        from .research_service import research_effects
        from .university_service import degree_effects
        fx = research_effects(self.session, player_id, self.cfg)
        for k, v in degree_effects(self.session, player_id, self.cfg).items():
            fx[k] = fx.get(k, 0.0) + v
        return fx

    def _care_cost(self, player_id: str, base) -> Decimal:
        """A care cost after applying any care-discount research."""
        disc = min(0.9, self._research(player_id).get("care_discount_pct", 0.0))
        return to_money(Decimal(str(base)) * Decimal(str(1.0 - disc)))

    def sync(self, plant: Plant) -> List[PlantEvent]:
        """Advance the plant to the current time (accelerated by the owner's
        turbo faucet when engaged)."""
        eff_now, _rate = self._player_clock(plant.player_id)
        return engine.catch_up(self.session, plant, eff_now, self.cfg)

    def get_state(self, player_id: str, plant_id: str):
        plant = self._get_plant(player_id, plant_id)
        self.sync(plant)
        return plant

    def trichomes(self, plant: Plant) -> dict:
        """Read-only TrichomeResinGland telemetry for the plant's `/state`: frost
        density, head development, and the clear→cloudy→amber ripeness mix +
        harvest-window recommendation. Deterministic; mirrors the frontend
        maturity model. TELEMETRY ONLY — never feeds the engine tick or economy.
        """
        from ..simulation.engines.flowers import trichome_resin_gland as trg
        eff_now, _rate = self._player_clock(plant.player_id)
        fc = engine.stage_forecast(plant, self.cfg, eff_now)
        pod = self.session.get(GrowPod, plant.pod_id)
        env = engine.environment_for(plant, pod, self._sim)
        genetics = trg.genetics_from_genes(
            engine._gene(plant, "thc", 18.0),
            engine._gene(plant, "vigor", 0.5),
            engine._gene(plant, "indica_ratio", 0.5),
        )
        return trg.telemetry(
            plant.growth_stage, fc.get("stage_progress_pct", 0.0),
            plant.health, env.get("light", 600.0), genetics, self._sim,
            water=plant.water_level, nutrient=plant.nutrient_level,
        )

    def metrics(self, plant: Plant) -> dict:
        """Scientist-grade derived readouts (VPD, DLI, PPFD) for a plant's pod,
        plus the display-only nutrient PPM and the current stage's target bands.

        The PPM value and stage targets are DISPLAY ONLY — derived from the
        existing 0..100 nutrient scalar and read from balance.yaml; they are
        never fed back into the engine tick (see the constraint documented in
        balance.yaml `simulation.nutrient`)."""
        from ..simulation import horticulture
        pod = self.session.get(GrowPod, plant.pod_id)
        env = engine.environment_for(plant, pod, self._sim)
        out = horticulture.derived_metrics(env, self._sim)
        # Display-only nutrient readouts for the University Grow Console: a
        # grower-facing PPM (scaled from the 0..100 scalar) and the PPM target
        # window for the plant's current growth stage (None outside the fed
        # stages, e.g. seed / germination / harvest).
        ncfg = self._sim.get("nutrient", {})
        scale = ncfg.get("ppm_display_scale", 12.0)
        out["nutrient_ppm"] = round((plant.nutrient_level or 0.0) * scale, 0)
        out["stage_targets"] = ncfg.get("stage_targets", {}).get(plant.growth_stage)
        return out

    def forecast(self, plant: Plant) -> dict:
        """Lifecycle forecast: current stage, progress, and ETAs to the next stage
        and harvest-readiness (at current health). Powers the player-facing
        stage timeline + countdown.

        Computed on the owner's effective (turbo) clock so progress is consistent
        with the persisted timestamps, then the ETA timestamps are expressed back
        in WALL time at the clock's CURRENT rate: while turbo is engaged the plant
        consumes its remaining grow hours `rate`× faster (shorter countdown); once
        turbo is switched OFF the rate drops to 1 and re-anchoring simply strips
        the banked offset so the countdown reflects true wall time again (no longer
        compressed) instead of pointing far into the future."""
        eff_now, rate = self._player_clock(plant.player_id)
        fc = engine.stage_forecast(plant, self.cfg, eff_now)

        wall = self.clock.now()
        # Re-anchor absolute ETAs to wall time whenever the effective clock is
        # ahead of wall (turbo on, or a banked offset from a past run). Divide the
        # remaining grow hours by the CURRENT rate — multiplier while ON, else 1 —
        # NOT by the static multiplier, so a banked-but-OFF faucet isn't
        # over-compressed (the bug a naive `/ multiplier` would cause).
        if eff_now > wall and not fc.get("is_harvest_ready"):
            hth = fc.get("hours_to_harvest")
            if hth is not None and fc.get("harvest_eta") is not None:
                fc["harvest_eta"] = (wall + timedelta(hours=hth / rate)).isoformat()
            # remaining-in-stage = effective stage length × (1 − progress)
            total = fc.get("stage_total_hours") or 0.0
            rem = max(0.0, total * (1.0 - (fc.get("stage_progress_pct") or 0.0) / 100.0))
            if fc.get("next_stage_eta") is not None:
                fc["next_stage_eta"] = (wall + timedelta(hours=rem / rate)).isoformat()
        return fc

    def get_events(self, plant_id: str, limit: int = 50) -> List[PlantEvent]:
        return (
            self.session.query(PlantEvent)
            .filter(PlantEvent.plant_id == plant_id)
            .order_by(PlantEvent.timestamp.desc())
            .limit(limit)
            .all()
        )

    # ----- Care actions ---------------------------------------------------
    def water(self, player_id: str, plant_id: str, amount: Optional[float] = None) -> Plant:
        plant = self._get_plant(player_id, plant_id)
        self._require_living(plant)
        self.sync(plant)
        amount = amount if amount is not None else self._sim.get("actions", {}).get("water_amount", 35)
        plant.water_level = min(100.0, plant.water_level + amount)
        self._log(plant, "watered", payload={"amount": amount})
        return plant

    def feed(self, player_id: str, plant_id: str, amount: Optional[float] = None) -> Plant:
        plant = self._get_plant(player_id, plant_id)
        self._require_living(plant)
        self.sync(plant)
        post(
            self.session, player_id, -self._care_cost(player_id, self.cfg.nutrients_cost),
            LedgerEntryType.NUTRIENT_PURCHASE, ref_type="plant", ref_id=plant_id,
        )
        amount = amount if amount is not None else self._sim.get("actions", {}).get("feed_amount", 30)
        plant.nutrient_level = min(100.0, plant.nutrient_level + amount)
        self._log(plant, "fed", payload={"amount": amount})
        return plant

    def treat_pests(self, player_id: str, plant_id: str) -> Plant:
        plant = self._get_plant(player_id, plant_id)
        self._require_living(plant)
        self.sync(plant)
        post(
            self.session, player_id, -self._care_cost(player_id, self.cfg.pest_treatment_cost),
            LedgerEntryType.PEST_TREATMENT, ref_type="plant", ref_id=plant_id,
        )
        cleared = plant.pest_level
        plant.pest_level = 0.0
        plant.condition_flags = engine.reactions.compute_conditions(plant, self._sim)
        self._log(plant, "pest_treated", payload={"cleared": cleared})
        return plant

    def treat_disease(self, player_id: str, plant_id: str) -> Plant:
        plant = self._get_plant(player_id, plant_id)
        self._require_living(plant)
        self.sync(plant)
        post(
            self.session, player_id, -self._care_cost(player_id, self.cfg.disease_treatment_cost),
            LedgerEntryType.DISEASE_TREATMENT, ref_type="plant", ref_id=plant_id,
        )
        cleared = plant.disease_level
        plant.disease_level = 0.0
        plant.condition_flags = engine.reactions.compute_conditions(plant, self._sim)
        self._log(plant, "disease_treated", payload={"cleared": cleared})
        return plant

    # ----- Free "care tool" actions (no ledger spend) --------------------
    def prune(self, player_id: str, plant_id: str) -> Plant:
        """Free tidy-up: trims pests/disease and nudges health. Once per stage."""
        plant = self._get_plant(player_id, plant_id)
        self._require_living(plant)
        self.sync(plant)
        if self._last_event_stage(plant, "pruned") == plant.growth_stage:
            raise GameError("Already pruned this stage — let it recover first.")
        cfg = self._sim.get("actions", {}).get("prune", {})
        pest_reduction = cfg.get("pest_reduction", 15)
        disease_reduction = cfg.get("disease_reduction", 10)
        health_add = cfg.get("health_add", 2)
        plant.pest_level = max(0.0, plant.pest_level - pest_reduction)
        plant.disease_level = max(0.0, plant.disease_level - disease_reduction)
        plant.health = min(100.0, plant.health + health_add)
        plant.condition_flags = engine.reactions.compute_conditions(plant, self._sim)
        self._log(plant, "pruned", payload={"stage": plant.growth_stage})
        return plant

    def train(self, player_id: str, plant_id: str) -> Plant:
        """Free low-stress training: gentle health bump + small pest relief. Once per stage."""
        plant = self._get_plant(player_id, plant_id)
        self._require_living(plant)
        self.sync(plant)
        if self._last_event_stage(plant, "trained") == plant.growth_stage:
            raise GameError("Already trained this stage.")
        cfg = self._sim.get("actions", {}).get("train", {})
        health_add = cfg.get("health_add", 3)
        pest_reduction = cfg.get("pest_reduction", 5)
        plant.health = min(100.0, plant.health + health_add)
        plant.pest_level = max(0.0, plant.pest_level - pest_reduction)
        plant.condition_flags = engine.reactions.compute_conditions(plant, self._sim)
        self._log(plant, "trained", payload={"stage": plant.growth_stage})
        return plant

    def boost(self, player_id: str, plant_id: str) -> Plant:
        """Free top-up: floors water/nutrients and a small health bump. On a cooldown."""
        plant = self._get_plant(player_id, plant_id)
        self._require_living(plant)
        self.sync(plant)
        cfg = self._sim.get("actions", {}).get("boost", {})
        cooldown_hours = cfg.get("cooldown_hours", 6)
        since = self._hours_since_last_event(plant, "boosted")
        if since is not None and since < cooldown_hours:
            raise GameError("Boost is recharging — try again later.")
        water_floor = cfg.get("water_floor", 80)
        nutrient_floor = cfg.get("nutrient_floor", 80)
        health_add = cfg.get("health_add", 4)
        plant.water_level = max(plant.water_level, water_floor)
        plant.nutrient_level = max(plant.nutrient_level, nutrient_floor)
        plant.health = min(100.0, plant.health + health_add)
        plant.condition_flags = engine.reactions.compute_conditions(plant, self._sim)
        self._log(plant, "boosted", payload={})
        return plant

    def apply_growth_boost(self, player_id: str, plant_id: str) -> Plant:
        """Purchasable growth boost: spend in-game GROW to fast-forward the plant a
        few grow-hours AND revive a struggling one. Tops water/nutrients to a floor,
        lifts health to a floor (so a plant that fell too far can recover — the
        "it's hard to bring it back" pain point), then advances the lifecycle by
        ``advance_hours`` immediately. On a cooldown so it stays a boost.

        NOTE (real-money attach point): this is the SIMULATED purchase. The GROW
        sink (LedgerEntryType.GROWTH_BOOST) and the effect below are LIVE now so
        the boost is fully playable/testable against the in-game soft currency. A
        real-money checkout (e.g. card/crypto → grant GROW or apply the boost
        directly) is NOT wired yet; when it is, add the payment route in the API
        layer and call into this same method (or a thin wrapper) so the effect and
        the cooldown/ledger accounting stay identical. Keep gameplay truth in the
        DB ledger; never let an external payment provider drive plant state
        directly. See balance.yaml `simulation.actions.growth_boost` for tuning.
        """
        plant = self._get_plant(player_id, plant_id)
        self._require_living(plant)
        self.sync(plant)

        cfg = self._sim.get("actions", {}).get("growth_boost", {})
        cooldown_hours = cfg.get("cooldown_hours", 8)
        since = self._hours_since_last_event(plant, "growth_boosted")
        if since is not None and since < cooldown_hours:
            raise GameError("Growth boost is recharging — try again later.")

        # Charge first (after the cooldown gate): a failed/overdrawn payment must
        # not mutate the plant. `post` raises InsufficientFundsError on overdraw.
        cost = to_money(Decimal(str(cfg.get("cost", 60))))
        post(
            self.session, player_id, -cost,
            LedgerEntryType.GROWTH_BOOST, ref_type="plant", ref_id=plant_id,
        )

        # Revive: floor resources and lift health BEFORE the jump so the
        # fast-forwarded hours run under good conditions (a near-dead plant won't
        # die mid-jump), then re-assert the health floor after as a guaranteed
        # post-condition.
        recover_to = cfg.get("recover_health_to", 70)
        plant.water_level = max(plant.water_level, cfg.get("water_floor", 80))
        plant.nutrient_level = max(plant.nutrient_level, cfg.get("nutrient_floor", 80))
        plant.health = max(plant.health, recover_to)

        # Fast-forward: rewind the lifecycle timestamps, then re-sync so the engine
        # advances `advance_hours` extra grow-hours NOW (deterministic, seeded
        # per plant-hour). last_tick_at lands back at the effective clock — no
        # future-banking; the plant is simply older/further along.
        advance_hours = int(cfg.get("advance_hours", 4))
        if advance_hours > 0:
            jump = timedelta(hours=advance_hours)
            plant.last_tick_at -= jump
            plant.stage_entered_at -= jump
            if plant.planted_at is not None:
                plant.planted_at -= jump
            self.sync(plant)

        plant.health = max(plant.health, recover_to)
        plant.condition_flags = engine.reactions.compute_conditions(plant, self._sim)
        self._log(plant, "growth_boosted", payload={
            "cost": float(cost),
            "advance_hours": advance_hours,
            "recovered_health_to": recover_to,
        })
        return plant

    def apply_consumable(self, player_id: str, plant_id: str, item_key: str) -> Plant:
        """Use one shop consumable on a plant, applying its effect to the plant's
        simulated levels (so it flows through the normal yield/quality math)."""
        item = self.cfg.shop_consumables.get(item_key)
        if item is None:
            raise GameError(f"Unknown consumable '{item_key}'")

        plant = self._get_plant(player_id, plant_id)
        self._require_living(plant)

        stage_req = item.get("stage_req")
        if stage_req and plant.growth_stage != stage_req:
            raise GameError(f"{item.get('name', item_key)} can only be used during {stage_req}")

        stack = (
            self.session.query(ConsumableInventory)
            .filter(
                ConsumableInventory.player_id == player_id,
                ConsumableInventory.item_key == item_key,
            )
            .one_or_none()
        )
        if stack is None or stack.quantity < 1:
            raise GameError("You don't own this consumable")

        self.sync(plant)
        effects = item.get("effects", {})
        potency = 1.0 + self._research(player_id).get("consumable_potency_pct", 0.0)

        def _clamp(v):
            return max(0.0, min(100.0, v))

        if "water_set" in effects:
            plant.water_level = _clamp(float(effects["water_set"]))
        if "nutrient_set" in effects:
            plant.nutrient_level = _clamp(float(effects["nutrient_set"]))
        if "pest_set" in effects:
            plant.pest_level = _clamp(float(effects["pest_set"]))
        if "disease_set" in effects:
            plant.disease_level = _clamp(float(effects["disease_set"]))
        if "health_add" in effects:
            plant.health = _clamp(plant.health + float(effects["health_add"]) * potency)

        stack.quantity -= 1
        plant.condition_flags = engine.reactions.compute_conditions(plant, self._sim)
        self._log(plant, "consumable_applied", payload={"item": item_key})
        return plant

    def set_environment(
        self, player_id: str, pod_id: str, temperature, humidity, co2_level,
        light_intensity, ph_level,
    ) -> GrowPod:
        pod = self.session.get(GrowPod, pod_id)
        if pod is None or pod.player_id != player_id:
            raise GameError("Pod not found")

        pod.temperature = temperature
        pod.humidity = humidity
        pod.co2_level = co2_level
        pod.light_intensity = light_intensity
        pod.ph_level = ph_level

        self.session.add(
            EnvironmentReading(
                pod_id=pod_id, temperature=temperature, humidity=humidity,
                co2_level=co2_level, light_intensity=light_intensity, ph_level=ph_level,
            )
        )

        # Bring every living plant in the pod up to date under the old
        # environment before the new readings take effect.
        plants = (
            self.session.query(Plant)
            .filter(Plant.pod_id == pod_id, Plant.harvested.is_(False), Plant.is_alive.is_(True))
            .all()
        )
        for plant in plants:
            self.sync(plant)
        return pod

    # ----- helpers --------------------------------------------------------
    def _require_living(self, plant: Plant) -> None:
        if plant.harvested:
            raise GameError("Plant already harvested")
        if not plant.is_alive:
            raise GameError("Plant is dead")

    def _log(self, plant: Plant, event_type: str, payload: dict) -> None:
        self.session.add(
            PlantEvent(
                plant_id=plant.id,
                timestamp=self.clock.now(),
                event_type=event_type,
                payload=payload,
            )
        )

    def _last_event(self, plant: Plant, event_type: str) -> Optional[PlantEvent]:
        """The most recent PlantEvent of ``event_type`` for this plant, or None.

        Flushes first so an event logged earlier in this same (autoflush-off)
        session — e.g. a prior prune/boost — is visible to the once-per-stage /
        cooldown guard.
        """
        self.session.flush()
        return (
            self.session.query(PlantEvent)
            .filter(
                PlantEvent.plant_id == plant.id,
                PlantEvent.event_type == event_type,
            )
            .order_by(PlantEvent.timestamp.desc())
            .first()
        )

    def _last_event_stage(self, plant: Plant, event_type: str) -> Optional[str]:
        """The ``stage`` recorded on the most recent ``event_type`` event, or None."""
        ev = self._last_event(plant, event_type)
        if ev is None:
            return None
        return (ev.payload or {}).get("stage")

    def _hours_since_last_event(self, plant: Plant, event_type: str) -> Optional[float]:
        """Hours elapsed since the most recent ``event_type`` event, or None."""
        ev = self._last_event(plant, event_type)
        if ev is None:
            return None
        return (self.clock.now() - ev.timestamp).total_seconds() / 3600.0
