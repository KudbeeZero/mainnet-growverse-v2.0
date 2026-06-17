// Shared chamber-render derivation, lifted out of the chamber page so both the
// chamber route and the Command Center feed the GrowChamber identical inputs and
// can't drift. Pure: strain -> morphology/silhouette/bud colour/bud DNA, plus the
// authoritative-stage "nominal grow day" and the harvest-day countdown. Preview
// state (the growth scrubber) is left to the caller — this is the LIVE baseline.

import {
  ageDays,
  daysToHarvest,
  morphologyFor,
  nominalGrowDay,
  seedForPlant,
  type BudColor,
  type Morphology,
  type Silhouette,
} from "@/lib/chamber/morphology";
import { budColorForStrain, silhouetteFor } from "@/lib/chamber/strainVisuals";
import { applyEnvironmentToBudDNA, budDnaFor, type BudDNA } from "@/lib/chamber/budDna";
import type { PlantState, Pod, Strain } from "@/lib/types";

export interface PlantRender {
  strain: Strain | undefined;
  indicaRatio: number;
  morphology: Morphology;
  silhouette: Silhouette;
  budColor: BudColor;
  budDna: BudDNA;
  /** Flowering-window midpoint (days). */
  flMid: number;
  /** Nominal grow day implied by the authoritative server stage + progress. */
  liveNominalDay: number;
  /** Whole days remaining to harvest (server forecast preferred), or null. */
  harvestDays: number | null;
}

export function plantRender(
  plant: PlantState,
  strain: Strain | undefined,
  pod: Pod | undefined,
): PlantRender {
  const indicaRatio = strain?.indica_ratio ?? 0.5;
  const morphology = morphologyFor(indicaRatio);
  const silhouette = silhouetteFor(strain?.slug ?? strain?.name, indicaRatio);
  const flMid = strain ? (strain.flowering_days[0] + strain.flowering_days[1]) / 2 : 60;

  const budColor = budColorForStrain(
    strain?.slug ?? strain?.name,
    morphology.hue,
    seedForPlant(plant.strain_id),
  );
  const budDna = applyEnvironmentToBudDNA(budDnaFor(strain?.slug ?? strain?.name, budColor), {
    temp: pod?.temperature ?? 24,
    light: pod?.light_intensity ?? 600,
    humidity: pod?.humidity ?? 50,
    water: plant.water_level,
  });

  const liveNominalDay = plant.forecast
    ? nominalGrowDay(plant.growth_stage, plant.forecast.stage_progress_pct, flMid)
    : ageDays(plant.planted_at);

  const harvestDays = plant.forecast
    ? plant.forecast.is_harvest_ready
      ? 0
      : Math.max(1, Math.ceil(plant.forecast.hours_to_harvest / 24))
    : strain
      ? Math.round(daysToHarvest(plant.growth_stage, strain.flowering_days, plant.health))
      : null;

  return {
    strain,
    indicaRatio,
    morphology,
    silhouette,
    budColor,
    budDna,
    flMid,
    liveNominalDay,
    harvestDays,
  };
}
