"""
Effects service — the terpene -> effect (buff) engine.

This is the mechanical bridge the knowledge base calls out: a strain's aroma
(its terpene chemotype) becomes predictable gameplay effects, not just flavor
text. See knowledge-base/strain-classification-and-quality.md §3.

Pure + data-driven: all tuning lives in data/terpene_effects.yaml (the palette
+ buff weights). This module only reads that table and computes a profile from a
terpene-intensity vector. It is player-neutral and stateless — no DB, no economy
side effects — so it can be unit-tested in isolation and called from read-only
API endpoints without touching gameplay truth.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Mapping, Optional

import yaml

from ..config import get_settings

# Intensities derived from qualitative catalog `terpenes` tags. Mirrors the
# present/baseline split used by genetics.traits.terpene_genes_from_tags so a
# tag-listed terpene "leads" and the rest sit at a low baseline.
PRESENT_INTENSITY = 0.70
BASELINE_INTENSITY = 0.12

# Terpene genes modelled quantitatively in the genome (genetics.traits).
GENOME_TERPENES = ("myrcene", "limonene", "caryophyllene", "pinene")

_PALETTE_CACHE: Optional[dict] = None
_ALIAS_CACHE: Optional[Dict[str, str]] = None


def _load_palette() -> dict:
    """Load (and cache) the terpene-effect palette from data/terpene_effects.yaml."""
    global _PALETTE_CACHE
    if _PALETTE_CACHE is None:
        path = get_settings().terpene_effects_file
        with open(path, "r", encoding="utf-8") as fh:
            _PALETTE_CACHE = yaml.safe_load(fh) or {}
    return _PALETTE_CACHE


def _alias_map() -> Dict[str, str]:
    """canonical-or-alias name (lowercased) -> canonical terpene key."""
    global _ALIAS_CACHE
    if _ALIAS_CACHE is None:
        palette = _load_palette()
        amap: Dict[str, str] = {}
        for canonical, spec in (palette.get("terpenes") or {}).items():
            amap[canonical.lower()] = canonical
            for alias in spec.get("aliases", []) or []:
                amap[str(alias).lower()] = canonical
        _ALIAS_CACHE = amap
    return _ALIAS_CACHE


def canonical_terpene(name: str) -> Optional[str]:
    """Resolve a raw terpene tag (any alias/case) to its canonical palette key,
    or None if it is not a buff-bearing palette terpene."""
    if not name:
        return None
    return _alias_map().get(str(name).strip().lower())


def intensities_from_tags(
    terpene_tags: Optional[List[str]],
    genome: Optional[Mapping] = None,
) -> Dict[str, float]:
    """Build a canonical terpene -> intensity (0..1) vector for a strain.

    Every palette terpene starts at a low baseline; a terpene listed in the
    catalog `terpenes` tags leads at PRESENT_INTENSITY. When a genome is given,
    the four quantitatively-modelled terpene genes override the tag-derived
    value with their expressed intensity (so bred strains carry genetic nuance).
    """
    palette = _load_palette()
    canon_keys = list((palette.get("terpenes") or {}).keys())
    intensities: Dict[str, float] = {t: BASELINE_INTENSITY for t in canon_keys}

    for tag in terpene_tags or []:
        canon = canonical_terpene(tag)
        if canon:
            intensities[canon] = PRESENT_INTENSITY

    if genome:
        # Lazy import to avoid a heavy dependency cycle at module load.
        from ..genetics.traits import express_terpenes

        try:
            expressed = express_terpenes(genome)
        except Exception:
            expressed = {}
        for t in GENOME_TERPENES:
            if t in expressed and t in intensities:
                intensities[t] = float(expressed[t])

    return intensities


def effect_profile(intensities: Mapping[str, float]) -> dict:
    """Compute a buff profile from a canonical terpene -> intensity vector.

    Returns a structured, JSON-serialisable profile:
      effects          sorted [{tag, score(0..100)}] strongest first
      dominant_effect  top effect tag (or None)
      flavor_families  flavor families present (for UI sorting/filters)
      axis             {body, mind, lean} — the mind<->body hint (-1..1)
      entourage        {active, terpene_count, bonus}
      terpenes         per-terpene {intensity, flavor_family} actually expressed
    """
    palette = _load_palette()
    specs = palette.get("terpenes") or {}
    ent_cfg = palette.get("entourage") or {}
    axis_cfg = palette.get("axis") or {}

    threshold = float(ent_cfg.get("intensity_threshold", 0.4))
    min_terps = int(ent_cfg.get("min_terpenes", 3))
    bonus_mult = float(ent_cfg.get("bonus_mult", 1.0))

    # A terpene only drives effects when it is actually *expressed* (intensity at
    # or above the significance threshold). Baseline terpenes carried in the
    # vector for genome continuity contribute nothing — a strain's profile is its
    # dominant chemotype, not faint background noise.
    present = {
        t: float(i)
        for t, i in intensities.items()
        if t in specs and float(i) >= threshold
    }
    entourage_active = len(present) >= min_terps
    mult = bonus_mult if entourage_active else 1.0

    raw: Dict[str, float] = {}
    for terp, intensity in present.items():
        for tag, weight in (specs[terp].get("effects") or {}).items():
            raw[tag] = raw.get(tag, 0.0) + float(weight) * float(intensity)

    scored = {tag: min(100, round(val * 100 * mult)) for tag, val in raw.items()}
    scored = {tag: s for tag, s in scored.items() if s > 0}

    effects = [
        {"tag": tag, "score": s}
        for tag, s in sorted(scored.items(), key=lambda kv: (-kv[1], kv[0]))
    ]

    body_tags = set(axis_cfg.get("body", []))
    mind_tags = set(axis_cfg.get("mind", []))
    body = sum(s for tag, s in scored.items() if tag in body_tags)
    mind = sum(s for tag, s in scored.items() if tag in mind_tags)
    total_axis = body + mind
    lean = round((mind - body) / total_axis, 3) if total_axis else 0.0

    families = sorted(
        {
            specs[t].get("flavor_family")
            for t in present
            if specs.get(t, {}).get("flavor_family")
        }
    )

    expressed = {
        t: {
            "intensity": round(float(present[t]), 4),
            "flavor_family": specs[t].get("flavor_family"),
        }
        for t in sorted(present)
    }

    return {
        "effects": effects,
        "dominant_effect": effects[0]["tag"] if effects else None,
        "flavor_families": families,
        "axis": {"body": body, "mind": mind, "lean": lean},
        "entourage": {
            "active": entourage_active,
            "terpene_count": len(present),
            "bonus": bonus_mult if entourage_active else 1.0,
        },
        "terpenes": expressed,
    }


def profile_for_strain(
    terpene_tags: Optional[List[str]],
    genome: Optional[Mapping] = None,
) -> dict:
    """Convenience: tags (+ optional genome) -> full effect profile."""
    return effect_profile(intensities_from_tags(terpene_tags, genome))
