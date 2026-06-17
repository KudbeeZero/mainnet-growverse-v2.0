"""
Machine-readable plant conditions a frontend can render (drooping leaves,
visible bugs, mildew, etc.) plus severity grading.
"""

from enum import Enum


class PlantCondition(str, Enum):
    HEALTHY = "healthy"
    OVERWATERED = "overwatered"
    ROOT_ROT = "root_rot"
    UNDERWATERED = "underwatered"
    WILTING = "wilting"
    NUTRIENT_DEFICIENT = "nutrient_deficient"
    NUTRIENT_BURN = "nutrient_burn"
    PEST_INFESTATION = "pest_infestation"
    MILDEW = "mildew"
    DEAD = "dead"


class Severity(str, Enum):
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"


def severity_for(level: float, moderate: float = 30.0, severe: float = 60.0) -> Severity:
    """Grade a stress magnitude into a severity band."""
    if level >= severe:
        return Severity.SEVERE
    if level >= moderate:
        return Severity.MODERATE
    return Severity.MILD
