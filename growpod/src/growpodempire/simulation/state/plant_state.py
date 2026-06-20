"""The rich working model of a plant during a simulation tick.

Richer than the DB ``Plant`` row: it carries the aggregate numbers the engine
already tracks **plus** nested per-part subsystems (roots / stem / leaves /
flowers incl. trichomes) that the micro-engines progressively populate. The
orchestrator builds one from the ORM at the start of catch-up and writes the
aggregates back at the end, keeping the DB authoritative.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class PlantState:
    plant_id: str
    genome: Dict[str, Any]
    stage: str
    age_hours: float = 0.0

    # Aggregates (mirror the DB row).
    overall_health: float = 100.0
    height_cm: float = 0.0
    water_level: float = 60.0
    nutrient_level: float = 60.0
    pest_level: float = 0.0
    disease_level: float = 0.0

    # Per-part subsystems (filled in by their engines; empty until then).
    roots: Dict[str, Any] = field(default_factory=dict)
    stem: Dict[str, Any] = field(default_factory=dict)
    leaves: List[Dict[str, Any]] = field(default_factory=list)
    flowers: Dict[str, Any] = field(default_factory=dict)

    condition_flags: List[Any] = field(default_factory=list)
    #: Procedural form params handed to the frontend renderer.
    morphology: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_plant(cls, plant: Any) -> "PlantState":
        """Build a working state from a DB ``Plant`` row (aggregates only; parts
        start empty and are populated by the engines)."""
        return cls(
            plant_id=plant.id,
            genome=dict(plant.genome or {}),
            stage=plant.growth_stage,
            overall_health=float(plant.health),
            height_cm=float(plant.height),
            water_level=float(plant.water_level),
            nutrient_level=float(plant.nutrient_level),
            pest_level=float(plant.pest_level),
            disease_level=float(plant.disease_level),
            condition_flags=list(plant.condition_flags or []),
        )

    def apply_to(self, plant: Any) -> None:
        """Write the aggregate fields back to the DB ``Plant`` row."""
        plant.health = self.overall_health
        plant.height = self.height_cm
        plant.water_level = self.water_level
        plant.nutrient_level = self.nutrient_level
        plant.pest_level = self.pest_level
        plant.disease_level = self.disease_level
        plant.growth_stage = self.stage

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plant_id": self.plant_id,
            "stage": self.stage,
            "age_hours": self.age_hours,
            "overall_health": self.overall_health,
            "height_cm": self.height_cm,
            "water_level": self.water_level,
            "nutrient_level": self.nutrient_level,
            "pest_level": self.pest_level,
            "disease_level": self.disease_level,
            "roots": self.roots,
            "stem": self.stem,
            "leaves": self.leaves,
            "flowers": self.flowers,
            "condition_flags": self.condition_flags,
            "morphology": self.morphology,
        }
