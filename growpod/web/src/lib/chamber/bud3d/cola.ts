// Phase 1a — parametric 3D cola builder (pure, DOM-free, unit-testable).
//
// One genetics-driven bud model: calyxes accrete up a phyllotaxic spiral as the
// bud develops (inside-out growth), sized/coloured from the SAME `BudDNA` the
// Canvas engine uses — so the macro view and (later) the on-plant bud can never
// diverge again. Output is plain instance transforms in UNIT space (~1 tall,
// centred on the origin by the renderer); three.js wiring lives in BudGL.tsx.

import { mulberry32 } from "../morphology";
import { pickPaletteColor, type BudDNA, type PaletteColor } from "../budDna";

export interface ColaInstance {
  /** Position in unit space (cola spans y≈0..1 before the renderer centres it). */
  pos: [number, number, number];
  /** Ellipsoid half-extents (w, h, w) — the calyx swells with development. */
  scale: [number, number, number];
  /** Euler rotation (radians). */
  rot: [number, number, number];
  /** Linear RGB 0..1, picked from the strain palette. */
  color: [number, number, number];
}

/** Golden angle — nature's phyllotaxic spacing, so calyxes nest without seams. */
const GOLDEN_ANGLE = 2.399963229728653;

/** HSL (h 0..360, s/l 0..100) → linear-ish RGB 0..1 for three.js vertex colours. */
export function hslToRgb({ hue, sat, lit }: Pick<PaletteColor, "hue" | "sat" | "lit">): [number, number, number] {
  const h = ((hue % 360) + 360) % 360 / 360;
  const s = Math.min(1, Math.max(0, sat / 100));
  const l = Math.min(1, Math.max(0, lit / 100));
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (t: number) => {
    let tc = t;
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };
  return [hk(h + 1 / 3), hk(h), hk(h - 1 / 3)];
}

/** A bud-width curve along the cola: rounded base, fattest in the lower-middle,
 * tapering to a tip — so it reads as a cola, not a ball. `t` is 0 (base) → 1 (tip). */
function widthCurve(t: number): number {
  return Math.sin(Math.PI * (0.12 + 0.82 * t));
}

export interface ColaSilhouette {
  /** Lathe profile points [radius, y] in UNIT space (y 0..1, closed at both ends). */
  profile: [number, number][];
  /** Max half-width (== the cola's outer radius). */
  Rmax: number;
  /** Unit cola height (== 1). */
  H: number;
}

/**
 * The cola's outer silhouette as a lathe profile — the SAME width curve the
 * calyxes are placed against, so a solid "bud body" mesh built from this fills
 * the space between calyxes (no see-through gaps) and reads as one fused cola
 * instead of a loose cluster of balls. Pure; deterministic from genetics only.
 */
export function colaSilhouette(dna: BudDNA, samples = 16): ColaSilhouette {
  const H = 1.0;
  const aspect = Math.min(0.42, dna.maxBudWidth / Math.max(1, dna.budHeight));
  const Rmax = H * aspect;
  const profile: [number, number][] = [[0.0001, 0]];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    profile.push([Math.max(0.0001, Rmax * widthCurve(t)), t * H]);
  }
  profile.push([0.0001, H]);
  return { profile, Rmax, H };
}

export interface BuildColaOpts {
  /** 0..1 development: gates how many calyxes have formed AND how swollen they are. */
  budDev: number;
  /** Hard cap on instance count (perf / mobile budget). */
  maxInstances?: number;
}

/**
 * Build the cola as stacked calyx ellipsoids. Deterministic for a given seed, so
 * a plant always grows the same bud. Inside-out accretion: at low `budDev` only a
 * few small calyxes near the core exist; as it ripens, rings fill in and swell.
 */
export function buildCola(dna: BudDNA, seed: number, opts: BuildColaOpts): ColaInstance[] {
  const dev = Math.min(1, Math.max(0, opts.budDev));
  const cap = opts.maxInstances ?? 260;
  const rnd = mulberry32((seed >>> 0) || 1);

  const H = 1.0; // unit cola height
  // Proportion clamp: bud half-width is tied to the strain's height ratio (kills
  // the runaway-cola bug — width can't exceed a sane fraction of height). A cola
  // is taller than wide, so the half-width stays well under H.
  const aspect = Math.min(0.42, dna.maxBudWidth / Math.max(1, dna.budHeight));
  const Rmax = H * aspect;

  // Accretion: fewer rings early, filling toward the genetic `rows` as it
  // develops; denser rings so calyxes pack into a cola, not a loose cluster.
  const rings = Math.max(4, Math.round(dna.rows * (0.5 + 0.6 * dev)));
  const out: ColaInstance[] = [];
  let spiral = 0;

  for (let i = 0; i < rings && out.length < cap; i++) {
    const t = rings > 1 ? i / (rings - 1) : 0;
    const wc = widthCurve(t);
    const ringR = Rmax * wc;
    const perRing = Math.max(1, Math.round((dna.calyxPerRowMin + (dna.calyxPerRowMax - dna.calyxPerRowMin) * wc) * 1.6));
    for (let j = 0; j < perRing && out.length < cap; j++) {
      spiral += GOLDEN_ANGLE;
      // Hug the axis so calyxes overlap into a solid cola (tighter than a cluster).
      const r = ringR * (0.4 + 0.5 * rnd());
      const x = Math.cos(spiral) * r;
      const z = Math.sin(spiral) * r;
      const y = t * H + (rnd() - 0.5) * 0.03;

      const sizeUnit = (dna.calyxSizeMin + (dna.calyxSizeMax - dna.calyxSizeMin) * rnd()) / Math.max(1, dna.budHeight);
      const swell = 0.5 + 0.55 * dev;
      const w = sizeUnit * H * swell * (0.78 + 0.34 * wc);
      // Teardrop: taller than wide, more pointed when the strain foxtails.
      const h = w * (1.18 + 0.55 * (dna.foxtailBias ?? 0));

      out.push({
        pos: [x, y, z],
        scale: [w, h, w],
        // Tilt the long axis up-and-outward from the stem so calyxes face out.
        rot: [Math.atan2(z, ringR || 1) * 0.4, spiral, (rnd() - 0.5) * 0.6],
        color: hslToRgb(pickPaletteColor(dna.palette, rnd())),
      });
    }
  }
  return out;
}
