"""
Trait definitions for the genetics engine.

A *genome* is a dict mapping trait name -> {"value": float, "dominance": str}.
Each trait has a valid range and a base segregation sigma (as a fraction of its
range) that controls how much offspring vary from the parental mean.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict


class Dominance(str, Enum):
    DOMINANT = "dominant"
    RECESSIVE = "recessive"
    CODOMINANT = "codominant"


@dataclass(frozen=True)
class TraitSpec:
    low: float
    high: float
    sigma_frac: float  # base variance as a fraction of (high - low)
    is_int: bool = False

    def clamp(self, value: float) -> float:
        v = max(self.low, min(self.high, value))
        return round(v) if self.is_int else v

    @property
    def span(self) -> float:
        return self.high - self.low


# Quantitative terpene intensities (0..1) that inherit through breeding and are
# expressed on a harvest. Their qualitative names also drive flavour/effect copy.
TERPENE_TRAITS = ("myrcene", "limonene", "caryophyllene", "pinene")
_TERPENE_BASELINE = 0.12   # a terpene the strain doesn't lead with
_TERPENE_PRESENT = 0.70    # a terpene listed in the catalog's `terpenes` tags

# Visible traits drive display stats; hidden traits (resistances/vigor) feed the
# Phase 2 simulation but still inherit through breeding.
TRAIT_SPECS: Dict[str, TraitSpec] = {
    "indica_ratio": TraitSpec(0.0, 1.0, 0.12),
    "thc": TraitSpec(0.0, 35.0, 0.10),
    "cbd": TraitSpec(0.0, 25.0, 0.12),
    "flowering_time": TraitSpec(45.0, 120.0, 0.08, is_int=True),
    "yield": TraitSpec(50.0, 800.0, 0.10),
    "difficulty": TraitSpec(1.0, 5.0, 0.10, is_int=True),
    "disease_resistance": TraitSpec(0.0, 1.0, 0.12),
    "pest_resistance": TraitSpec(0.0, 1.0, 0.12),
    "vigor": TraitSpec(0.0, 1.0, 0.10),
    # Terpenes segregate a bit more widely than other 0..1 traits.
    **{t: TraitSpec(0.0, 1.0, 0.14) for t in TERPENE_TRAITS},
}

# Sensible defaults for hidden traits when a catalog entry omits them.
HIDDEN_TRAIT_DEFAULTS = {
    "disease_resistance": 0.5,
    "pest_resistance": 0.5,
    "vigor": 0.5,
    **{t: _TERPENE_BASELINE for t in TERPENE_TRAITS},
}


def terpene_genes_from_tags(tags) -> Dict[str, float]:
    """Map a catalog strain's qualitative `terpenes` tags to quantitative gene
    values: a listed terpene leads (high), the rest sit at a low baseline. This
    lets the existing tag data seed the genome; breeding then varies it."""
    present = {str(t).lower() for t in (tags or [])}
    return {
        t: (_TERPENE_PRESENT if t in present else _TERPENE_BASELINE)
        for t in TERPENE_TRAITS
    }


def express_terpenes(genome: Dict, vigor_factor: float = 1.0) -> Dict[str, float]:
    """Expressed terpene vector for a harvest: the genome's terpene intensities
    scaled by how well the plant was grown (`vigor_factor`, ~0.85..1.0)."""
    g = normalize_genome(genome)
    spec = TRAIT_SPECS[TERPENE_TRAITS[0]]
    return {
        t: round(spec.clamp(g[t]["value"] * vigor_factor), 4) for t in TERPENE_TRAITS
    }


def normalize_genome(genome: Dict) -> Dict[str, Dict]:
    """Ensure every known trait is present and clamped, with a dominance flag."""
    out: Dict[str, Dict] = {}
    for trait, spec in TRAIT_SPECS.items():
        gene = genome.get(trait)
        if gene is None:
            value = HIDDEN_TRAIT_DEFAULTS.get(trait, (spec.low + spec.high) / 2.0)
            dominance = Dominance.CODOMINANT.value
        else:
            value = spec.clamp(float(gene["value"]))
            dominance = gene.get("dominance", Dominance.CODOMINANT.value)
        out[trait] = {"value": spec.clamp(value), "dominance": dominance}
    return out


def genome_from_traits(
    traits: Dict[str, float], dominant: Dict[str, str] = None
) -> Dict[str, Dict]:
    """Build a normalized genome from a flat trait->value mapping.

    `dominant` optionally maps trait -> dominance flag; unspecified traits are
    codominant. Used by the strain-catalog seeder.
    """
    dominant = dominant or {}
    genome: Dict[str, Dict] = {}
    for trait in TRAIT_SPECS:
        if trait in traits:
            value = float(traits[trait])
        else:
            value = HIDDEN_TRAIT_DEFAULTS.get(trait)
            if value is None:
                continue
        genome[trait] = {
            "value": value,
            "dominance": dominant.get(trait, Dominance.CODOMINANT.value),
        }
    return normalize_genome(genome)


def _clamp(v: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, v))


def bud_dna_from_genome(genome: Dict) -> Dict[str, float]:
    """Derive a visual BudDNA profile from a strain genome.

    Returns a dict of float scalars (0..1 or 0..100+) that the frontend's
    budDnaFor can interpret alongside authored presets. Every trait in the
    genome contributes to a unique phenotype:
      - indica_ratio → shape (chunky vs airy)
      - thc/cbd → frost & colouration
      - yield → bud size
      - terpenes → anthocyanin (purple shift) & calyx hue shift
    """
    g = normalize_genome(genome)

    indica = g["indica_ratio"]["value"]
    thc = g["thc"]["value"]
    cbd = g["cbd"]["value"]
    yield_val = g["yield"]["value"]
    flowering = g["flowering_time"]["value"]
    myrcene = g["myrcene"]["value"]
    limonene = g["limonene"]["value"]
    cary = g["caryophyllene"]["value"]
    pinene = g["pinene"]["value"]
    vigor = g["vigor"]["value"]

    # 1. Frost (trichome density) — driven by THC and overall vigor
    trichome_density = 0.5 + (thc / 35.0) * 0.5 + (vigor - 0.5) * 0.2

    # 2. Anthocyanin (purple shift) — caryophyllene is the strongest signal
    anthocyanin = cary * 0.7 + cbd * 0.15 + (0.1 if vigor > 0.7 else 0)
    # Warm-terpene strains (myrcene, limonene) resist purple
    anthocyanin = max(0, anthocyanin - (myrcene + limonene) * 0.2)

    # 3. Calyx hue — base green, shifted by dominant terpene
    # Myrcene → warmer (lime/orange), Pinene → cooler green, Limonene → yellow
    max_terpene = max(myrcene, limonene, cary, pinene)
    calyx_hue = 110  # base green
    if max_terpene == myrcene:
        calyx_hue = 98  # warm lime
    elif max_terpene == limonene:
        calyx_hue = 92  # bright yellow-green
    elif max_terpene == cary and cary > 0.4:
        calyx_hue = 282  # purple calyxes
    elif max_terpene == pinene:
        calyx_hue = 118  # forest green
    # Myrcene heavy also pushes pistils toward magenta
    pistil_magenta = myrcene * 0.35

    # 4. Bud shape — indica ratio dominates
    # Indica = chunky, short, wide (maxBudWidth high, budHeight low)
    # Sativa = tall, airy, slim (maxBudWidth low, budHeight high)
    bud_height = 140 + (1 - indica) * 50  # 140–190 (indica→sativa)
    max_bud_width = 60 + indica * 45  # 60–105 (sativa→indica)
    rows = 14 + round(indica * 6)  # 14–20
    calyx_per_row_min = 3 + round(indica * 1)
    calyx_per_row_max = 6 + round(indica * 2)
    calyx_size_min = 6 + round(indica * 3)
    calyx_size_max = 12 + round(indica * 5)
    overlap = 0.65 + indica * 0.08
    pistil_chance = 0.28 + indica * 0.06
    sugar_leaf_chance = 0.1 + indica * 0.03

    # 5. Yield boost — high-yield = bigger buds
    yield_factor = _clamp(yield_val / 500, 0, 1)
    max_bud_width *= (1 + yield_factor * 0.15)
    calyx_size_max *= (1 + yield_factor * 0.1)
    rows += round(yield_factor * 2)

    # 6. Flowering stretch — long-flowering strains = slightly taller
    stretch_factor = (flowering - 45) / 75  # 0–1
    bud_height *= (1 + stretch_factor * 0.1)

    # 7. Difficulty → foxtail bias (unstable genetics = more foxtails)
    difficulty = g["difficulty"]["value"]
    foxtail_bias = _clamp((difficulty - 3) / 2.0, 0, 1) * 0.2

    return {
        "bud_height": round(bud_height, 1),
        "max_bud_width": round(max_bud_width, 1),
        "rows": int(rows),
        "calyx_per_row_min": int(calyx_per_row_min),
        "calyx_per_row_max": int(calyx_per_row_max),
        "calyx_size_min": int(calyx_size_min),
        "calyx_size_max": int(calyx_size_max),
        "overlap": round(overlap, 2),
        "pistil_chance": round(pistil_chance, 2),
        "sugar_leaf_chance": round(sugar_leaf_chance, 2),
        "trichome_density": round(_clamp(trichome_density, 0.2, 1.0), 2),
        "anthocyanin": round(_clamp(anthocyanin, 0, 1), 2),
        "calyx_hue": round(calyx_hue),
        "calyx_sat": round(45 + (thc / 35) * 15, 0),
        "pistil_magenta": round(_clamp(pistil_magenta, 0, 1), 2),
        "foxtail_bias": round(foxtail_bias, 2),
    }
