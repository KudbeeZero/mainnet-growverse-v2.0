"""
Serializers turning ORM rows into JSON-safe dicts (Decimal -> float, datetime
-> ISO string). Kept separate from the ORM so the wire format is explicit.
"""

from decimal import Decimal
from typing import Any


def _money(value: Any) -> Any:
    if value is None:
        return None
    return float(value) if isinstance(value, Decimal) else value


def _ts(value: Any) -> Any:
    return value.isoformat() if value is not None else None


def player_dict(player, balance=None) -> dict:
    out = {
        "id": player.id,
        "username": player.username,
        "email": player.email,
        "algorand_address": player.algorand_address,
        "xp": getattr(player, "xp", 0),
        "level": getattr(player, "level", 1),
        "cannabis_cup_title": getattr(player, "cannabis_cup_title", None),
        "university_title": getattr(player, "university_title", None),
        # Global 10× speed faucet state (per account) so the UI toggle reflects
        # the server, not a client guess.
        "turbo_enabled": bool(getattr(player, "turbo_enabled", False)),
        "created_at": _ts(player.created_at),
    }
    if balance is not None:
        out["balance"] = _money(balance)
    return out


def wallet_dict(wallet) -> dict:
    return {
        "id": wallet.id,
        "player_id": wallet.player_id,
        "balance": _money(wallet.cached_balance),
        "asa_balance": _money(wallet.asa_balance),
        "version": wallet.version,
    }


def strain_dict(strain) -> dict:
    from ..genetics.traits import bud_dna_from_genome
    return {
        "id": strain.id,
        "name": strain.name,
        "slug": strain.slug,
        "lineage_type": strain.lineage_type,
        "rarity": strain.rarity,
        "indica_ratio": strain.indica_ratio,
        "thc_range": [strain.thc_min, strain.thc_max],
        "cbd_range": [strain.cbd_min, strain.cbd_max],
        "flowering_days": [strain.flowering_days_min, strain.flowering_days_max],
        "yield_range": [strain.yield_min, strain.yield_max],
        "difficulty": strain.difficulty,
        "season": getattr(strain, "season", "all"),
        "terpenes": strain.terpenes,
        "stability": strain.stability,
        "generation": strain.generation,
        "parent_a_id": strain.parent_a_id,
        "parent_b_id": strain.parent_b_id,
        "is_base_catalog": strain.is_base_catalog,
        "genome": strain.genome,
        "bud_dna": bud_dna_from_genome(strain.genome) if strain.genome else None,
        "nft_asset_id": strain.nft_asset_id,
        "nft_status": strain.nft_status,
    }


def seed_dict(stack) -> dict:
    return {
        "id": stack.id,
        "strain_id": stack.strain_id,
        "quantity": stack.quantity,
        "source": stack.source,
        "feminized": stack.feminized,
    }


def pod_dict(pod) -> dict:
    out = {
        "id": pod.id,
        "player_id": pod.player_id,
        "name": pod.name,
        "capacity": pod.capacity,
        "tier": pod.tier,
        "active": pod.active,
        "auto_water": pod.auto_water,
        "auto_feed": pod.auto_feed,
        # Current environment setpoints (nullable until the player sets them).
        # Exposed so the web client can seed the climate controls with the pod's
        # real values instead of guessing defaults.
        "temperature": pod.temperature,
        "humidity": pod.humidity,
        "co2_level": pod.co2_level,
        "light_intensity": pod.light_intensity,
        "ph_level": pod.ph_level,
    }
    out["equipped_gear"], out["gear_effects"] = _pod_gear(pod)
    return out


def _pod_gear(pod) -> tuple:
    """Equipped gear + merged net effects for this pod (feeds the chamber's
    equipped-gear visuals, ROADMAP_90D week 4). Reads via the pod's own bound
    session (every caller already holds `pod` inside an active
    `session_scope()`), so no existing `pod_dict` call site needs to change."""
    from dataclasses import asdict

    from sqlalchemy.orm import object_session

    from ..db.models import GearInventory
    from ..economy.config import get_economy_config
    from ..simulation import gear as gear_sim

    session = object_session(pod)
    rows = []
    if session is not None:
        rows = (
            session.query(GearInventory)
            .filter(GearInventory.equipped_pod_id == pod.id)
            .all()
        )
    catalog = get_economy_config().shop_gear
    equipped = [
        {
            "gear_key": r.gear_key,
            "category": r.category,
            "name": catalog.get(r.gear_key, {}).get("name", r.gear_key),
        }
        for r in rows
    ]
    effects = gear_sim.effects_for([{"gear_key": r.gear_key} for r in rows], catalog)
    return equipped, asdict(effects)


