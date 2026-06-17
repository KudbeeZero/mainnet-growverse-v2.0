"""
Deterministic crossbreeding engine.

`cross()` takes two parent genomes, their stabilities, and an injected
`random.Random` instance — given the same seed it always produces the same
offspring, which makes breeding fully reproducible and unit-testable. The RNG
seed is persisted on the BreedingEvent for audit/replay.
"""

import random
from dataclasses import dataclass, field
from typing import Dict, Tuple

from ..enums import Rarity, RARITY_ORDER, rarity_index
from .traits import TRAIT_SPECS, Dominance, normalize_genome


@dataclass
class CrossResult:
    genome: Dict[str, Dict]
    stability: float
    generation: int
    inherited_traits: Dict[str, str] = field(default_factory=dict)  # trait -> parent


def _blend(a: float, da: str, b: float, db: str) -> Tuple[float, str]:
    """Combine two parental gene values according to dominance.

    Returns (base_value, contributing_parent) where contributing_parent is
    "a", "b", or "both".
    """
    dom = Dominance
    if da == dom.DOMINANT.value and db == dom.RECESSIVE.value:
        return 0.75 * a + 0.25 * b, "a"
    if db == dom.DOMINANT.value and da == dom.RECESSIVE.value:
        return 0.75 * b + 0.25 * a, "b"
    # Equal footing (both dominant, both recessive, or codominant) -> mean.
    return (a + b) / 2.0, "both"


def cross(
    parent_a_genome: Dict,
    parent_b_genome: Dict,
    rng: random.Random,
    *,
    stability_a: float = 1.0,
    stability_b: float = 1.0,
    generation_a: int = 0,
    generation_b: int = 0,
) -> CrossResult:
    """Cross two genomes into an offspring genome (deterministic given `rng`)."""
    ga = normalize_genome(parent_a_genome)
    gb = normalize_genome(parent_b_genome)

    # Less-stable parents segregate more widely.
    instability = 1.0 - min(stability_a, stability_b)

    offspring: Dict[str, Dict] = {}
    provenance: Dict[str, str] = {}

    for trait, spec in TRAIT_SPECS.items():
        a_val, a_dom = ga[trait]["value"], ga[trait]["dominance"]
        b_val, b_dom = gb[trait]["value"], gb[trait]["dominance"]

        base, parent = _blend(a_val, a_dom, b_val, b_dom)

        sigma = spec.sigma_frac * spec.span * instability
        value = base + (rng.gauss(0.0, sigma) if sigma > 0 else 0.0)
        value = spec.clamp(value)

        # Dominance inheritance: 75% chance to carry the dominant parent's flag.
        if a_dom == Dominance.DOMINANT.value and b_dom != Dominance.DOMINANT.value:
            inherited_dom = a_dom if rng.random() < 0.75 else b_dom
        elif b_dom == Dominance.DOMINANT.value and a_dom != Dominance.DOMINANT.value:
            inherited_dom = b_dom if rng.random() < 0.75 else a_dom
        else:
            inherited_dom = a_dom if rng.random() < 0.5 else b_dom

        offspring[trait] = {"value": value, "dominance": inherited_dom}
        provenance[trait] = parent

    # Fresh F1 crosses are unstable; stabilization is earned over generations.
    new_stability = min(1.0, (stability_a + stability_b) / 2.0 * 0.6 + 0.1)
    generation = max(generation_a, generation_b) + 1

    return CrossResult(
        genome=offspring,
        stability=new_stability,
        generation=generation,
        inherited_traits=provenance,
    )


def derive_strain_fields(genome: Dict, stability: float) -> Dict:
    """Derive display strain columns (thc_min/max, flowering range, etc.) from a
    genome. Lower stability => wider expressed ranges around each gene value.
    """
    g = normalize_genome(genome)
    spread = (1.0 - stability)  # 0 (true-breeding) .. 1 (wild)

    def rng_band(trait: str, frac: float, lo: float, hi: float):
        v = g[trait]["value"]
        delta = frac * spread * (hi - lo)
        return max(lo, v - delta), min(hi, v + delta)

    thc_lo, thc_hi = rng_band("thc", 0.25, 0.0, 35.0)
    cbd_lo, cbd_hi = rng_band("cbd", 0.25, 0.0, 25.0)
    flo = g["flowering_time"]["value"]
    flo_delta = 0.15 * spread * 75.0
    yld = g["yield"]["value"]
    yld_delta = 0.20 * spread * 750.0

    return {
        "indica_ratio": round(g["indica_ratio"]["value"], 4),
        "thc_min": round(thc_lo, 2),
        "thc_max": round(thc_hi, 2),
        "cbd_min": round(cbd_lo, 2),
        "cbd_max": round(cbd_hi, 2),
        "flowering_days_min": int(round(max(45.0, flo - flo_delta))),
        "flowering_days_max": int(round(min(120.0, flo + flo_delta))),
        "yield_min": round(max(50.0, yld - yld_delta), 1),
        "yield_max": round(min(800.0, yld + yld_delta), 1),
        "difficulty": int(round(g["difficulty"]["value"])),
    }


def assign_rarity(
    genome: Dict,
    stability: float,
    parent_rarities: Tuple[str, str],
) -> Rarity:
    """Assign offspring rarity from parents, trait extremeness, and stability.

    A stabilized, high-potency novel cross can climb tiers — the prestige loop
    that later feeds NFT minting.
    """
    g = normalize_genome(genome)
    base_tier = max(rarity_index(parent_rarities[0]), rarity_index(parent_rarities[1]))

    score = 0.0
    # Reward extreme THC and yield.
    if g["thc"]["value"] >= 28.0:
        score += 1.0
    elif g["thc"]["value"] >= 24.0:
        score += 0.5
    if g["yield"]["value"] >= 650.0:
        score += 0.5
    # Reward a stabilized (true-breeding) line.
    if stability >= 0.85:
        score += 1.0
    elif stability >= 0.7:
        score += 0.5

    tier = base_tier + int(round(score)) - 1  # fresh crosses usually drop a tier
    tier = max(0, min(len(RARITY_ORDER) - 1, tier))
    return RARITY_ORDER[tier]
