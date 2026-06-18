// Bud-weight physics for the whole-plant chamber (PR #26 — Bud Weight Physics
// Polish). Pure, deterministic, canvas-only: no physics engine, no allocation in
// the hot path, no new motion systems. These helpers turn the existing geometry
// (bud mass per branch, strain branch vigour, flowering progress) into bounded
// droop/lean angles and a weighting on the existing airflow wave, so a plant
// reads as *carrying heavy flowers* — top colas that lean and nod with inertia,
// side branches that sag in proportion to their load.
//
// All angles are radians. The brief's budget is honoured strictly: side branches
// droop 0–12°, the top cola leans 1–5°. Nothing floppy, nothing cartoonish.

import { clamp, lerp } from "./morphology";
import type { GrowthStage } from "@/lib/types";

/** Max side-branch droop (12°) — the brief's hard ceiling. No extreme bending. */
export const MAX_BRANCH_DROOP = (12 * Math.PI) / 180;
/** Max top-cola lean (5°) — a heavy nod, never a flop. */
export const MAX_COLA_LEAN = (5 * Math.PI) / 180;

// Tuning surface (kept together so the visual pass has one place to turn knobs).
// DROOP_GAIN is set so a heavy bud in late flower nears the 12° ceiling while a
// small early-flower bud barely sags (~1°). COLA_GAIN puts a normal-weight cola
// at the top of the 1–5° band by harvest.
const DROOP_GAIN = 0.28;
const COLA_GAIN = 0.085;

/**
 * Flowering weight multiplier by stage (the brief's ladder):
 *   Seedling 0 · Vegetative 0 · Early Flower 0.25 · Late Flower 0.70 · Harvest 1.0
 * Within flowering the load ramps with `budDev` (0..1) so weight accumulates
 * gradually rather than snapping on. Buds only weigh anything in flower/harvest.
 */
export function flowerStageMultiplier(stage: GrowthStage, budDev: number): number {
  if (stage === "harvest") return 1;
  // Late flower carries the heavier ripening load (~0.7 → 1.0 as buds finish).
  if (stage === "late_flower") return lerp(0.7, 1.0, clamp(budDev, 0, 1));
  if (stage !== "flowering") return 0;
  return lerp(0.25, 0.7, clamp(budDev, 0, 1));
}

/**
 * Branch flexibility from the strain's branch vigour (`branchMul`). Higher vigour
 * = stiffer stem = less flex. Single source of truth for the value GrowChamber
 * previously computed inline.
 */
export function branchFlex(branchMul: number): number {
  return clamp(1.25 - branchMul * 0.5, 0.45, 1.05);
}

/**
 * Side-branch droop angle (radians), clamped to {@link MAX_BRANCH_DROOP}.
 * The brief's model:
 *   droop = budMass · branchFlex · flowerStageMultiplier · strainWeightMul
 * divided by branch strength (sturdier stems sag less). Monotonic in bud mass;
 * exactly 0 outside flowering (stageMul = 0).
 */
export function branchDroop(
  budMass: number,
  flex: number,
  stageMul: number,
  budWeightMul: number,
  branchStrength: number,
): number {
  const raw =
    (budMass * flex * stageMul * budWeightMul) / Math.max(0.3, branchStrength);
  return clamp(raw * DROOP_GAIN, 0, MAX_BRANCH_DROOP);
}

/**
 * Top-cola lean (radians), clamped to {@link MAX_COLA_LEAN}. Grows with flowering
 * and the strain's bud-weight: a chunky strain (PDP) reaches the 5° ceiling, a
 * strong/light one (G13) leans a few degrees.
 */
export function colaLean(stageMul: number, budWeightMul: number): number {
  return clamp(stageMul * budWeightMul * COLA_GAIN, 0, MAX_COLA_LEAN);
}

/** Per-element weighting applied to the *existing* airflow wave (not a new system). */
export interface AirflowWeighting {
  /** Amplitude multiplier — heavy flowers swing less. */
  ampMul: number;
  /** Phase-lag multiplier — heavy flowers lag further behind the travelling wave. */
  lagMul: number;
  /** Frequency multiplier — heavy flowers move slower (inertia). */
  freqMul: number;
}

/**
 * How a branch/cola's bud load colours its airflow motion: heavier load → smaller
 * amplitude, more lag, slower frequency, so it visibly "feels weighted". Pure
 * multipliers folded into the wave at draw time; no extra state, no new motion.
 */
export function airflowWeighting(budMass: number, stageMul: number): AirflowWeighting {
  const load = clamp(budMass * stageMul, 0, 1.6);
  return {
    ampMul: clamp(1 - load * 0.28, 0.5, 1),
    lagMul: 1 + load * 0.5,
    freqMul: clamp(1 - load * 0.18, 0.7, 1),
  };
}