def plant_dict(plant, metrics=None) -> dict:
    out = {
        "id": plant.id,
        "player_id": plant.player_id,
        "pod_id": plant.pod_id,
        "strain_id": plant.strain_id,
        "growth_stage": plant.growth_stage,
        "planted_at": _ts(plant.planted_at),
        "height": plant.height,
        "health": plant.health,
        "water_level": plant.water_level,
        "nutrient_level": plant.nutrient_level,
        "pest_level": plant.pest_level,
        "disease_level": plant.disease_level,
        "condition_flags": plant.condition_flags,
        "is_alive": plant.is_alive,
        "harvested": plant.harvested,
        "care_streak": getattr(plant, "care_streak", 0),
        "resin_score": getattr(plant, "resin_score", 0.0),
    }
    # Scientist-grade derived readouts (VPD, DLI, PPFD) when the caller supplies
    # them — additive, so existing consumers are unaffected.
    if metrics is not None:
        out["metrics"] = metrics
    return out


def harvest_dict(harvest) -> dict:
    # Lazy import keeps this serializer module pure/light at load time. The
    # effect profile is derived from the *expressed* terpenes of THIS batch, so a
    # well-grown harvest carries a real, grow-dependent effect signature.
    from ..services.effects_service import effect_profile

    return {
        "id": harvest.id,
        "player_id": harvest.player_id,
        "plant_id": harvest.plant_id,
        "strain_id": harvest.strain_id,
        "weight_g": harvest.weight_g,
        "quality": harvest.quality,
        "thc_actual": harvest.thc_actual,
        "cbd_actual": harvest.cbd_actual,
        "rarity": harvest.rarity_snapshot,
        "terpenes": harvest.terpenes or {},
        "effect_profile": effect_profile(harvest.terpenes or {}),
        "sale_value": _money(harvest.sale_value),
        "sold": harvest.sold,
        "cure_status": harvest.cure_status,
        "cure_started_at": _ts(harvest.cure_started_at),
        "cure_target_hours": harvest.cure_target_hours,
        "cure_quality_bonus": harvest.cure_quality_bonus,
        "harvested_at": _ts(harvest.harvested_at),
        "nft_asset_id": harvest.nft_asset_id,
        "nft_status": harvest.nft_status,
    }


def listing_dict(listing) -> dict:
    return {
        "id": listing.id,
        "seller_id": listing.seller_id,
        "item_type": listing.item_type,
        "item_ref_id": listing.item_ref_id,
        "quantity": listing.quantity,
        "unit_price": _money(listing.unit_price),
        "status": listing.status,
        "buyer_id": listing.buyer_id,
        "is_auction": listing.is_auction,
        "min_bid": _money(listing.min_bid),
        "highest_bid": _money(listing.highest_bid),
        "highest_bidder_id": listing.highest_bidder_id,
        "expires_at": _ts(listing.expires_at),
    }


def event_dict(event) -> dict:
    return {
        "id": event.id,
        "plant_id": event.plant_id,
        "timestamp": _ts(event.timestamp),
        "event_type": event.event_type,
        "severity": event.severity,
        "payload": event.payload,
    }


def contract_dict(contract) -> dict:
    return {
        "id": contract.id,
        "description": contract.description,
        "target_rarity": contract.target_rarity,
        "target_grams": contract.target_grams,
        "reward_grow": _money(contract.reward_grow),
        "reward_xp": contract.reward_xp,
        "status": contract.status,
        "deadline_at": _ts(contract.deadline_at),
        "fulfilled_at": _ts(contract.fulfilled_at),
    }


def enrollment_dict(e) -> dict:
    return {
        "id": e.id,
        "player_id": e.player_id,
        "course_key": e.course_key,
        "status": e.status,
        "started_at": _ts(e.started_at),
        "completed_at": _ts(e.completed_at),
    }


def cup_dict(cup) -> dict:
    return {
        "id": cup.id,
        "edition": cup.edition,
        "season": cup.season,
        "title": cup.title,
        "status": cup.status,
        "entry_fee": _money(cup.entry_fee),
        "prize_pool": _money(cup.prize_pool),
        "starts_at": _ts(cup.starts_at),
        "ends_at": _ts(cup.ends_at),
        "judged_at": _ts(cup.judged_at),
        "winner_id": cup.winner_id,
        "champion_strain_id": cup.champion_strain_id,
    }


def cup_entry_dict(entry) -> dict:
    return {
        "id": entry.id,
        "cup_id": entry.cup_id,
        "player_id": entry.player_id,
        "strain_id": entry.strain_id,
        "strain_name": entry.strain_name,
        "score": entry.score,
        "rank": entry.rank,
        "prize_grow": _money(entry.prize_grow),
        "submitted_at": _ts(entry.submitted_at),
    }


def ledger_dict(entry) -> dict:
    return {
        "id": entry.id,
        "entry_type": entry.entry_type,
        "amount": _money(entry.amount),
        "balance_after": _money(entry.balance_after),
        "ref_type": entry.ref_type,
        "ref_id": entry.ref_id,
        "created_at": _ts(entry.created_at),
    }
