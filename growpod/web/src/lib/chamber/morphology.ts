// Pure, DOM-free logic for the GROVERS Grow Chamber.
//
// This is the testable core lifted from the original standalone chamber mockup:
// the deterministic RNG, the strain morphology model, the climate stress model,
// day->development params, and the days-to-harvest estimate. It deliberately
// holds NO canvas/window access (geometry + drawing live in GrowChamber.tsx) so
// it can be unit-tested under vitest's node env — same boundary as graphAdapters.
//
// Key real-game binding (vs. the mockup's free sliders):
//   • morphology is derived continuously from the strain's indica_ratio (0..1),
//     not three hardcoded presets. The mockup's Northern Lights / Durban Poison
//     presets become the indica (ratio=1) / sativa (ratio=0) archetypes.
//   • stage durations + days-to-harvest mirror the backend engine/balance.yaml.

import type { GrowthStage } from "@/lib/types";

export const TAU = Math.PI * 2;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** Deterministic PRNG (same as the mockup) — pure, seedable, replayable. */
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit seed from a plant id, so a given plant always grows the same. */
export function seedForPlant(plantId: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < plantId.length; i++) {
    h ^= plantId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type BudPattern = "nodal" | "hybrid" | "spiral";

/**
 * Whole-plant silhouette knobs — the per-strain shape of the *skeleton* (node
 * stacking, branch spread, secondary branchlets, cola mass), distinct from the
 * leaf/bud colouring (`Morphology`). Authored for curated strains and derived
 * from indica dominance otherwise (see `silhouetteFor` in strainVisuals). This
 * is what lets a strain be recognisable by silhouette alone.
 */
export interface Silhouette {
  /** Node-count multiplier — denser canopy (>1) vs. airy (<1). */
  nodeDensity: number;
  /** Vertical node-packing tightness — >1 stacks nodes tighter (spear). */
  vertStack: number;
  /** Fraction of main branches that sprout a secondary branchlet (0..1). */
  branchletFrac: number;
  /** Lateral reach multiplier for the lower branches (wider skirt). */
  lowerSpread: number;
  /** How much shorter the upper branches are than the lower (0..1). */
  upperShorten: number;
  /** Top-cola mass multiplier. */
  colaScale: number;
  /** Node-base leaf-cluster size multiplier. */
  nodeLeaf: number;
  /** Branch stiffness — >1 sturdier stems (less droop), <1 weaker (more sag). */
  branchStrength: number;
  /** Bud-weight multiplier — >1 heavier flowers (more droop / cola lean). */
  budWeightMul: number;
  /**
   * Apical dominance 0..1 — how strongly the leader (top cola) suppresses its
   * rivals. High (≈1) = one dominant cola + subordinate side branches (a spear /
   * Christmas-tree); low (≈0) = several co-dominant tops competing for the apex
   * (a bushy, multi-cola canopy). Drives Engines 1 & 2 (apical-dominance / multi-
   * cola architecture).
   */
  apicalDominance: number;
}

/** Morphology parameters the geometry builder consumes. */
export interface Morphology {
  hue: number;
  sat: number;
  lit: number;
  leafW: number;
  leafletMax: number;
  heightMul: number;
  internode: number;
  branchMul: number;
  stretch: number;
  bracts: number;
  clusterLen: number;
  clusterFat: number;
  pattern: BudPattern;
  flowerFrom: number;
  nodeBudFrac: number;
  foxtail: number;
}

// Archetypes lifted verbatim from the mockup STRAINS table.
// INDICA = Northern Lights (indica_ratio -> 1), SATIVA = Durban Poison (-> 0).
const INDICA: Omit<Morphology, "pattern"> = {
  hue: 122, sat: 44, lit: 31, leafW: 1.3, leafletMax: 9, heightMul: 0.74,
  internode: 0.08, branchMul: 1.26, stretch: 1.12, bracts: 11, clusterLen: 0.85,
  clusterFat: 1.3, flowerFrom: 0.18, nodeBudFrac: 0.55, foxtail: 0.0,
};
const SATIVA: Omit<Morphology, "pattern"> = {
  hue: 95, sat: 53, lit: 41, leafW: 0.62, leafletMax: 9, heightMul: 1.22,
  internode: 0.112, branchMul: 0.8, stretch: 1.58, bracts: 9, clusterLen: 1.45,
  clusterFat: 0.74, flowerFrom: 0.3, nodeBudFrac: 0.3, foxtail: 0.6,
};

/** Bud architecture by indica dominance: spiral (sativa) ↔ nodal (indica). */
export function patternForRatio(indicaRatio: number): BudPattern {
  const r = clamp(indicaRatio, 0, 1);
  if (r <= 0.34) return "spiral";
  if (r >= 0.66) return "nodal";
  return "hybrid";
}

/** Continuous morphology from a real strain's indica_ratio (0=sativa, 1=indica). */
export function morphologyFor(indicaRatio: number): Morphology {
  const r = clamp(indicaRatio, 0, 1);
  const mix = (key: keyof Omit<Morphology, "pattern">) => lerp(SATIVA[key], INDICA[key], r);
  return {
    hue: mix("hue"),
    sat: mix("sat"),
    lit: mix("lit"),
    leafW: mix("leafW"),
    leafletMax: Math.round(mix("leafletMax")),
    heightMul: mix("heightMul"),
    internode: mix("internode"),
    branchMul: mix("branchMul"),
    stretch: mix("stretch"),
    bracts: Math.round(mix("bracts")),
    clusterLen: mix("clusterLen"),
    clusterFat: mix("clusterFat"),
    pattern: patternForRatio(r),
    flowerFrom: mix("flowerFrom"),
    nodeBudFrac: mix("nodeBudFrac"),
    foxtail: mix("foxtail"),
  };
}

export interface ClimateInput {
  fan: number; // 0..100 — local visual-only airflow control
  temp: number; // °C
  hum: number; // %
  co2: number; // ppm
}

export interface ClimateResult {
  stress: number; // 0..100
  fanPen: number;
  fanNote: string;
  co2Boost: number; // 0..~0.12 growth bonus
  windAmp: number; // canvas sway amplitude
  growthMult: number; // 0.4..1.15
  tooMuchFan: boolean;
  tooLowFan: boolean;
}

/**
 * The mockup's environment stress model. FAN is a local visual control with no
 * backend field; temp/hum/co2 mirror the real optimal bands (balance.yaml).
 * Drives canvas sway/windburn and the on-screen health hint.
 */
export function climateModel({ fan, temp, hum, co2 }: ClimateInput): ClimateResult {
  const tempPen = Math.max(0, Math.abs(temp - 24) - 2) * 4;
  const humPen = Math.max(0, Math.abs(hum - 52) - 6) * 1.2;
  let fanPen = 0;
  let fanNote: string;
  if (fan < 18) {
    fanPen = (18 - fan) * 1.1;
    fanNote = "stale air — mold & weak stems";
  } else if (fan > 78) {
    fanPen = (fan - 78) * 1.4;
    fanNote = "windburn — leaves clawing, drying out";
  } else {
    fanNote = "good airflow — strong stems";
  }
  const co2Pen = co2 < 600 ? (600 - co2) * 0.01 : 0;
  const co2Boost = clamp((co2 - 800) / 700, 0, 1) * 0.12;
  const stress = clamp(tempPen + humPen + fanPen + co2Pen, 0, 100);
  const windAmp = 0.004 + (fan / 100) * 0.05;
  return {
    stress,
    fanPen,
    fanNote,
    co2Boost,
    windAmp,
    growthMult: clamp(1 + co2Boost - stress / 200, 0.4, 1.15),
    tooMuchFan: fan > 78,
    tooLowFan: fan < 18,
  };
}

export interface DevParams {
  budDev: number;
  ripe: number;
  brown: number;
  trich: number;
  blush: number;
}

/**
 * day -> development fractions (bud fill, ripeness, browning, trichomes).
 * Each ramp is eased with smoothstep so swelling/ripening accelerates into the
 * middle of its window and settles at the end, instead of marching linearly —
 * this is what makes the growth animation feel organic and satisfying. The
 * 0 and 1 endpoints are preserved (smooth(0)=0, smooth(1)=1).
 */
export function devParams(day: number): DevParams {
  return {
    budDev: smooth(clamp((day - 34) / 32, 0, 1)),
    ripe: smooth(clamp((day - 40) / 22, 0, 1)),
    brown: smooth(clamp((day - 58) / 12, 0, 1)),
    trich: smooth(clamp((day - 48) / 18, 0, 1)),
    blush: clamp((day - 55) / 15, 0, 1) * 0.5,
  };
}

/**
 * Development for rendering, gated on the AUTHORITATIVE growth_stage so client
 * clock drift can never show flowers before the server says the plant flowers.
 * Buds only develop in flowering/harvest regardless of the derived `day`.
 */
export function effectiveDev(stage: GrowthStage, day: number): DevParams {
  const d = devParams(day);
  if (stage === "flowering" || stage === "late_flower" || stage === "harvest") return d;
  return { budDev: 0, ripe: 0, brown: 0, trich: 0, blush: 0 };
}

// Nominal stage durations (days) — mirrors balance.yaml growth.stages.
export const STAGE_DAYS = { seed: 3, germination: 5, seedling: 10, vegetative: 26, late_flower: 14 } as const;
const STAGE_ORDER: GrowthStage[] = [
  "seed", "germination", "seedling", "vegetative", "flowering", "late_flower", "harvest",
];

/** Real elapsed days since planting (client clock); 0 if unknown. */
export function ageDays(plantedAt: string | null, now: number = Date.now()): number {
  if (!plantedAt) return 0;
  const t = Date.parse(plantedAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now - t) / 86_400_000);
}

