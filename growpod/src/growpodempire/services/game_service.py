"""
GameService — the DB-backed game logic layer for the new economy, strain,
breeding, and marketplace features.

Operates on an injected SQLAlchemy Session (the caller owns the transaction
boundary via session_scope). All currency movements go through economy.ledger
so balances stay consistent and auditable.
"""

import random
import secrets
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from ..config import get_settings
from ..economy import pricing
from ..economy.config import get_economy_config, EconomyConfig
from ..economy.ledger import post, to_money
from ..enums import (
    GrowthStage,
    LedgerEntryType,
    LineageType,
    Rarity,
    SeedSource,
    ListingStatus,
    ListingItemType,
)
from ..genetics.breeding import cross, derive_strain_fields, assign_rarity
from ..genetics.traits import express_terpenes, normalize_genome
from ..simulation import engine, curing
from ..simulation.clock import Clock, active_clock, player_clock
from . import leveling_service
from ..db.models import (
    Player,
    Wallet,
    Strain,
    StrainFavorite,
    SeedInventory,
    GrowPod,
    Plant,
    BreedingEvent,
    Harvest,
    MarketListing,
    LedgerEntry,
    ConsumableInventory,
    GearInventory,
    GrantClaim,
)
from ..db.seed import slugify

import yaml

_STRAIN_KB_CACHE = None


def load_strain_knowledge() -> dict:
    """Load (and cache) the strain knowledge base — scientist-grade encyclopedia
    keyed by strain slug (see data/strain_knowledge.yaml)."""
    global _STRAIN_KB_CACHE
    if _STRAIN_KB_CACHE is None:
        path = get_settings().strain_knowledge_file
        with open(path, "r", encoding="utf-8") as fh:
            _STRAIN_KB_CACHE = yaml.safe_load(fh) or {}
    return _STRAIN_KB_CACHE


class GameError(Exception):
    """Domain error surfaced to the API as a 400."""


