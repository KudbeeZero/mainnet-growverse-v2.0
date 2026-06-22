// Growth-preview ("time travel") resolution for the Command Center scrubber.
//
// Pure: given the scrubber position (null = track the live server age, or a
// previewed day), resolve which day + growth stage the chamber should render and
// whether we're previewing. This NEVER mutates server state — it only changes
// what the canvas draws, so it works with no backend (and can't desync the sim).

import { cycleDays, stageForDay } from "./morphology";
import type { GrowthStage } from "@/lib/types";

export interface PreviewView {
  day: number;
  stage: GrowthStage;
  previewing: boolean;
}

/** Resolve the day/stage the chamber renders from the scrubber position. */
export function resolvePreview(
  previewDay: number | null,
  liveDay: number,
  flMid: number,
  liveStage: GrowthStage,
): PreviewView {
  if (previewDay === null) return { day: liveDay, stage: liveStage, previewing: false };
  return { day: previewDay, stage: stageForDay(previewDay, flMid), previewing: true };
}

/** Upper bound of the scrubber: a full seed→harvest cycle plus a little tail. */
export function maxPreviewDay(flMid: number): number {
  return Math.round(cycleDays(flMid) + 8);
}

export interface HarvestMarkers {
  /** First day the plant enters the ripening/harvest window (late flower). */
  readyFromDay: number;
  /** Day the plant is fully harvest-ready. */
  harvestDay: number;
}

/** Where the harvest window sits on the scrubber, derived from the stage map so
 *  the slider can paint a "ready to harvest" zone + tick. Pure. */
export function harvestMarkers(flMid: number): HarvestMarkers {
  const max = maxPreviewDay(flMid);
  let readyFromDay = max;
  let harvestDay = max;
  for (let d = 0; d <= max; d += 0.5) {
    const s = stageForDay(d, flMid);
    if (s === "late_flower" && readyFromDay === max) readyFromDay = d;
    if (s === "harvest") {
      harvestDay = d;
      break;
    }
  }
  return { readyFromDay, harvestDay };
}