/**
 * The render stage for an arbitrary day on the cycle. Mirrors the nominal stage
 * durations; flowering length comes from the strain. Used by the growth-preview
 * slider so scrubbing the timeline shows the right discrete features (cotyledons
 * in seedling, flowers in flowering) even when the live server stage differs.
 */
export function stageForDay(day: number, floweringDays = 60): GrowthStage {
  const seedEnd = STAGE_DAYS.seed;
  const germEnd = seedEnd + STAGE_DAYS.germination;
  const seedlingEnd = germEnd + STAGE_DAYS.seedling;
  const vegEnd = seedlingEnd + STAGE_DAYS.vegetative;
  if (day < seedEnd) return "seed";
  if (day < germEnd) return "germination";
  if (day < seedlingEnd) return "seedling";
  if (day < vegEnd) return "vegetative";
  if (day < vegEnd + floweringDays) return "flowering";
  if (day < vegEnd + floweringDays + STAGE_DAYS.late_flower) return "late_flower";
  return "harvest";
}

/** Total nominal length of one grow cycle (days) for a given flowering window. */
export function cycleDays(floweringDays = 60): number {
  return (
    STAGE_DAYS.seed +
    STAGE_DAYS.germination +
    STAGE_DAYS.seedling +
    STAGE_DAYS.vegetative +
    floweringDays +
    STAGE_DAYS.late_flower
  );
}

