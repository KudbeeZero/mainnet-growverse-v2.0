"""
Scientist-grade horticultural derivations — pure functions over a pod's
environment. These turn the raw sensor values (air temperature, relative
humidity, light) into the numbers a real grower actually targets: vapour-pressure
deficit (VPD) and the daily light integral (DLI).

Kept deliberately free of any plant/ORM coupling so they're trivially unit-tested
and reusable by the engine, the API serializer, and (later) the AI advisor. See
`docs/memory/design/01-simulation-horticulture.md` (Phase A).
"""

import math


def svp_kpa(temp_c: float) -> float:
    """Saturation vapour pressure (kPa) via the Tetens equation."""
    return 0.61078 * math.exp(17.27 * temp_c / (temp_c + 237.3))


def vpd_kpa(air_temp_c: float, rh_pct: float, leaf_offset_c: float = 0.0) -> float:
    """Leaf-to-air vapour-pressure deficit (kPa).

    The leaf is assumed `leaf_offset_c` cooler than the surrounding air
    (transpirational cooling); VPD is the saturation pressure at the leaf minus
    the actual vapour pressure of the air. This is the quantity growers tune to
    steer transpiration and mildew risk.
    """
    rh = max(0.0, min(100.0, rh_pct))
    leaf_svp = svp_kpa(air_temp_c - leaf_offset_c)
    air_vapour_pressure = (rh / 100.0) * svp_kpa(air_temp_c)
    return max(0.0, leaf_svp - air_vapour_pressure)


def dli(ppfd_umol: float, photoperiod_hours: float) -> float:
    """Daily Light Integral (mol·m⁻²·day⁻¹) from PPFD and the photoperiod."""
    return ppfd_umol * 3600.0 * photoperiod_hours / 1_000_000.0


def derived_metrics(env: dict, sim: dict) -> dict:
    """Scientist-grade readouts derived from a pod environment dict.

    `env` is the engine's environment view (`temperature`, `humidity`, `light`,
    …); `sim` is the `simulation` config block. Returns rounded, display-ready
    values that the API can surface without the engine having to persist them.
    """
    vcfg = sim.get("vpd", {})
    lcfg = sim.get("light", {})
    leaf_offset = vcfg.get("leaf_offset_c", 2.0)
    photoperiod = lcfg.get("photoperiod_hours", 18)
    band = lcfg.get("optimal_ppfd", [300, 900])
    ppfd = env.get("light", sum(band) / 2.0)
    return {
        "vpd_kpa": round(vpd_kpa(env["temperature"], env["humidity"], leaf_offset), 3),
        "dli_mol": round(dli(ppfd, photoperiod), 2),
        "ppfd": ppfd,
        "photoperiod_hours": photoperiod,
    }
