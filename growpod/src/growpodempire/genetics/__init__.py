"""
Genetics: strain trait definitions and the deterministic breeding engine.
"""

from .traits import TRAIT_SPECS, Dominance, genome_from_traits, normalize_genome
from .breeding import cross, CrossResult, derive_strain_fields, assign_rarity

__all__ = [
    "TRAIT_SPECS",
    "Dominance",
    "genome_from_traits",
    "normalize_genome",
    "cross",
    "CrossResult",
    "derive_strain_fields",
    "assign_rarity",
]