/**
 * The NOMINAL grow day implied by the authoritative server stage + how far the
 * plant is through it. This decouples the live render from wall-clock age: under
 * launch time-compression a plant flowers in days, so real elapsed time would
 * never reach devParams' nominal bud/frost ramps (buds from ~day 34) and the
 * chamber would show a flowering plant with no flowers. Mapping (stage, progress)
 * back onto the nominal cycle keeps the visuals — leaf count, stretch, bud swell,
 * frost, ripeness — in lock-step with the real (compressed) stage, at any pace.
 *
 * Feed the result to `previewDev`/`stageForDay`, which already remap flowering
 * *progress* onto the dev ramps. A plant in HARVEST returns the full cycle length
 * (fully mature). Pre-flower stages land below VEG_END, so no buds render.
 */
export function nominalGrowDay(
  stage: GrowthStage,
  stageProgressPct: number,
  floweringDays = 60,
): number {
  const lenOf = (s: GrowthStage): number =>
    s === "flowering" ? floweringDays : (STAGE_DAYS[s as keyof typeof STAGE_DAYS] ?? 0);
  let day = 0;
  for (const s of STAGE_ORDER) {
    if (s === stage) return day + (clamp(stageProgressPct, 0, 100) / 100) * lenOf(s);
    day += lenOf(s);
  }
  return day; // harvest / unknown -> full nominal cycle (fully mature)
}

const VEG_END =
  STAGE_DAYS.seed + STAGE_DAYS.germination + STAGE_DAYS.seedling + STAGE_DAYS.vegetative; // 44

/**
 * Development for the growth-PREVIEW scrubber, scaled to the strain's flowering
 * length. devParams' ramps are tuned to a ~60-day-cycle absolute day; for a
 * strain with a longer/shorter flowering window that would saturate buds too
 * early/late. So we map flowering *progress* (0..1 across the strain's window)
 * onto devParams' nominal flowering span (~day 34→70). Pre-flower = no buds.
 */
export function previewDev(day: number, floweringDays = 60): DevParams {
  if (day < VEG_END) return { budDev: 0, ripe: 0, brown: 0, trich: 0, blush: 0 };
  const p = clamp((day - VEG_END) / Math.max(1, floweringDays), 0, 1);
  return devParams(34 + p * 36);
}

