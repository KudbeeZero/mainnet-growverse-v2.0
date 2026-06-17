// Engine 7 — Biological Trichome Architecture (pure, DOM-free logic).
//
// Real cannabis resin glands aren't static white dots: they mature clear →
// cloudy → amber, they concentrate on the flowers (top cola heaviest, almost
// none on fan leaves), and under a grow light they micro-shimmer like tiny
// translucent lenses — never strobe. This module is the testable core of that
// model (the canvas wiring lives in chamberCore.ts). It deliberately holds NO
// canvas/window access so it unit-tests under vitest's node env, mirroring
// morphology.ts / phyllotaxy.ts.

export type Maturity = "clear" | "cloudy" | "amber";

/** Fractions of the population in each maturity state (sum ≈ 1). */
export interface MaturityMix {
  clear: number;
  cloudy: number;
  amber: number;
}

/**
 * Maturity ratios as a function of ripeness progress (0 = just-frosting,
 * 1 = harvest window) plus a per-strain amber bias. Early flower skews **clear**;
 * peak frost is **cloudy** dominant; only at the harvest window does **amber**
 * climb — so the trichome colour alone communicates ripeness with no text.
 * Baseline at full ripeness ≈ clear 55 / cloudy 35 / amber 10 (Director spec),
 * shifting further amber through the harvest window.
 *
 * `amberBias` (0..1, per strain) nudges the amber share up — some cultivars
 * finish more amber (heavier sedative read) than others.
 */
export function maturityMix(progress: number, amberBias = 0): MaturityMix {
  const p = clamp01(progress);
  const bias = clamp01(amberBias);
  // Clear falls as the plant ripens; amber only rises late (eased, so it stays
  // clear-dominant through mid-flower and ambers up at the end).
  const clear = lerp(0.95, 0.42, p);
  const amber = lerp(0.0, 0.16 + 0.22 * bias, p * p); // quadratic: late-rising
  const cloudy = Math.max(0, 1 - clear - amber);
  const sum = clear + cloudy + amber || 1;
  return { clear: clear / sum, cloudy: cloudy / sum, amber: amber / sum };
}

/**
 * Bucket a single gland into a maturity state from a stable per-gland roll
 * (0..1) against the population mix. Deterministic — the same roll + mix always
 * yields the same state, so a gland doesn't flicker between states frame to
 * frame; only the population *ratios* drift as the plant ripens.
 */
export function maturityFor(roll: number, mix: MaturityMix): Maturity {
  const r = clamp01(roll);
  if (r < mix.clear) return "clear";
  if (r < mix.clear + mix.cloudy) return "cloudy";
  return "amber";
}

/**
 * Resin-head colour by maturity. Clear = blue-white (high refraction), cloudy =
 * soft milky white (the dominant frost), amber = warm cream/gold. A purple
 * phenotype (0..1) tips clear/cloudy heads a touch lavender — highlights only,
 * never a full recolour.
 */
export function trichHeadColor(m: Maturity, alpha: number, purple = 0): string {
  const a = clamp(alpha, 0, 1);
  let r: number, g: number, b: number;
  if (m === "clear") {
    r = 224; g = 242; b = 255; // blue-white
  } else if (m === "cloudy") {
    r = 248; g = 250; b = 244; // soft white
  } else {
    r = 228; g = 188; b = 110; // warm cream/gold
    return `rgba(${r},${g},${b},${round2(a)})`; // amber: no lavender tint
  }
  const pp = clamp01(purple);
  if (pp > 0) {
    // nudge toward lavender (≈ 198,178,232) — a highlight, capped low
    const t = pp * 0.35;
    r = lerp(r, 198, t); g = lerp(g, 178, t); b = lerp(b, 232, t);
  }
  return `rgba(${r | 0},${g | 0},${b | 0},${round2(a)})`;
}

/** Where on the plant a flower site / surface sits, for density weighting. */
export type SitePosition =
  | "topCola"
  | "upperCola"
  | "midBud"
  | "lowerBud"
  | "sugarLeaf"
  | "fanLeaf"
  | "stem";

/** Trichome density by morphology position (Engine 7 distribution table). */
export const POSITION_DENSITY: Record<SitePosition, number> = {
  topCola: 1.0,
  upperCola: 0.8,
  midBud: 0.6,
  lowerBud: 0.4,
  sugarLeaf: 0.35,
  fanLeaf: 0.05,
  stem: 0.0,
};

/**
 * Density multiplier for a bud site from its normalised height on the plant
 * (0 = base, 1 = apex), interpolating the canopy band topCola→lowerBud. The
 * top cola (passed explicitly) gets the full 1.0; everything else thins toward
 * the skirt, so frost visibly concentrates up top like a real plant.
 */
export function budSiteDensity(heightFrac: number): number {
  const f = clamp01(heightFrac);
  // lowerBud (0.4) at the skirt → upperCola (0.8) near the top.
  return lerp(POSITION_DENSITY.lowerBud, POSITION_DENSITY.upperCola, f);
}

/**
 * Organic micro-shimmer: a tiny, slow brightness wobble so frost reads like wet
 * resin catching the light, NOT arcade glitter. Returns a multiplier centred on
 * 1.0 within ±amp. Phase is randomised per gland (caller passes a stable phase)
 * so the field never strobes in sync. `lightExposure` (0..1) scales amplitude —
 * brighter grow light, livelier shimmer.
 */
export function shimmer(
  t: number,
  phase: number,
  speed: number,
  amp: number,
  lightExposure = 1,
): number {
  const a = Math.max(0, amp) * clamp01(lightExposure);
  return 1 + Math.sin(t * speed + phase) * a;
}

/** Max simultaneously-animated glands by device (static frost beyond this). */
export const TRICHOME_BUDGET = { desktop: 250, mobile: 100 } as const;
/** Shimmer stays subtle — hard ceiling on the brightness wobble amplitude. */
export const SHIMMER_MAX_AMP = 0.16;
/** Per-gland angular speed band for the shimmer (rad/s) — slow, never flashy. */
export const SHIMMER_SPEED = { min: 0.6, max: 1.8 } as const;

// ---- small local helpers (kept here so the module is self-contained) ----
function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