class GameService:
    def __init__(
        self,
        session: Session,
        config: Optional[EconomyConfig] = None,
        clock: Optional[Clock] = None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        # Default to the active clock: plain wall time, or the shared dev/test
        # clock when enabled (dev/test only, force-disabled in prod). Mirrors
        # SimulationService so harvest/cure/sell + market/auction expiry advance
        # under the dev clock too. Explicit injection (tests) always wins.
        self.clock = clock or active_clock()

    def _research(self, player_id: str) -> dict:
        """Aggregated player perks = research-tree + earned-degree + completed-course effects.
        Lazy imports avoid circular dependencies. Every apply-site (harvest yield/quality,
        care/breeding discounts, terpenes) picks up all three layers automatically."""
        from .research_service import research_effects
        from .university_service import degree_effects, course_effects
        fx = research_effects(self.session, player_id, self.cfg)
        for k, v in degree_effects(self.session, player_id, self.cfg).items():
            fx[k] = fx.get(k, 0.0) + v
        for k, v in course_effects(self.session, player_id, self.cfg).items():
            fx[k] = fx.get(k, 0.0) + v
        return fx

    # ----- Players & wallets ---------------------------------------------
    def create_player(self, username: str, email: Optional[str] = None) -> Player:
        # Normalize + validate so a blank/whitespace or over-long username, or a
        # duplicate email, returns a clean 400 instead of creating a junk account
        # or 500-ing on the DB unique constraint.
        username = (username or "").strip()
        if not (1 <= len(username) <= 64):
            raise GameError("username must be 1-64 characters")
        if self.session.query(Player).filter(Player.username == username).first():
            raise GameError(f"Username '{username}' already taken")
        email = email.strip() if isinstance(email, str) else email
        email = email or None
        if email and self.session.query(Player).filter(Player.email == email).first():
            raise GameError("Email already registered")

        player = Player(
            username=username, email=email, api_key=secrets.token_urlsafe(32)
        )
        self.session.add(player)
        self.session.flush()  # assign player.id

        wallet = Wallet(player_id=player.id, cached_balance=Decimal("0"))
        self.session.add(wallet)
        self.session.flush()

        post(
            self.session,
            player.id,
            self.cfg.starting_balance,
            LedgerEntryType.STARTING_GRANT,
        )
        return player

    def grant_starter_items(self, player_id: str) -> None:
        """Idempotently grant the starter pod + starter seed so the first-run loop
        (plant → care → harvest → sell) is reachable with zero setup — the #1
        onboarding blocker per the retention/QA review. Called on signup. Each item
        is a one-shot claim in grant_claims, so re-running this (or a raced double
        signup) can never hand out a second pod or seed."""
        if self._claim_grant(player_id, "starter", "pod"):
            self.create_pod(player_id, "Starter Pod", charge=False)
        if self._claim_grant(player_id, "starter", "seed"):
            strain = self._starter_strain()
            if strain is not None:
                stack = self._get_or_create_seed_stack(
                    player_id, strain.id, SeedSource.STARTER
                )
                stack.quantity += 1
                self.session.flush()

    def _claim_grant(self, player_id: str, grant_type: str, grant_key: str) -> bool:
        """Reserve a one-shot grant. Returns True if this call won the claim (the
        caller should then grant), False if it was already claimed. The unique
        index on (player_id, grant_type, grant_key) is the hard backstop against
        races; the pre-check keeps the common path off the IntegrityError road."""
        existing = (
            self.session.query(GrantClaim)
            .filter(
                GrantClaim.player_id == player_id,
                GrantClaim.grant_type == grant_type,
                GrantClaim.grant_key == grant_key,
            )
            .first()
        )
        if existing is not None:
            return False
        self.session.add(
            GrantClaim(player_id=player_id, grant_type=grant_type, grant_key=grant_key)
        )
        self.session.flush()
        return True

    def _starter_strain(self) -> Optional[Strain]:
        """A beginner-friendly starter strain: the easiest common base-catalog
        strain, chosen deterministically so every new player starts equal."""
        base = self.session.query(Strain).filter(Strain.is_base_catalog.is_(True))
        return (
            base.filter(Strain.rarity == "common")
            .order_by(Strain.difficulty.asc(), Strain.slug.asc())
            .first()
            or base.order_by(Strain.difficulty.asc(), Strain.slug.asc()).first()
        )

    def get_player(self, player_id: str) -> Player:
        player = self.session.get(Player, player_id)
        if player is None:
            raise GameError(f"Player {player_id} not found")
        return player

    # ----- Global turbo (10× test) speed faucet ---------------------------
    def _turbo_multiplier(self) -> float:
        return float(self.cfg.raw.get("simulation", {}).get("turbo_multiplier", 10.0))

    def _player_now(self, player: Player) -> datetime:
        """The player's effective simulation 'now' (wall time + banked turbo
        acceleration). Used wherever the grow loop advances a plant so harvest
        reflects the accelerated clock. Shares the single per-player clock helper
        with SimulationService so the two can never drift apart."""
        eff_now, _rate = player_clock(self.clock.now(), player, self._turbo_multiplier())
        return eff_now

    def turbo_state(self, player: Player) -> dict:
        """Account-truthful turbo readout for the UI (so the toggle reflects the
        server, not a client guess)."""
        m = self._turbo_multiplier()
        now = self._player_now(player)
        return {
            "enabled": bool(player.turbo_enabled),
            "multiplier": m,
            "offset_hours": round(float(player.turbo_offset_seconds or 0.0) / 3600.0, 3),
            "effective_now": now.isoformat(),
            "wall_now": self.clock.now().isoformat(),
        }

    def set_turbo(self, player_id: str, enabled: bool) -> dict:
        """Turn the global speed faucet on/off for the whole ACCOUNT. Banks the
        accrued acceleration on the way off (forward-only) so no progress is lost,
        then brings every living pod up to the new effective clock so the change
        is reflected immediately across all of them."""
        player = self.get_player(player_id)
        wall = self.clock.now()
        m = self._turbo_multiplier()

        if enabled and not player.turbo_enabled:
            player.turbo_anchor_at = wall
            player.turbo_enabled = True
        elif not enabled and player.turbo_enabled:
            if player.turbo_anchor_at is not None:
                live = (wall - player.turbo_anchor_at).total_seconds()
                if live > 0:
                    player.turbo_offset_seconds = (
                        float(player.turbo_offset_seconds or 0.0) + live * (m - 1.0)
                    )
            player.turbo_enabled = False
            player.turbo_anchor_at = None

        # Reflect the change across every pod at once: catch each living plant up
        # to the new effective clock (compute-on-read, no economy paths touched
        # beyond the normal harvest-on-advance).
        from .simulation_service import SimulationService
        sim = SimulationService(self.session, config=self.cfg, clock=self.clock)
        living = (
            self.session.query(Plant)
            .filter(
                Plant.player_id == player_id,
                Plant.harvested.is_(False),
                Plant.is_alive.is_(True),
            )
            .all()
        )
        for plant in living:
            sim.sync(plant)

        return {**self.turbo_state(player), "synced_pods": len(living)}

    def link_wallet(self, player_id: str, algorand_address: str) -> Player:
        """Associate (connect / "log in") a player with an Algorand address.
        Validates the address checksum so a typo can't be stored."""
        from algosdk import encoding
        addr = (algorand_address or "").strip()
        if not addr:
            raise GameError("algorand_address is required")
        if not encoding.is_valid_address(addr):
            raise GameError("That doesn't look like a valid Algorand address.")
        player = self.get_player(player_id)
        player.algorand_address = addr
        return player

    def unlink_wallet(self, player_id: str) -> Player:
        """Disconnect ("log out") the player's linked Algorand address.
        Idempotent — on-chain assets stay at the address; the player can re-link
        anytime."""
        player = self.get_player(player_id)
        player.algorand_address = None
        return player

    def get_wallet(self, player_id: str) -> Wallet:
        wallet = (
            self.session.query(Wallet)
            .filter(Wallet.player_id == player_id)
            .one_or_none()
        )
        if wallet is None:
            raise GameError(f"Wallet for player {player_id} not found")
        return wallet

    def get_ledger(self, player_id: str, limit: int = 100) -> List[LedgerEntry]:
        return (
            self.session.query(LedgerEntry)
            .filter(LedgerEntry.player_id == player_id)
            .order_by(LedgerEntry.created_at.desc())
            .limit(limit)
            .all()
        )

    # ----- Strains & seeds ------------------------------------------------
    def list_strains(
        self,
        catalog_only: bool = False,
        q: Optional[str] = None,
        rarity: Optional[str] = None,
        lineage_type: Optional[str] = None,
        min_thc: Optional[float] = None,
        max_thc: Optional[float] = None,
        max_indica: Optional[float] = None,
        min_indica: Optional[float] = None,
    ) -> List[Strain]:
        query = self.session.query(Strain)
        if catalog_only:
            query = query.filter(Strain.is_base_catalog.is_(True))
        if q:
            query = query.filter(Strain.name.ilike(f"%{q}%"))
        if rarity:
            query = query.filter(Strain.rarity == rarity)
        if lineage_type:
            query = query.filter(Strain.lineage_type == lineage_type)
        if min_thc is not None:
            query = query.filter(Strain.thc_max >= min_thc)
        if max_thc is not None:
            query = query.filter(Strain.thc_min <= max_thc)
        if min_indica is not None:
            query = query.filter(Strain.indica_ratio >= min_indica)
        if max_indica is not None:
            query = query.filter(Strain.indica_ratio <= max_indica)
        return query.order_by(Strain.rarity, Strain.name).all()

    def get_strain(self, strain_id: str) -> Strain:
        strain = self.session.get(Strain, strain_id)
        if strain is None:
            raise GameError(f"Strain {strain_id} not found")
        return strain

    def season_available(self, strain: Strain) -> bool:
        """Whether a strain can currently be bought given the active season.

        Always-on strains (season "all") and any strain when no season is active
        (current_season "all") are available; otherwise the strain's season must
        match the active one. "limited" strains require a matching event.
        """
        season = getattr(strain, "season", "all") or "all"
        current = self.cfg.current_season
        return season == "all" or current == "all" or season == current

    # ----- Favorites ------------------------------------------------------
    def add_favorite(self, player_id: str, strain_id: str) -> StrainFavorite:
        self.get_player(player_id)
        self.get_strain(strain_id)
        existing = (
            self.session.query(StrainFavorite)
            .filter(
                StrainFavorite.player_id == player_id,
                StrainFavorite.strain_id == strain_id,
            )
            .one_or_none()
        )
        if existing:
            return existing
        fav = StrainFavorite(player_id=player_id, strain_id=strain_id)
        self.session.add(fav)
        self.session.flush()
        return fav

    def remove_favorite(self, player_id: str, strain_id: str) -> None:
        self.session.query(StrainFavorite).filter(
            StrainFavorite.player_id == player_id,
            StrainFavorite.strain_id == strain_id,
        ).delete()

    def list_favorites(self, player_id: str) -> List[Strain]:
        return (
            self.session.query(Strain)
            .join(StrainFavorite, StrainFavorite.strain_id == Strain.id)
            .filter(StrainFavorite.player_id == player_id)
            .order_by(Strain.name)
            .all()
        )

    def get_seed_inventory(self, player_id: str) -> List[SeedInventory]:
        return (
            self.session.query(SeedInventory)
            .filter(SeedInventory.player_id == player_id, SeedInventory.quantity > 0)
            .all()
        )

    def list_pods(self, player_id: str) -> List[GrowPod]:
        self.get_player(player_id)  # 404 cleanly for unknown players
        return (
            self.session.query(GrowPod)
            .filter(GrowPod.player_id == player_id)
            .order_by(GrowPod.name)
            .all()
        )

    def list_plants(self, player_id: str) -> List[Plant]:
        self.get_player(player_id)
        return (
            self.session.query(Plant)
            .filter(Plant.player_id == player_id, Plant.archived_at.is_(None))
            .order_by(Plant.planted_at.desc())
            .all()
        )

    def buy_seed(self, player_id: str, strain_id: str, quantity: int = 1) -> SeedInventory:
        if quantity < 1:
            raise GameError("quantity must be >= 1")
        strain = self.get_strain(strain_id)
        if not self.season_available(strain):
            raise GameError(f"{strain.name} is not available this season")

        unit = pricing.seed_price(strain.rarity, self.cfg)
        discount = min(0.9, self._research(player_id).get("seed_discount_pct", 0.0))
        total = to_money(unit * quantity * Decimal(str(1.0 - discount)))
        post(
            self.session,
            player_id,
            -total,
            LedgerEntryType.SEED_PURCHASE,
            ref_type="strain",
            ref_id=strain_id,
        )

        stack = self._get_or_create_seed_stack(
            player_id, strain_id, SeedSource.PURCHASED
        )
        stack.quantity += quantity
        return stack

    def _get_or_create_seed_stack(
        self, player_id: str, strain_id: str, source: SeedSource
    ) -> SeedInventory:
        stack = (
            self.session.query(SeedInventory)
            .filter(
                SeedInventory.player_id == player_id,
                SeedInventory.strain_id == strain_id,
            )
            .one_or_none()
        )
        if stack is None:
            stack = SeedInventory(
                player_id=player_id,
                strain_id=strain_id,
                quantity=0,
                source=source.value,
            )
            self.session.add(stack)
            self.session.flush()
        return stack

    # ----- Shop (consumables) ---------------------------------------------
    def list_consumables(self, player_id: str) -> List[dict]:
        self.get_player(player_id)
        owned = {
            r.item_key: r.quantity
            for r in self.session.query(ConsumableInventory).filter(
                ConsumableInventory.player_id == player_id
            )
        }
        out = []
        for key, item in self.cfg.shop_consumables.items():
            out.append({
                "key": key,
                "name": item.get("name", key),
                "cost": float(item.get("cost", 0)),
                "description": item.get("description", ""),
                "stage_req": item.get("stage_req"),
                "owned": owned.get(key, 0),
            })
        return out

    def buy_consumable(
        self, player_id: str, item_key: str, quantity: int = 1
    ) -> ConsumableInventory:
        if quantity < 1:
            raise GameError("quantity must be >= 1")
        self.get_player(player_id)
        item = self.cfg.shop_consumables.get(item_key)
        if item is None:
            raise GameError(f"Unknown consumable '{item_key}'")

        cost = to_money(Decimal(str(item.get("cost", 0))) * quantity)
        post(
            self.session, player_id, -cost, LedgerEntryType.SHOP_PURCHASE,
            ref_type="consumable", ref_id=item_key,
        )
        stack = (
            self.session.query(ConsumableInventory)
            .filter(
                ConsumableInventory.player_id == player_id,
                ConsumableInventory.item_key == item_key,
            )
            .one_or_none()
        )
        if stack is None:
            stack = ConsumableInventory(player_id=player_id, item_key=item_key, quantity=0)
            self.session.add(stack)
            self.session.flush()
        stack.quantity += quantity
        return stack

    # ----- Store: grow-room gear (lights/fans/soils) ----------------------
    def list_gear(self, player_id: str) -> List[dict]:
        """Catalog of buyable gear merged with the player's owned counts and,
        for lights, which pod each is equipped to."""
        self.get_player(player_id)
        owned = {
            r.gear_key: r
            for r in self.session.query(GearInventory).filter(
                GearInventory.player_id == player_id
            )
        }
        out = []
        for key, item in self.cfg.shop_gear.items():
            stack = owned.get(key)
            out.append({
                "key": key,
                "name": item.get("name", key),
                "category": item.get("category", "gear"),
                "cost": float(item.get("cost", 0)),
                "description": item.get("description", ""),
                "image": item.get("image"),
                "specs": item.get("specs", {}),
                "owned": stack.quantity if stack else 0,
                "equipped_pod_id": stack.equipped_pod_id if stack else None,
            })
        return out

    def buy_gear(self, player_id: str, gear_key: str, quantity: int = 1) -> GearInventory:
        if quantity < 1:
            raise GameError("quantity must be >= 1")
        self.get_player(player_id)
        item = self.cfg.shop_gear.get(gear_key)
        if item is None:
            raise GameError(f"Unknown gear '{gear_key}'")

        cost = to_money(Decimal(str(item.get("cost", 0))) * quantity)
        post(
            self.session, player_id, -cost, LedgerEntryType.SHOP_PURCHASE,
            ref_type="gear", ref_id=gear_key,
        )
        stack = (
            self.session.query(GearInventory)
            .filter(
                GearInventory.player_id == player_id,
                GearInventory.gear_key == gear_key,
            )
            .one_or_none()
        )
        if stack is None:
            stack = GearInventory(
                player_id=player_id, gear_key=gear_key,
                category=item.get("category", "gear"), quantity=0,
            )
            self.session.add(stack)
            self.session.flush()
        stack.quantity += quantity
        return stack

    def equip_light(self, player_id: str, pod_id: str, gear_key: str) -> GrowPod:
        """Equip an owned light to a pod: writes the light's PPFD to the pod's
        `light_intensity` (the sim reads it as the light level). Only lights are
        functional; fans/soils are owned-only for now."""
        item = self.cfg.shop_gear.get(gear_key)
        if item is None:
            raise GameError(f"Unknown gear '{gear_key}'")
        if item.get("category") != "light":
            raise GameError("Only lights can be equipped to a pod")

        stack = (
            self.session.query(GearInventory)
            .filter(
                GearInventory.player_id == player_id,
                GearInventory.gear_key == gear_key,
            )
            .one_or_none()
        )
        if stack is None or stack.quantity < 1:
            raise GameError("You don't own this light")

        pod = self.session.get(GrowPod, pod_id)
        if pod is None or pod.player_id != player_id:
            raise GameError("Pod not found")

        ppfd = float(item.get("specs", {}).get("ppfd", 0))
        pod.light_intensity = ppfd
        # A pod runs one light at a time: clear any other light equipped here.
        # Sessions run autoflush=False, so flush pending equip changes first or
        # the filter below won't see a light equipped earlier in this txn.
        self.session.flush()
        for other in self.session.query(GearInventory).filter(
            GearInventory.player_id == player_id,
            GearInventory.category == "light",
            GearInventory.equipped_pod_id == pod_id,
        ):
            if other.gear_key != gear_key:
                other.equipped_pod_id = None
        stack.equipped_pod_id = pod_id
        return pod

    # ----- Pods & planting ------------------------------------------------
    def create_pod(
        self,
        player_id: str,
        name: str,
        capacity: int = 4,
        tier: str = "basic",
        charge: bool = True,
    ) -> GrowPod:
        self.get_player(player_id)
        if charge:
            price = self.cfg.pod_price(tier)
            post(
                self.session,
                player_id,
                -to_money(price),
                LedgerEntryType.POD_PURCHASE,
                ref_type="pod_tier",
                ref_id=tier,
            )
        auto_water, auto_feed = self._tier_automation(tier)
        capacity_bonus = int(self._research(player_id).get("pod_capacity_bonus", 0))
        pod = GrowPod(
            player_id=player_id, name=name, capacity=capacity + capacity_bonus, tier=tier,
            auto_water=auto_water, auto_feed=auto_feed,
        )
        self.session.add(pod)
        self.session.flush()
        return pod

    @staticmethod
    def _tier_automation(tier: str) -> tuple:
        """(auto_water, auto_feed) granted by a pod tier."""
        return {
            "basic": (False, False),
            "standard": (True, False),
            "pro": (True, True),
        }.get(tier, (False, False))

    def upgrade_pod(self, player_id: str, pod_id: str, new_tier: str) -> GrowPod:
        pod = self.session.get(GrowPod, pod_id)
        if pod is None or pod.player_id != player_id:
            raise GameError("Pod not found")
        try:
            new_price = self.cfg.pod_price(new_tier)
            old_price = self.cfg.pod_price(pod.tier)
        except KeyError:
            raise GameError(f"Unknown pod tier '{new_tier}'")
        if new_price <= old_price:
            raise GameError("New tier must be an upgrade")

        post(
            self.session, player_id, -to_money(new_price - old_price),
            LedgerEntryType.POD_PURCHASE, ref_type="pod_upgrade", ref_id=new_tier,
        )
        pod.tier = new_tier
        pod.auto_water, pod.auto_feed = self._tier_automation(new_tier)
        return pod

    def plant_seed(self, player_id: str, seed_id: str, pod_id: str) -> Plant:
        stack = self.session.get(SeedInventory, seed_id)
        if stack is None or stack.player_id != player_id:
            raise GameError("Seed not found in player's inventory")
        if stack.quantity < 1:
            raise GameError("No seeds left in that stack")

        pod = self.session.get(GrowPod, pod_id)
        if pod is None or pod.player_id != player_id:
            raise GameError("Pod not found")

        planted = (
            self.session.query(Plant)
            .filter(
                Plant.pod_id == pod_id,
                Plant.harvested.is_(False),
                Plant.archived_at.is_(None),
            )
            .count()
        )
        if planted >= pod.capacity:
            raise GameError("Pod is at full capacity")

        strain = self.get_strain(stack.strain_id)
        stack.quantity -= 1

        plant = Plant(
            player_id=player_id,
            pod_id=pod_id,
            strain_id=strain.id,
            seed_id=seed_id,
            genome=strain.genome,  # immutable per-plant copy
            growth_stage=GrowthStage.SEED.value,
        )
        self.session.add(plant)
        self.session.flush()
        return plant

    # ----- Breeding -------------------------------------------------------
    def breed(
        self,
        player_id: str,
        parent_a_id: str,
        parent_b_id: str,
        rng_seed: Optional[int] = None,
        offspring_name: Optional[str] = None,
    ) -> Strain:
        self.get_player(player_id)
        parent_a = self.get_strain(parent_a_id)
        parent_b = self.get_strain(parent_b_id)

        fee = pricing.breeding_fee(parent_a.rarity, parent_b.rarity, self.cfg)
        disc = min(0.9, self._research(player_id).get("breeding_discount_pct", 0.0))
        fee = to_money(fee * Decimal(str(1.0 - disc)))
        post(
            self.session,
            player_id,
            -fee,
            LedgerEntryType.BREEDING_FEE,
            ref_type="breeding",
        )

        if rng_seed is None:
            settings = get_settings()
            rng_seed = (
                settings.rng_seed
                if settings.rng_seed is not None
                else random.randrange(2**31)
            )
        rng = random.Random(rng_seed)

        result = cross(
            parent_a.genome,
            parent_b.genome,
            rng,
            stability_a=parent_a.stability,
            stability_b=parent_b.stability,
            generation_a=parent_a.generation,
            generation_b=parent_b.generation,
        )
        rarity = assign_rarity(
            result.genome, result.stability, (parent_a.rarity, parent_b.rarity)
        )
        fields = derive_strain_fields(result.genome, result.stability)

        name = offspring_name or f"{parent_a.name} x {parent_b.name}"
        offspring = Strain(
            name=name,
            slug=self._unique_slug(slugify(name)),
            lineage_type=LineageType.BRED.value,
            rarity=rarity.value,
            terpenes=list({*(parent_a.terpenes or []), *(parent_b.terpenes or [])}),
            genome=result.genome,
            stability=result.stability,
            generation=result.generation,
            parent_a_id=parent_a.id,
            parent_b_id=parent_b.id,
            is_base_catalog=False,
            created_by_player_id=player_id,
            **fields,
        )
        self.session.add(offspring)
        self.session.flush()

        event = BreedingEvent(
            player_id=player_id,
            parent_a_id=parent_a.id,
            parent_b_id=parent_b.id,
            offspring_strain_id=offspring.id,
            rng_seed=rng_seed,
            inherited_traits=result.inherited_traits,
        )
        self.session.add(event)

        # Reward the breeder with a seed of their new strain.
        stack = self._get_or_create_seed_stack(player_id, offspring.id, SeedSource.BRED)
        stack.quantity += 1

        leveling_service.award(self.session, player_id, "breed", self.cfg)
        return offspring

    def _unique_slug(self, base: str) -> str:
        slug = base
        i = 2
        while self.session.query(Strain).filter(Strain.slug == slug).first():
            slug = f"{base}-{i}"
            i += 1
        return slug

    def stabilize_strain(
        self, player_id: str, strain_id: str, rng_seed: Optional[int] = None
    ) -> Strain:
        """Self/backcross a line: consume a seed + pay a fee to produce a more
        stable next generation (narrower traits), eventually unlocking NFT mint.
        """
        parent = self.get_strain(strain_id)
        self.session.flush()  # surface any pending seed-inventory changes
        stack = (
            self.session.query(SeedInventory)
            .filter(
                SeedInventory.player_id == player_id,
                SeedInventory.strain_id == strain_id,
                SeedInventory.quantity > 0,
            )
            .one_or_none()
        )
        if stack is None:
            raise GameError("You need a seed of this strain to stabilize it")

        fee = pricing.breeding_fee(parent.rarity, parent.rarity, self.cfg)
        disc = min(0.9, self._research(player_id).get("breeding_discount_pct", 0.0))
        fee = to_money(fee * Decimal(str(1.0 - disc)))
        post(self.session, player_id, -fee, LedgerEntryType.BREEDING_FEE, ref_type="stabilize")
        stack.quantity -= 1

        if rng_seed is None:
            settings = get_settings()
            rng_seed = settings.rng_seed if settings.rng_seed is not None else random.randrange(2**31)
        rng = random.Random(rng_seed)

        # Selfing: same genome on both sides -> little segregation; we then raise
        # stability and re-derive the (narrower) expressed ranges.
        result = cross(
            parent.genome, parent.genome, rng,
            stability_a=parent.stability, stability_b=parent.stability,
            generation_a=parent.generation, generation_b=parent.generation,
        )
        increment = float(self.cfg.raw.get("breeding", {}).get("stabilize_increment", 0.15))
        new_stability = min(1.0, parent.stability + increment)
        generation = parent.generation + 1
        rarity = assign_rarity(result.genome, new_stability, (parent.rarity, parent.rarity))
        fields = derive_strain_fields(result.genome, new_stability)

        name = f"{parent.name} S{generation}"
        offspring = Strain(
            name=name,
            slug=self._unique_slug(slugify(name)),
            lineage_type=LineageType.BRED.value,
            rarity=rarity.value,
            terpenes=list(parent.terpenes or []),
            genome=result.genome,
            stability=new_stability,
            generation=generation,
            parent_a_id=parent.id,
            parent_b_id=parent.id,
            is_base_catalog=False,
            created_by_player_id=player_id,
            **fields,
        )
        self.session.add(offspring)
        self.session.flush()

        self.session.add(BreedingEvent(
            player_id=player_id, parent_a_id=parent.id, parent_b_id=parent.id,
            offspring_strain_id=offspring.id, rng_seed=rng_seed,
            inherited_traits={"stabilized_from": parent.id},
        ))
        new_stack = self._get_or_create_seed_stack(player_id, offspring.id, SeedSource.BRED)
        new_stack.quantity += 1
        leveling_service.award(self.session, player_id, "breed", self.cfg)
        return offspring

    # ----- Provable fairness ----------------------------------------------
    def verify_strain(self, strain_id: str) -> dict:
        """Re-derive a bred strain's genome from its persisted breeding seed and
        confirm it matches what was recorded — the trust layer's "verify this
        result" affordance (see docs/memory/design/04-honesty-and-trust.md).

        The breeding RNG is seeded and the seed + parents are public, so anyone
        can replay `cross()` and prove the genome was neither cherry-picked nor
        tampered with. Read-only; works for both breeds and stabilizations
        (selfing is a cross of a strain with itself).
        """
        strain = self.get_strain(strain_id)
        event = (
            self.session.query(BreedingEvent)
            .filter(BreedingEvent.offspring_strain_id == strain_id)
            .order_by(BreedingEvent.created_at.desc())
            .first()
        )
        if event is None:
            return {
                "strain_id": strain_id,
                "verifiable": False,
                "reason": "No breeding event — a base-catalog or otherwise non-bred strain.",
            }

        parent_a = self.session.get(Strain, event.parent_a_id)
        parent_b = self.session.get(Strain, event.parent_b_id)
        rng = random.Random(event.rng_seed)
        result = cross(
            parent_a.genome, parent_b.genome, rng,
            stability_a=parent_a.stability, stability_b=parent_b.stability,
            generation_a=parent_a.generation, generation_b=parent_b.generation,
        )

        stored = normalize_genome(strain.genome)
        max_delta = 0.0
        mismatched: List[str] = []
        for trait, gene in result.genome.items():
            s = stored.get(trait, {})
            delta = abs(float(gene["value"]) - float(s.get("value", gene["value"])))
            max_delta = max(max_delta, delta)
            if delta > 1e-9 or s.get("dominance") != gene["dominance"]:
                mismatched.append(trait)

        return {
            "strain_id": strain_id,
            "verifiable": True,
            "verified": not mismatched,
            "rng_seed": event.rng_seed,
            "parent_a_id": event.parent_a_id,
            "parent_b_id": event.parent_b_id,
            "bred_at": event.created_at.isoformat() if event.created_at else None,
            "max_value_delta": round(max_delta, 12),
            "mismatched_traits": mismatched,
            "method": "replay cross() with the persisted rng_seed, then compare the genome",
        }

    def verify_lineage(self, strain_id: str, max_nodes: int = 256) -> dict:
        """Recursively verify a strain's entire breeding ancestry — the
        verifiable pedigree behind the GenBank (see
        docs/memory/design/02-genetics.md). Walks parent links back to
        base-catalog roots, replaying every bred node's cross from its seed, so
        a whole family tree is provable, not just one strain. Read-only.
        """
        self.get_strain(strain_id)  # 404 if the strain doesn't exist
        lineage: List[dict] = []
        seen: set = set()
        stack: List[str] = [strain_id]
        fully_verified = True
        root_count = 0

        while stack and len(lineage) < max_nodes:
            sid = stack.pop()
            if sid in seen:
                continue
            seen.add(sid)
            strain = self.session.get(Strain, sid)
            if strain is None:
                continue

            proof = self.verify_strain(sid)
            node = {
                "strain_id": sid,
                "name": strain.name,
                "generation": strain.generation,
                "rarity": strain.rarity,
            }
            if proof["verifiable"]:
                node.update(
                    verified=proof["verified"],
                    rng_seed=proof["rng_seed"],
                    parent_a_id=proof["parent_a_id"],
                    parent_b_id=proof["parent_b_id"],
                )
                if not proof["verified"]:
                    fully_verified = False
                for pid in (proof["parent_a_id"], proof["parent_b_id"]):
                    if pid and pid not in seen:
                        stack.append(pid)
            else:
                node.update(root=True, is_base_catalog=strain.is_base_catalog)
                root_count += 1
            lineage.append(node)

        return {
            "strain_id": strain_id,
            "fully_verified": fully_verified,
            "node_count": len(lineage),
            "root_count": root_count,
            "truncated": bool(stack),
            "lineage": lineage,
        }

    # ----- Knowledge base -------------------------------------------------
    def strain_knowledge(self, strain_id: str) -> dict:
        """Scientist-grade encyclopedia for a strain — lineage, origin, sensory
        & effect profile, cannabinoid/terpene detail, and cultivation parameters
        (flowering, optimal environment, yields). Merges the live strain row with
        the static knowledge base keyed by slug (see data/strain_knowledge.yaml).
        Read-only; public. Player-bred strains have no encyclopedia entry — their
        story is their verifiable lineage (`verify_lineage`).
        """
        strain = self.get_strain(strain_id)
        entry = load_strain_knowledge().get(strain.slug)
        out = {
            "strain_id": strain.id,
            "name": strain.name,
            "slug": strain.slug,
            "rarity": strain.rarity,
            "lineage_type": strain.lineage_type,
            "is_base_catalog": strain.is_base_catalog,
            "in_knowledge_base": entry is not None,
            "knowledge": entry,
        }
        if entry is None:
            out["note"] = (
                "No encyclopedia entry — a player-bred strain. Its story is its "
                "verifiable lineage; see GET /strains/<id>/lineage."
            )
        return out

    def strain_effects(self, strain_id: str) -> dict:
        """Terpene-driven effect (buff) profile for any strain — base-catalog or
        player-bred. Aroma/chemotype becomes predictable gameplay effects via the
        data-driven palette (data/terpene_effects.yaml; see
        knowledge-base/strain-classification-and-quality.md §3). Read-only; public.

        Unlike the encyclopedia, this works for bred strains too: it reads the
        strain's terpene tags plus its quantitative genome so a player's discovery
        carries a real, derived effect signature.
        """
        from . import effects_service

        strain = self.get_strain(strain_id)
        profile = effects_service.profile_for_strain(
            strain.terpenes or [], strain.genome or {}
        )
        return {
            "strain_id": strain.id,
            "name": strain.name,
            "slug": strain.slug,
            "rarity": strain.rarity,
            "terpene_tags": strain.terpenes or [],
            "profile": profile,
        }

    # ----- Harvest & sale -------------------------------------------------
    def _harvest_window(self, plant: Plant) -> str:
        """The trichome ripeness window for a plant at its CURRENT state — read
        from the same telemetry read-model the UI/3D bud use, so the harvest-
        timing reward matches what the grower sees in the 🔬 readout."""
        from ..simulation.engines.flowers import trichome_resin_gland as trg
        now = self._player_now(self.get_player(plant.player_id))
        fc = engine.stage_forecast(plant, self.cfg, now)
        sim = self.cfg.raw.get("simulation", {})
        pod = self.session.get(GrowPod, plant.pod_id)
        env = engine.environment_for(plant, pod, sim)
        genetics = trg.genetics_from_genes(
            engine._gene(plant, "thc", 18.0),
            engine._gene(plant, "vigor", 0.5),
            engine._gene(plant, "indica_ratio", 0.5),
        )
        tri = trg.telemetry(
            plant.growth_stage, fc.get("stage_progress_pct", 0.0),
            plant.health, env.get("light", 600.0), genetics, sim,
            water=plant.water_level, nutrient=plant.nutrient_level,
        )
        return tri["harvest_window"]

    def harvest_plant(
        self,
        player_id: str,
        plant_id: str,
        weight_g: Optional[float] = None,
        quality: Optional[float] = None,
        sell: bool = True,
    ) -> Harvest:
        plant = self.session.get(Plant, plant_id)
        if plant is None or plant.player_id != player_id:
            raise GameError("Plant not found")
        if plant.harvested:
            raise GameError("Plant already harvested")

        # Bring the plant's simulated state up to "now" so yield/quality reflect
        # how it was actually grown — on the owner's effective (turbo) clock so a
        # harvest taken under the speed faucet reflects the accelerated growth.
        engine.catch_up(self.session, plant, self._player_now(self.get_player(player_id)), self.cfg)

        strain = self.get_strain(plant.strain_id)
        fx = self._research(player_id)  # research-tree modifiers

        # Yield scales with health; quality is the plant's health at harvest,
        # nudged by WHEN it was cut: trichome ripeness window (peak/ripe reward,
        # too-early/overripe penalty). Owner-ratified, config-driven magnitudes.
        if quality is None:
            quality = max(0.0, min(100.0, plant.health))
            quality = max(0.0, quality + pricing.quality_window_delta(self._harvest_window(plant), self.cfg))
        if weight_g is None:
            midpoint = (strain.yield_min + strain.yield_max) / 2.0
            weight_g = round(midpoint * (0.4 + 0.6 * plant.health / 100.0), 1)

        # Research: yield multiplier + flat quality bonus (capped).
        weight_g = round(weight_g * (1.0 + fx.get("yield_pct", 0.0)), 1)
        q_cap = float(self.cfg.research.get("max_quality", 100))
        quality = max(0.0, min(q_cap, quality + fx.get("quality_bonus", 0.0)))

        thc_actual = (strain.thc_min + strain.thc_max) / 2.0
        cbd_actual = (strain.cbd_min + strain.cbd_max) / 2.0

        # Terpene expression scales with how well the plant was grown, plus any
        # terpene-boosting research.
        vigor_factor = 0.85 + 0.15 * max(0.0, min(100.0, plant.health)) / 100.0
        vigor_factor *= 1.0 + fx.get("terpene_pct", 0.0)
        terpenes = express_terpenes(plant.genome, vigor_factor)

        plant.harvested = True
        plant.growth_stage = GrowthStage.HARVEST.value

        harvest = Harvest(
            player_id=player_id,
            plant_id=plant_id,
            strain_id=strain.id,
            weight_g=weight_g,
            quality=quality,
            thc_actual=thc_actual,
            cbd_actual=cbd_actual,
            rarity_snapshot=strain.rarity,
            terpenes=terpenes,
        )
        self.session.add(harvest)
        self.session.flush()

        if sell:
            self._sell_harvest(harvest)

        leveling_service.award(self.session, player_id, "harvest", self.cfg)
        return harvest

    def cleanup_plant(self, player_id: str, plant_id: str, cleanup_cost: Optional[int] = None) -> None:
        """Pay GROW to remove a harvested or dead plant and free the pod slot.

        ARCHIVES the plant rather than deleting it: its `Harvest` row (and any
        `CupEntry.harvest_id` pointing at it) must stay valid forever, so the
        plant row is kept with `archived_at` set. `list_plants` (and therefore
        every "which plant is in this pod" read) excludes archived rows, so
        the pod reads as empty and ready for a new seed — same UX as a delete,
        without the dangling-FK risk a hard delete carried.
        """
        plant = self.session.get(Plant, plant_id)
        if plant is None or plant.player_id != player_id:
            raise GameError("Plant not found")
        if plant.is_alive and not plant.harvested:
            raise GameError("Plant must be harvested or dead before cleanup")
        if plant.archived_at is not None:
            raise GameError("This plant has already been cleaned up")
        if cleanup_cost is None:
            cleanup_cost = self.cfg.raw.get("simulation", {}).get("actions", {}).get(
                "pod_cleanup", {}
            ).get("cost", 25)
        cost = Decimal(str(cleanup_cost))
        post(self.session, player_id, -cost, LedgerEntryType.POD_CLEANUP,
             ref_type="plant", ref_id=plant_id)
        plant.archived_at = datetime.utcnow()
        self.session.flush()

    def _terpene_intensity(self, harvest: Harvest) -> float:
        """Strongest expressed terpene on a harvest (0..1), for the sale premium."""
        terps = harvest.terpenes or {}
        return max((float(v) for v in terps.values()), default=0.0)

    def _sell_harvest(self, harvest: Harvest) -> Decimal:
        """Post the NPC-market sale of a harvest and stamp it sold. Idempotent
        guard lives in the public callers."""
        value = pricing.harvest_value(
            harvest.weight_g,
            harvest.quality,
            harvest.rarity_snapshot,
            self.cfg,
            thc_actual=harvest.thc_actual or 15.0,
            terpene_intensity=self._terpene_intensity(harvest),
        )
        post(
            self.session,
            harvest.player_id,
            value,
            LedgerEntryType.HARVEST_SALE,
            ref_type="harvest",
            ref_id=harvest.id,
        )
        harvest.sale_value = value
        harvest.sold = True
        return value

    def _get_owned_harvest(self, player_id: str, harvest_id: str) -> Harvest:
        harvest = self.session.get(Harvest, harvest_id)
        if harvest is None or harvest.player_id != player_id:
            raise GameError("Harvest not found")
        return harvest

    def list_harvests(self, player_id: str) -> List[Harvest]:
        return (
            self.session.query(Harvest)
            .filter(Harvest.player_id == player_id)
            .order_by(Harvest.harvested_at.desc())
            .all()
        )

    def sell_harvest(self, player_id: str, harvest_id: str) -> Harvest:
        """Sell a stored (unsold) harvest to the NPC market."""
        harvest = self._get_owned_harvest(player_id, harvest_id)
        if harvest.sold:
            raise GameError("Harvest already sold")
        if harvest.cure_status == "curing":
            raise GameError("Finish curing this harvest before selling it")
        self._sell_harvest(harvest)
        return harvest

    # ----- Curing (post-harvest quality) ----------------------------------
    def start_cure(
        self, player_id: str, harvest_id: str, target_hours: Optional[float] = None
    ) -> Harvest:
        harvest = self._get_owned_harvest(player_id, harvest_id)
        if harvest.sold:
            raise GameError("Cannot cure a harvest that has been sold")
        if harvest.cure_status != "none":
            raise GameError(f"Harvest is already {harvest.cure_status}")

        c = self.cfg.curing
        default_hours = float(c.get("default_target_hours", 72))
        max_hours = float(c.get("max_target_hours", 336))
        hours = default_hours if target_hours is None else float(target_hours)
        if hours <= 0:
            raise GameError("Cure duration must be positive")
        hours = min(hours, max_hours)

        harvest.base_quality = harvest.quality
        harvest.cure_started_at = self.clock.now()
        harvest.cure_target_hours = hours
        harvest.cure_status = "curing"
        return harvest

    def finish_cure(
        self, player_id: str, harvest_id: str, sell: bool = False
    ) -> Harvest:
        harvest = self._get_owned_harvest(player_id, harvest_id)
        if harvest.cure_status != "curing":
            raise GameError("This harvest is not curing")

        cure_scale = 1.0 + self._research(player_id).get("cure_bonus_pct", 0.0)
        result = curing.cure_progress(
            harvest.base_quality if harvest.base_quality is not None else harvest.quality,
            harvest.cure_started_at,
            harvest.cure_target_hours or 0.0,
            self.clock.now(),
            self.cfg,
            bonus_scale=cure_scale,
        )
        if not result.done:
            raise GameError(
                f"Cure not finished yet ({result.elapsed_hours:.1f}h of "
                f"{harvest.cure_target_hours:.1f}h elapsed)"
            )

        harvest.quality = result.quality
        harvest.cure_quality_bonus = result.bonus
        harvest.cure_status = "cured"
        if sell:
            self._sell_harvest(harvest)
        return harvest

    # ----- Marketplace ----------------------------------------------------
    def list_market(self) -> List[MarketListing]:
        return (
            self.session.query(MarketListing)
            .filter(MarketListing.status == ListingStatus.ACTIVE.value)
            .order_by(MarketListing.created_at.desc())
            .all()
        )

    def create_seed_listing(
        self, player_id: str, seed_id: str, quantity: int, unit_price
    ) -> MarketListing:
        stack = self.session.get(SeedInventory, seed_id)
        if stack is None or stack.player_id != player_id:
            raise GameError("Seed not found in player's inventory")
        if quantity < 1 or stack.quantity < quantity:
            raise GameError("Not enough seeds to list")

        unit_price = to_money(unit_price)
        if unit_price <= 0:
            raise GameError("unit_price must be positive")

        # Escrow the seeds out of inventory and charge a listing fee (a sink).
        stack.quantity -= quantity
        fee = to_money(
            unit_price * quantity * Decimal(str(self.cfg.market["listing_fee_pct"]))
        )
        if fee > 0:
            post(
                self.session,
                player_id,
                -fee,
                LedgerEntryType.MARKET_FEE,
                ref_type="listing",
            )

        listing = MarketListing(
            seller_id=player_id,
            item_type=ListingItemType.SEED.value,
            item_ref_id=stack.strain_id,  # buyers receive seeds of this strain
            quantity=quantity,
            unit_price=unit_price,
        )
        self.session.add(listing)
        self.session.flush()
        return listing

    def buy_listing(self, buyer_id: str, listing_id: str) -> MarketListing:
        listing = self.session.get(MarketListing, listing_id)
        if listing is None or listing.status != ListingStatus.ACTIVE.value:
            raise GameError("Listing not available")
        if listing.seller_id == buyer_id:
            raise GameError("Cannot buy your own listing")

        total = to_money(listing.unit_price * listing.quantity)
        tax = to_money(total * Decimal(str(self.cfg.market["sale_tax_pct"])))
        seller_proceeds = to_money(total - tax)  # tax is burned (inflation sink)

        # Buyer pays the full price.
        post(
            self.session,
            buyer_id,
            -total,
            LedgerEntryType.MARKET_BUY,
            ref_type="listing",
            ref_id=listing_id,
        )
        # Seller receives proceeds net of tax.
        post(
            self.session,
            listing.seller_id,
            seller_proceeds,
            LedgerEntryType.MARKET_SALE,
            ref_type="listing",
            ref_id=listing_id,
        )

        # Deliver the goods (seeds) to the buyer.
        if listing.item_type == ListingItemType.SEED.value:
            stack = self._get_or_create_seed_stack(
                buyer_id, listing.item_ref_id, SeedSource.MARKET
            )
            stack.quantity += listing.quantity

        listing.status = ListingStatus.SOLD.value
        listing.buyer_id = buyer_id
        return listing

    # ----- Auctions -------------------------------------------------------
    def create_seed_auction(
        self, player_id: str, seed_id: str, quantity: int, min_bid, duration_hours: int = 24
    ) -> MarketListing:
        stack = self.session.get(SeedInventory, seed_id)
        if stack is None or stack.player_id != player_id:
            raise GameError("Seed not found in player's inventory")
        if quantity < 1 or stack.quantity < quantity:
            raise GameError("Not enough seeds to auction")
        min_bid = to_money(min_bid)
        if min_bid <= 0:
            raise GameError("min_bid must be positive")

        stack.quantity -= quantity  # escrow seeds
        listing = MarketListing(
            seller_id=player_id,
            item_type=ListingItemType.SEED.value,
            item_ref_id=stack.strain_id,
            quantity=quantity,
            unit_price=min_bid,
            is_auction=True,
            min_bid=min_bid,
            expires_at=self.clock.now() + timedelta(hours=duration_hours),
        )
        self.session.add(listing)
        self.session.flush()
        return listing

    def place_bid(self, bidder_id: str, listing_id: str, amount) -> MarketListing:
        listing = self.session.get(MarketListing, listing_id)
        if listing is None or not listing.is_auction or listing.status != ListingStatus.ACTIVE.value:
            raise GameError("Auction not available")
        if listing.seller_id == bidder_id:
            raise GameError("Cannot bid on your own auction")
        if listing.expires_at and self.clock.now() > listing.expires_at:
            raise GameError("Auction has ended")

        amount = to_money(amount)
        if amount < listing.min_bid:
            raise GameError(f"Bid must be at least the minimum {listing.min_bid}")
        # The first bid may equal min_bid; every later bid must beat the standing
        # high bid. (A previous version let a player re-bid min_bid even after the
        # floor had risen, undercutting the auction.)
        if listing.highest_bid is not None and amount <= listing.highest_bid:
            raise GameError(f"Bid must exceed the current bid of {listing.highest_bid}")

        # Hold the new bid (refund the previous high bidder first).
        post(self.session, bidder_id, -amount, LedgerEntryType.AUCTION_BID,
             ref_type="auction", ref_id=listing_id)
        if listing.highest_bidder_id and listing.highest_bid:
            post(self.session, listing.highest_bidder_id, listing.highest_bid,
                 LedgerEntryType.AUCTION_REFUND, ref_type="auction", ref_id=listing_id)

        listing.highest_bid = amount
        listing.highest_bidder_id = bidder_id
        return listing

    def settle_auction(self, player_id: str, listing_id: str) -> MarketListing:
        listing = self.session.get(MarketListing, listing_id)
        if listing is None or not listing.is_auction:
            raise GameError("Auction not found")
        if listing.seller_id != player_id:
            raise GameError("Only the seller can settle this auction")
        if listing.status != ListingStatus.ACTIVE.value:
            raise GameError(f"Auction already {listing.status}")
        if listing.expires_at and self.clock.now() < listing.expires_at:
            raise GameError("Auction has not ended yet")

        if listing.highest_bidder_id:
            tax = to_money(listing.highest_bid * Decimal(str(self.cfg.market["sale_tax_pct"])))
            seller_proceeds = to_money(listing.highest_bid - tax)  # tax burned
            post(self.session, listing.seller_id, seller_proceeds,
                 LedgerEntryType.MARKET_SALE, ref_type="auction", ref_id=listing_id)
            stack = self._get_or_create_seed_stack(
                listing.highest_bidder_id, listing.item_ref_id, SeedSource.MARKET
            )
            stack.quantity += listing.quantity
            listing.status = ListingStatus.SOLD.value
            listing.buyer_id = listing.highest_bidder_id
        else:
            # No bids: return the escrowed seeds to the seller.
            stack = self._get_or_create_seed_stack(
                listing.seller_id, listing.item_ref_id, SeedSource.MARKET
            )
            stack.quantity += listing.quantity
            listing.status = ListingStatus.EXPIRED.value
        return listing
