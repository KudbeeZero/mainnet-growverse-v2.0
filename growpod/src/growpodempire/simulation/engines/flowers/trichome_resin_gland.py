"""TrichomeResinGland telemetry (read-model).

A deterministic, read-only descriptor of a plant's resin glands — the "hairs on
the pistils": how dense the frost is, how developed the heads are, and the
**clear → cloudy → amber** ripeness distribution that defines the harvest window.
Computed from lifecycle progress + health + light + genetics, and it mirrors the
frontend Engine-7 maturity model (`web/.../trichomes.ts`) so the 3D bud and the
server agree on ripeness.

TELEMETRY ONLY — this does not change yield / quality / harvest economics. Any
coupling of resin strength into harvest value is a separate, balance-reviewed
step (per BUILD_RULES §5).
"""

from typing import Dict

# Where each flowering stage sits on the 0..1 ripeness axis, and how much of the
# axis it spans, so progress within a stage maps to clear→cloudy→amber.
_FLOWER_BASE = {"flowering": 0.0, "late_flower": 0.55, "harvest": 1.0}
_FLOWER_SPAN = {"flowering": 0.55, "late_flower": 0.45, "harvest": 0.0}


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _clamp01(v: float) -> float:
    return _clamp(v, 0.0, 1.0)


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def ripeness_progress(stage: str, stage_progress_pct: float) -> float:
    """0 (just frosting) → 1 (harvest window) across the flowering stages."""
    base = _FLOWER_BASE.get(stage)
    if base is None:
        return 0.0
    return _clamp01(base + _FLOWER_SPAN.get(stage, 0.0) * _clamp01(stage_progress_pct / 100.0))


def maturity_mix(progress: float, amber_bias: float = 0.0):
    """Population fractions (clear, cloudy, amber) — mirrors the frontend model:
    clear falls as the plant ripens, amber only rises late (quadratic), cloudy
    dominates the peak. `amber_bias` (0..1) nudges late amber up per strain."""
    p = _clamp01(progress)
    bias = _clamp01(amber_bias)
    clear = _lerp(0.95, 0.42, p)
    amber = _lerp(0.0, 0.16 + 0.22 * bias, p * p)
    cloudy = max(0.0, 1.0 - clear - amber)
    s = clear + cloudy + amber or 1.0
    return clear / s, cloudy / s, amber / s


def _harvest_window(progress: float, cloudy: float, amber: float, ecfg: Dict):
    if progress < ecfg.get("developing_below", 0.18):
        return "developing", "Heads are still forming — well before harvest."
    if amber >= ecfg.get("overripe_amber", 0.30):
        return "overripe", "Mostly amber — past peak; harvest now, potency/terps are fading."
    if amber >= ecfg.get("ripe_amber", 0.12):
        return "ripe", "Amber is climbing — prime window for a ripe, balanced finish."
    if cloudy >= ecfg.get("peak_cloudy", 0.50):
        return "peak", "Cloudy-dominant with little amber — the ideal harvest window."
    return "early", "Still clear-dominant — let it frost up more before harvesting."


def telemetry(stage: str, stage_progress_pct: float, health: float,
              light_ppfd: float, genetics: Dict, sim: Dict) -> Dict:
    """Full trichome read-model for the `/state` payload + the 3D bud + advisor."""
    ecfg = (sim.get("engines", {}) or {}).get("trichome_resin_gland", {})

    if stage not in _FLOWER_BASE:
        return {
            "active": False, "density": 0.0, "head_development": 0.0,
            "clear_pct": 0.0, "cloudy_pct": 0.0, "amber_pct": 0.0,
            "dominant": None, "harvest_window": "not_flowering",
            "recommendation": "Trichomes develop once the plant begins flowering.",
        }

    p = ripeness_progress(stage, stage_progress_pct)
    amber_bias = _clamp01(genetics.get("amber_bias", 0.0))
    clear, cloudy, amber = maturity_mix(p, amber_bias)

    genetic_density = _clamp01(genetics.get("trichome_density", ecfg.get("genetic_density_default", 0.7)))
    ref = ecfg.get("light_ref_ppfd", 600.0)
    per100 = ecfg.get("light_density_per_100ppfd", 0.06)
    light_factor = _clamp(1.0 + (light_ppfd - ref) / 100.0 * per100, 0.6, 1.25)
    health_factor = 0.6 + 0.4 * _clamp01(health / 100.0)
    head_dev = p
    density = _clamp01(genetic_density * (0.3 + 0.7 * head_dev) * light_factor * health_factor)

    dominant = "clear" if (clear >= cloudy and clear >= amber) else ("amber" if amber >= cloudy else "cloudy")
    window, rec = _harvest_window(p, cloudy, amber, ecfg)

    return {
        "active": True,
        "density": round(density, 3),
        "head_development": round(head_dev, 3),
        "clear_pct": round(clear * 100.0, 1),
        "cloudy_pct": round(cloudy * 100.0, 1),
        "amber_pct": round(amber * 100.0, 1),
        "dominant": dominant,
        "harvest_window": window,
        "recommendation": rec,
    }


def genetics_from_genes(thc: float, vigor: float, indica_ratio: float) -> Dict:
    """Derive the trichome genetics from genome traits — mirrors the bud-DNA
    derivation (frost tracks THC + vigor) so server + client phenotypes agree;
    indica-leaning strains finish a touch more amber."""
    density = _clamp(0.5 + (thc / 35.0) * 0.5 + (vigor - 0.5) * 0.2, 0.2, 1.0)
    return {"trichome_density": density, "amber_bias": _clamp01(indica_ratio * 0.5)}
