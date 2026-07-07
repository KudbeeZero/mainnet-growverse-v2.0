"""Pure gear-effect merging (ROADMAP_90D week 2-3).

Equipped fans/soils shift the simulation through a data-driven `effects`
block in each catalog entry (`balance.yaml` `shop.gear.*`) — see
`GearEffects` for the supported keys. `effects_for` merges every equipped
item's block into one clamped, deterministic result.

Lights stay the separate, already-functional mechanism (PPFD written
directly to `GrowPod.light_intensity` by `GameService.equip_gear`); light
catalog entries carry no `effects` block, so an equipped light contributes
nothing here — no double-application.

No DB, no randomness: `catch_up` (impure) reads the equipped `GearInventory`
rows and passes plain dicts in here.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

# Sane bounds so no combination of equipped gear can run away.
_OFFSET_BOUND = 10.0
_MULT_LOW, _MULT_HIGH = 0.5, 1.5


@dataclass(frozen=True)
class GearEffects:
    """A merged, clamped view of every equipped item's `effects` block.

    Every field is neutral (no-op) by default, so "no gear equipped"
    reproduces the pre-gear-effects engine exactly — the invariant
    `tests/test_engine_parity.py` guards.
    """

    temp_offset_c: float = 0.0
    humidity_offset_pct: float = 0.0
    pest_spawn_mult: float = 1.0
    disease_growth_mult: float = 1.0
    water_decay_mult: float = 1.0
    nutrient_decay_mult: float = 1.0
    flowering_quality_bonus: float = 0.0


def _clamp_offset(v: float) -> float:
    return max(-_OFFSET_BOUND, min(_OFFSET_BOUND, v))


def _clamp_mult(v: float) -> float:
    return max(_MULT_LOW, min(_MULT_HIGH, v))


def effects_for(equipped: Optional[List[Dict]], catalog: Optional[Dict]) -> GearEffects:
    """Merge the `effects` blocks of every equipped gear item.

    `equipped` — dicts with a `gear_key` (one entry per equipped item, any
    category — the caller is responsible for "one per category per pod").
    `catalog` — the flattened gear catalog (`EconomyConfig.shop_gear`,
    `gear_key -> item`). Offsets sum across equipped items; multipliers
    compound (multiply); each is clamped independently after merging so no
    combination of equipped gear can run away past the sane bounds.
    """
    temp_offset = 0.0
    humidity_offset = 0.0
    pest_mult = 1.0
    disease_mult = 1.0
    water_mult = 1.0
    nutrient_mult = 1.0
    flowering_bonus = 0.0

    for item in equipped or []:
        key = (item or {}).get("gear_key")
        entry = (catalog or {}).get(key) or {}
        fx = entry.get("effects") or {}
        temp_offset += float(fx.get("temp_offset_c", 0.0))
        humidity_offset += float(fx.get("humidity_offset_pct", 0.0))
        pest_mult *= float(fx.get("pest_spawn_mult", 1.0))
        disease_mult *= float(fx.get("disease_growth_mult", 1.0))
        water_mult *= float(fx.get("water_decay_mult", 1.0))
        nutrient_mult *= float(fx.get("nutrient_decay_mult", 1.0))
        flowering_bonus += float(fx.get("flowering_quality_bonus", 0.0))

    return GearEffects(
        temp_offset_c=_clamp_offset(temp_offset),
        humidity_offset_pct=_clamp_offset(humidity_offset),
        pest_spawn_mult=_clamp_mult(pest_mult),
        disease_growth_mult=_clamp_mult(disease_mult),
        water_decay_mult=_clamp_mult(water_mult),
        nutrient_decay_mult=_clamp_mult(nutrient_mult),
        flowering_quality_bonus=flowering_bonus,
    )
