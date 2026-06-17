// ============================================================================
// FRONTIER — Clone Room :: Plant service (Manual Sections 2 & 6)
// ----------------------------------------------------------------------------
// Off-chain plant lifecycle logic backed by PostgreSQL. This file contains NO
// Algorand / ASA logic — minting is handled later (CLONE-09 / CLONE-10).
//
// Functions:
//   plantSeed(seedId, playerId, plotId?)  -> create a grow at `germinating`
//   tendPlant(growId)                     -> increment tendActions
//   checkStageProgress(grow)              -> advance stage by elapsed time
//   canCutClone(grow)                     -> clone-eligibility predicate
// ============================================================================

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, plantGrows, plantSeeds } from "@workspace/db";
import type { PlantGrow, PlantStage, SeedTraits } from "@workspace/db";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Base stage durations in hours (Manual Section 2.1 — Stage Map).
 * `planted` is instant and `harvest`/`complete` are not time-based, so they
 * have no auto-advancing duration here.
 */
export const STAGE_BASE_HOURS: Partial<Record<PlantStage, number>> = {
  germinating: 48,
  seedling: 72,
  veg: 120,
};

/** Time-based progression order. Stops at `veg`; harvest is player-triggered. */
const PROGRESSION: PlantStage[] = ["germinating", "seedling", "veg"];

/** Hours after entering `seedling` before the first clone cut is allowed. */
export const SEEDLING_CLONE_UNLOCK_HOURS = 48;

/**
 * Effective duration (ms) of a stage for a given growthRate.
 * Section 2.1 lists the modifier as "× growthRate".
 */
export function stageDurationMs(stage: PlantStage, growthRate: number): number {
  const baseHours = STAGE_BASE_HOURS[stage];
  if (baseHours === undefined) return Infinity; // non-advancing stage
  return baseHours * growthRate * HOUR_MS;
}

/**
 * Plant a seed: create a new plant_grows row at the `germinating` stage.
 * (Section 9 — start-grow: "Creates plant_grows row, sets stage = germinating".)
 */
export async function plantSeed(
  seedId: string,
  playerId: string,
  plotId?: number,
): Promise<PlantGrow> {
  const now = Date.now();
  const row = {
    growId: randomUUID(),
    seedId,
    ownerPlayerId: playerId,
    stage: "germinating" as PlantStage,
    startedAt: now,
    stageAt: now,
    stageEvents: [] as unknown[],
    tendActions: 0,
    cloneCut: false,
    parentPlotId: plotId ?? null,
  };

  const [inserted] = await db.insert(plantGrows).values(row).returning();
  return inserted;
}

/**
 * Register a tend action: increment tendActions by 1 and return the new grow.
 * (Section 9 — tend: "Increments tendActions".)
 */
export async function tendPlant(growId: string): Promise<PlantGrow | null> {
  const [updated] = await db
    .update(plantGrows)
    .set({ tendActions: sql`${plantGrows.tendActions} + 1` })
    .where(eq(plantGrows.growId, growId))
    .returning();

  return updated ?? null;
}

/**
 * Look up the genetics for a grow's parent seed (needed for growthRate).
 */
export async function getGrowTraits(grow: PlantGrow): Promise<SeedTraits | null> {
  const [seed] = await db
    .select({ traits: plantSeeds.traits })
    .from(plantSeeds)
    .where(eq(plantSeeds.seedId, grow.seedId))
    .limit(1);

  return seed?.traits ?? null;
}

/**
 * Advance a grow's stage based on elapsed time and its growthRate trait.
 *
 * Walks the time-based progression (germinating -> seedling -> veg). Each time
 * a stage's effective duration elapses the grow moves to the next stage, its
 * `stageAt` is set to the moment of transition, and `cloneCut` is reset so a
 * fresh clone cut is allowed in the new stage (Section 2.2 — one cut per stage).
 *
 * Returns the (possibly updated) grow. Persists only when the stage changed.
 */
export async function checkStageProgress(grow: PlantGrow): Promise<PlantGrow> {
  // Only time-based stages advance here.
  if (!PROGRESSION.includes(grow.stage as PlantStage)) return grow;

  const traits = await getGrowTraits(grow);
  if (!traits) return grow;

  const now = Date.now();
  let stage = grow.stage as PlantStage;
  let stageAt = grow.stageAt;
  let cloneCut = grow.cloneCut ?? false;
  let changed = false;

  // Loop so that a long-idle grow can cross multiple stage boundaries at once.
  while (true) {
    const idx = PROGRESSION.indexOf(stage);
    if (idx === -1 || idx >= PROGRESSION.length - 1) break; // veg is terminal here

    const duration = stageDurationMs(stage, traits.growthRate);
    if (now - stageAt < duration) break;

    stage = PROGRESSION[idx + 1];
    stageAt = stageAt + duration; // transition moment, not `now`
    cloneCut = false; // new stage => clone cut available again
    changed = true;
  }

  if (!changed) return grow;

  const [updated] = await db
    .update(plantGrows)
    .set({ stage, stageAt, cloneCut })
    .where(eq(plantGrows.growId, grow.growId))
    .returning();

  return updated ?? { ...grow, stage, stageAt, cloneCut };
}

/**
 * Whether a clone cut is currently allowed for a grow (Section 2.2).
 *
 * Eligible when the clone has not yet been cut in the current stage AND the
 * plant is either in `veg`, or in `seedling` for at least 48h.
 *
 * Pure predicate — `now` is injectable for testing.
 */
export function canCutClone(grow: PlantGrow, now: number = Date.now()): boolean {
  if (grow.cloneCut) return false;

  const stage = grow.stage as PlantStage;
  if (stage === "veg") return true;
  if (stage === "seedling") {
    return now - grow.stageAt >= SEEDLING_CLONE_UNLOCK_HOURS * HOUR_MS;
  }
  return false;
}

/**
 * Atomically claim a clone cut for the current stage (idempotency guard).
 * Sets cloneCut = true only if it is currently false; returns true on success.
 * (Manual Section 12.1 — "one clone cut per stage per grow".)
 */
export async function markCloneCut(growId: string): Promise<boolean> {
  const updated = await db
    .update(plantGrows)
    .set({ cloneCut: true })
    .where(and(eq(plantGrows.growId, growId), eq(plantGrows.cloneCut, false)))
    .returning({ growId: plantGrows.growId });

  return updated.length > 0;
}
