"""
Derive a plant's visible conditions from its current state.

Pure function of the plant's resource/stress levels + the simulation config, so
the output is exactly what a frontend renders (and what the engine diffs to emit
onset events).
"""

from typing import Dict, List

from .conditions import PlantCondition, Severity, severity_for


def compute_conditions(plant, sim: Dict) -> List[dict]:
    """Return a list of {condition, severity} dicts for the plant's state."""
    if not plant.is_alive:
        return [{"condition": PlantCondition.DEAD.value, "severity": Severity.SEVERE.value}]

    water = sim.get("water", {})
    nutrient = sim.get("nutrient", {})
    flags: List[dict] = []

    # --- Water ---------------------------------------------------------
    rot_threshold = water.get("rot_threshold", 96)
    overwater = water.get("overwater_threshold", 88)
    underwater = water.get("underwater_threshold", 15)
    if plant.water_level >= rot_threshold:
        flags.append(_flag(PlantCondition.ROOT_ROT, Severity.SEVERE))
    elif plant.water_level >= overwater:
        # How far past the overwater line, as a 0..100-ish magnitude.
        mag = (plant.water_level - overwater) / max(1.0, 100 - overwater) * 100
        flags.append(_flag(PlantCondition.OVERWATERED, severity_for(mag, 40, 80)))
    elif plant.water_level <= underwater:
        mag = (underwater - plant.water_level) / max(1.0, underwater) * 100
        cond = PlantCondition.WILTING if plant.water_level <= underwater / 2 else PlantCondition.UNDERWATERED
        flags.append(_flag(cond, severity_for(mag, 40, 80)))

    # --- Nutrients -----------------------------------------------------
    if plant.nutrient_level >= nutrient.get("burn_threshold", 95):
        flags.append(_flag(PlantCondition.NUTRIENT_BURN, Severity.MODERATE))
    elif plant.nutrient_level <= nutrient.get("deficient_threshold", 20):
        flags.append(_flag(PlantCondition.NUTRIENT_DEFICIENT, Severity.MODERATE))

    # --- Pests & disease (level 0..100) --------------------------------
    if plant.pest_level > 0:
        flags.append(_flag(PlantCondition.PEST_INFESTATION, severity_for(plant.pest_level)))
    if plant.disease_level > 0:
        flags.append(_flag(PlantCondition.MILDEW, severity_for(plant.disease_level)))

    if not flags:
        flags.append(_flag(PlantCondition.HEALTHY, Severity.MILD))
    return flags


def _flag(condition: PlantCondition, severity: Severity) -> dict:
    return {"condition": condition.value, "severity": severity.value}