/**
 * Server-truth grow-day + bud-dev for permanent on-chain mint metadata
 * (ARC-69). Always derived from `liveNominalDay` — the authoritative
 * (stage, stage_progress_pct) mapping — never from a growth-boost offset or
 * the time-preview scrubber, both of which are transient, client-only visual
 * overlays. Mirrors how `grow_stage`/`trich_density` already read straight
 * off server state in `buildPlantMetadata`: a mint is a one-time snapshot, so
 * every field in it must describe the real plant, not a momentary look.
 *
 * Reuses `previewDev`, the same pure day→dev mapper the live/preview render
 * already uses (see `nominalGrowDay`'s doc comment) — this just feeds it the
 * unboosted, unpreviewed day instead of the boosted/previewed one.
 */
export function mintTruthMetadata(
  liveNominalDay: number,
  floweringDays = 60,
): { growDay: number; budDev: number } {
  return {
    growDay: Math.round(liveNominalDay),
    budDev: previewDev(liveNominalDay, floweringDays).budDev,
  };
}

/**
 * Per-strain bud colouring (client-side, deterministic from the strain seed).
 * Cannabis colas range from frosty green→amber to deep anthocyanin purple; which
 * a strain expresses is a stable genetic trait. We roll it per strain so the
 * GenBank stays visually diverse — ~40% express some purple, a few of those
 * deeply — without any backend genetics change. Leaves stay green; this only
 * tints the calyxes and (for vivid purples) the pistils toward magenta.
 */
export interface BudColor {
  /** 0 = classic green→amber, 1 = deep purple/violet calyxes. */
  anthocyanin: number;
  /** Final calyx base hue (green ~hue..violet ~285), pre-blended by anthocyanin. */
  calyxHue: number;
  /** Calyx saturation (richer for purple phenos). */
  calyxSat: number;
  /** 0 = warm amber pistils, 1 = magenta/pink pistils (vivid purple phenos). */
  pistilMagenta: number;
  /** Optional accent hue for a fraction of calyxes (e.g. purple accents on a green bud). */
  accentHue?: number;
  /** Fraction of calyxes (0..1) rendered in accentHue instead of calyxHue. */
  accentFrac?: number;
}

export function budColorFor(strainSeed: number, baseGreenHue: number): BudColor {
  const r = mulberry32(strainSeed >>> 0);
  const roll = r();
  let anthocyanin: number;
  if (roll < 0.4) anthocyanin = clamp(0.45 + r() * 0.55, 0, 1); // ~40% express purple
  else if (roll < 0.58) anthocyanin = r() * 0.28; // a faint blush band
  else anthocyanin = 0; // classic green
  const purpleHue = 272 + r() * 34; // violet → magenta-leaning purple
  // Hue must interpolate the short way; green (~110) → purple (~285) is fine direct.
  const calyxHue = lerp(baseGreenHue, purpleHue, anthocyanin);
  const calyxSat = lerp(40, 60, anthocyanin);
  const pistilMagenta = clamp((anthocyanin - 0.35) / 0.65, 0, 1);
  return { anthocyanin, calyxHue, calyxSat, pistilMagenta };
}

/**
 * Estimated days remaining until harvest. Sums the nominal duration of the
 * current stage and all stages ahead of it (flowering uses the strain's
 * flowering_days midpoint), then inflates by the engine's health factor
 * (1 + (100-health)/200) since poor health slows development. A "~N days"
 * estimate — start-of-stage assumption, no partial-stage info on the wire.
 */
export function daysToHarvest(
  stage: GrowthStage,
  floweringDays: [number, number],
  health: number,
): number {
  if (stage === "harvest") return 0;
  const floweringMid = (floweringDays[0] + floweringDays[1]) / 2;
  const durationOf = (s: GrowthStage): number => {
    if (s === "flowering") return floweringMid;
    if (s === "harvest") return 0;
    return STAGE_DAYS[s as keyof typeof STAGE_DAYS] ?? 0;
  };
  const fromIdx = STAGE_ORDER.indexOf(stage);
  let remaining = 0;
  for (let i = fromIdx; i < STAGE_ORDER.length; i++) remaining += durationOf(STAGE_ORDER[i]);
  const healthFactor = 1 + (100 - clamp(health, 0, 100)) / 200;
  return remaining * healthFactor;
}
