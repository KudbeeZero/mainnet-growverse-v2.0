"""
ARC-3 NFT metadata builders for strains and harvests.

Produces the JSON document an NFT's `url` (with the `#arc3` suffix) points at,
plus a 32-byte metadata hash for on-chain integrity.
"""

import hashlib
import json
from typing import Dict


def metadata_hash(metadata: Dict) -> bytes:
    """SHA-256 of the canonical metadata JSON (32 bytes for the ASA field)."""
    canonical = json.dumps(metadata, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(canonical).digest()


def seed_metadata(seed: Dict) -> Dict:
    """ARC-3 metadata for a Clone Room seed NFT (minted at plant time).

    The seed's genetics are deterministic — re-derivable from
    blockHash + ownerAddress + nonce — so anchoring those entropy inputs (and
    the derived traits) in the metadata makes the on-chain asset independently
    verifiable. `seed` is the plant_seeds row as JSON from the TS api-server.
    """
    traits = seed.get("traits") or {}
    family = traits.get("strainFamily", "seed")
    generation = seed.get("generationNum", 0)
    return {
        "name": f"{family} Seed"[:32],
        "description": (
            f"GrowPodEmpire Clone Room seed — {family} genetics, "
            f"generation {generation}."
        ),
        "decimals": 0,
        "properties": {
            "type": "seed",
            "seed_id": seed.get("seedId"),
            "owner_address": seed.get("ownerAddress"),
            "generation": generation,
            "parent_seed_id": seed.get("parentSeedId"),
            # Entropy inputs — anyone can re-derive the genetics from these.
            "block_hash": seed.get("blockHash"),
            "nonce": seed.get("nonce"),
            "traits": traits,
        },
    }


def clone_room_harvest_metadata(harvest: Dict) -> Dict:
    """ARC-3 metadata for a Clone Room Harvest NFT (proof-of-play).

    Unlike :func:`harvest_metadata` (which serializes a Python game harvest +
    strain), this builds the proof-of-play token described in Manual Section
    8.3 from the JSON the TS api-server sends: it records the parent seed, the
    grow id, the rarity tier and the player's full resolved story-event journey,
    so the completed grow is an independently verifiable record.
    """
    rarity = harvest.get("rarityTier", "common")
    story = harvest.get("storyEvents") or []
    return {
        "name": f"{rarity} Harvest"[:32],
        "description": (
            f"GrowPodEmpire Clone Room harvest — rarity {rarity}, "
            f"{len(story)} story event(s)."
        ),
        "decimals": 0,
        "properties": {
            "type": "harvest",
            "grow_id": harvest.get("growId"),
            "parent_seed_id": harvest.get("parentSeedId"),
            "owner_address": harvest.get("ownerAddress"),
            "rarity": rarity,
            "tend_actions": harvest.get("tendActions"),
            "parent_plot_biome": harvest.get("parentPlotBiome"),
            "story_events": story,
        },
    }


def strain_metadata(strain) -> Dict:
    """ARC-3 metadata for a (stabilized, rare) strain NFT."""
    return {
        "name": strain.name,
        "description": f"GrowPodEmpire genetics — {strain.rarity} strain, "
        f"generation {strain.generation}.",
        "decimals": 0,
        "properties": {
            "type": "strain",
            "rarity": strain.rarity,
            "lineage_type": strain.lineage_type,
            "indica_ratio": strain.indica_ratio,
            "thc_range": [strain.thc_min, strain.thc_max],
            "cbd_range": [strain.cbd_min, strain.cbd_max],
            "flowering_days": [strain.flowering_days_min, strain.flowering_days_max],
            "stability": strain.stability,
            "generation": strain.generation,
            "terpenes": strain.terpenes,
        },
    }


def harvest_metadata(harvest, strain) -> Dict:
    """ARC-3 metadata for a premium harvest NFT."""
    return {
        "name": f"{strain.name} Harvest",
        "description": f"GrowPodEmpire harvest — {harvest.weight_g}g of "
        f"{strain.name} at quality {round(harvest.quality, 1)}.",
        "decimals": 0,
        "properties": {
            "type": "harvest",
            "strain": strain.name,
            "rarity": harvest.rarity_snapshot,
            "weight_g": harvest.weight_g,
            "quality": harvest.quality,
            "thc": harvest.thc_actual,
            "cbd": harvest.cbd_actual,
            "harvested_at": harvest.harvested_at.isoformat()
            if harvest.harvested_at
            else None,
        },
    }
