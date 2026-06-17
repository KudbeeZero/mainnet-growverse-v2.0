"""
Offline, deterministic advisor. No network, no API key.

Derives a sensible report straight from the plant-state context using the same
thresholds the simulation uses, so the advisor is useful for local dev and
tests and gives a graceful fallback when no Anthropic key is configured.
"""

from typing import List

from .provider import AdvisorProvider, AdvisorReport, CareSuggestion


class MockAdvisorProvider(AdvisorProvider):
    def name(self) -> str:
        return "mock"

    def diagnose(self, context: dict) -> AdvisorReport:
        plant = context.get("plant", {})
        water = float(plant.get("water_level", 60))
        nutrient = float(plant.get("nutrient_level", 60))
        pest = float(plant.get("pest_level", 0))
        disease = float(plant.get("disease_level", 0))
        health = float(plant.get("health", 100))
        stage = plant.get("growth_stage", "unknown")

        suggestions: List[CareSuggestion] = []
        findings: List[str] = []

        if water < 25:
            suggestions.append(CareSuggestion(
                action="water", urgency="now",
                reason=f"Water level is critically low ({water:.0f}); the plant is wilting.",
            ))
            findings.append("severe underwatering")
        elif water < 40:
            suggestions.append(CareSuggestion(
                action="water", urgency="soon",
                reason=f"Water level ({water:.0f}) is below the optimal band.",
            ))
            findings.append("low water")
        elif water > 90:
            findings.append("overwatering — let the medium dry before watering again")

        if nutrient < 25:
            suggestions.append(CareSuggestion(
                action="feed", urgency="now",
                reason=f"Nutrients are depleted ({nutrient:.0f}); growth and health will suffer.",
            ))
            findings.append("nutrient deficiency")
        elif nutrient < 40:
            suggestions.append(CareSuggestion(
                action="feed", urgency="soon",
                reason=f"Nutrient level ({nutrient:.0f}) is below optimal.",
            ))

        if pest > 0:
            suggestions.append(CareSuggestion(
                action="treat_pests",
                urgency="now" if pest >= 5 else "soon",
                reason=f"Pest pressure detected (level {pest:.0f}); treat before it spreads.",
            ))
            findings.append("pests")

        if disease > 0:
            suggestions.append(CareSuggestion(
                action="treat_disease",
                urgency="now" if disease >= 5 else "soon",
                reason=f"Disease/mildew detected (level {disease:.0f}); treat and lower humidity.",
            ))
            findings.append("disease")

        if stage == "harvest" or (stage == "flowering" and health >= 70 and not findings):
            suggestions.append(CareSuggestion(
                action="harvest", urgency="optional",
                reason="The plant is at or near peak — consider harvesting (and curing for quality).",
            ))

        if not suggestions:
            suggestions.append(CareSuggestion(
                action="wait", urgency="optional",
                reason="Levels are in the healthy bands; let it grow and check back later.",
            ))

        if health <= 20:
            severity = "critical"
        elif health <= 50 or len(findings) >= 2:
            severity = "serious"
        elif findings:
            severity = "minor"
        else:
            severity = "healthy"

        if findings:
            diagnosis = (
                f"At {stage} with health {health:.0f}. Issues: " + ", ".join(findings) + "."
            )
            summary = "Needs attention: " + "; ".join(findings) + "."
        else:
            diagnosis = f"At {stage} with health {health:.0f}. Resource levels are healthy."
            summary = "Looking healthy — stay the course."

        # Coach progression: mention the cheapest worthwhile next research.
        rec = (context.get("research", {}) or {}).get("recommended_next") or []
        if rec:
            top = rec[0]
            diagnosis += (
                f" Tip: consider researching {top['name']} "
                f"({top['effect']}, {top['cost']:g} GROW)."
            )

        return AdvisorReport(
            summary=summary, severity=severity, diagnosis=diagnosis, suggestions=suggestions
        )
