// Phase 1a — parametric 3D cola builder (pure, DOM-free, unit-testable).
//
// One genetics-driven bud model: calyxes accrete up a phyllotaxic spiral as the
// bud develops (inside-out growth), sized/coloured from the SAME `BudDNA` the
// Canvas engine uses — so the macro view and (later) the on-plant bud can never
// diverge again. Output is plain instance transforms in UNIT space (~1 tall,
// centred on the origin by the renderer); three.js wiring lives in BudGL.tsx.

import { mulberry32, lerp, clamp, smooth } from "../morphology";
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
  /** Phytomer index this bract belongs to (stack order up the cola; 0 = base). */
  node?: number;
  /** True for the node's primary bract — the sugar-leaf / flower anchor point. */
  primary?: boolean;
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

/** A bud-width curve along the cola: a SPEAR/CONE, not a lens or a ball — quick
 * fill from the base, a full-bodied plateau through the lower-mid, then a long
 * tapering cone to a point at the apex. This is the shape of a real cola (and
 * matches the reference architecture: "elongated spear/cone, not a round ball").
 * `t` is 0 (base) → 1 (tip). */
function widthCurve(t: number): number {
  const c = clamp(t, 0, 1);
  if (c < 0.2) return lerp(0.42, 1.0, smooth(c / 0.2));
  if (c < 0.5) return lerp(1.0, 0.95, (c - 0.2) / 0.3);
  const k = (c - 0.5) / 0.5;
  // Convex power taper (not a symmetric sine) so the tip comes to a real point.
  return 0.95 * Math.pow(1 - k, 1.4) + 0.02;
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
  /**
   * Calyx-count multiplier (default 1). A cola rendered LARGER needs more calyxes
   * to stay densely clad at the same visual density — a fat main cola with the
   * base count reads as a sparse, sleek bullet with the bare body showing through.
   * The whole-plant renderer scales this by each cola's on-screen size so the big
   * apical cola is the densest, most-formed bud, not the emptiest.
   */
  densityMul?: number;
}

/**
 * Build the cola as stacked calyx ellipsoids. Deterministic for a given seed, so
 * a plant always grows the same bud. Inside-out accretion: at low `budDev` only a
 * few small calyxes near the core exist; as it ripens, rings fill in and swell.
 */
export function buildCola(dna: BudDNA, seed: number, opts: BuildColaOpts): ColaInstance[] {
  const dev = Math.min(1, Math.max(0, opts.budDev));
  const cap = opts.maxInstances ?? 380;
  // sqrt() so applying it to BOTH the ring count and the per-ring count multiplies
  // the total calyxes by ~densityMul (area scales as the product of the two).
  const densRoot = Math.sqrt(Math.max(0.25, opts.densityMul ?? 1));
  const rnd = mulberry32((seed >>> 0) || 1);

  const H = 1.0; // unit cola height
  // Proportion clamp: bud half-width is tied to the strain's height ratio (kills
  // the runaway-cola bug — width can't exceed a sane fraction of height). A cola
  // is taller than wide, so the half-width stays well under H.
  const aspect = Math.min(0.42, dna.maxBudWidth / Math.max(1, dna.budHeight));
  const Rmax = H * aspect;

  // The cola is a STACK OF PHYTOMERS — the repeating flower node of the female
  // inflorescence. Each phytomer bears a tight cluster of bracts (calyxes) at one
  // phyllotaxic azimuth, a subtending sugar leaf, and flowers (pistils) in the
  // bract axils; the axillary shoots of a compound raceme repeat the same unit.
  // Nodes accrete as the bud develops and their INTERNODES COMPRESS toward the
  // apex, so the bracts stack into a dense, clustered cola instead of a smooth
  // even sheath. (Botany: Spitzer-Rimon et al. 2019, Front. Plant Sci. —
  // phytomer architecture & florogenesis in female Cannabis.)
  // Many finely-spaced nodes so the node clusters overlap into a fully-clad cola
  // (a real cola is solid, its phytomers reading as banding/texture — not gaps).
  const nodes = Math.max(6, Math.round(dna.rows * (0.95 + 0.85 * dev) * densRoot));
  const out: ColaInstance[] = [];
  let spiral = 0;

  for (let i = 0; i < nodes && out.length < cap; i++) {
    const u = nodes > 1 ? i / (nodes - 1) : 0;
    // Internode compression: node gaps shrink toward the apex (dense foxtail tip),
    // but gently — too much bunches every node at the top and bares the lower body.
    const t = 1 - Math.pow(1 - u, 1.18);
    const wc = widthCurve(t);
    const ringR = Rmax * wc;

    spiral += GOLDEN_ANGLE;          // this phytomer's phyllotaxic azimuth
    const nodeAz = spiral;

    // A cluster of bracts at THIS node — enough that neighbouring node clusters
    // fuse into a solid, clad cola while still reading as stacked flower nodes.
    const bracts = Math.max(2, Math.round((dna.calyxPerRowMin + (dna.calyxPerRowMax - dna.calyxPerRowMin) * wc) * 2.35 * densRoot));
    for (let j = 0; j < bracts && out.length < cap; j++) {
      // Tight angular spread around the node azimuth — tighter than a wide even
      // spread, so bracts CLUSTER and overlap like scales instead of scattering
      // into a sparse, gappy shell (the "berries floating on a ball" problem).
      const az = nodeAz + (rnd() - 0.5) * 0.8;
      // Hug close to the true surface (0.62..1.02×) so the cladding is dense and
      // the smaller backstop core underneath never shows through.
      const r = ringR * (0.62 + 0.4 * rnd());
      const x = Math.cos(az) * r;
      const z = Math.sin(az) * r;
      // Bracts hug the node's height (small jitter) so the cluster stays one node.
      const y = t * H + (rnd() - 0.5) * 0.018;

      const sizeUnit = (dna.calyxSizeMin + (dna.calyxSizeMax - dna.calyxSizeMin) * rnd()) / Math.max(1, dna.budHeight);
      const swell = 0.7 + 0.6 * dev;
      const w = sizeUnit * H * swell * (0.95 + 0.4 * wc);
      // Teardrop: taller than wide, more pointed when the strain foxtails.
      const h = w * (1.18 + 0.55 * (dna.foxtailBias ?? 0));

      out.push({
        pos: [x, y, z],
        scale: [w, h, w],
        // Tilt the long axis up-and-outward from the stem so calyxes face out.
        rot: [Math.atan2(z, ringR || 1) * 0.4, az, (rnd() - 0.5) * 0.6],
        color: hslToRgb(pickPaletteColor(dna.palette, rnd())),
        node: i,
        primary: j === 0,
      });
    }
  }

  // --- Axillary sub-shoots (compound raceme) ---------------------------------
  // Each phytomer's axillary shoot repeats the whole flower unit, so a mature cola
  // is a compound raceme: smaller sub-colas bud OUTWARD from the lower-mid nodes,
  // giving the fat, lumpy, "many buds fused" look instead of one smooth spindle.
  // Only larger, developed colas branch this way (a tiny nug stays a single spike,
  // and the close-up macro bud — densityMul 1 — is left as an unbranched cola).
  if (densRoot > 1.15 && dev > 0.35 && out.length < cap) {
    const subCount = Math.min(7, Math.floor((densRoot - 1.15) * 2.1 * (0.5 + 0.5 * dev)));
    for (let s = 0; s < subCount && out.length < cap; s++) {
      // Attach point: on the fat mid-body of the main axis, set INSIDE the surface
      // so the sub-cola fuses into the main cola instead of floating off it.
      const fBase = 0.25 + rnd() * 0.45;
      spiral += GOLDEN_ANGLE;
      const az0 = spiral;
      const attachR = Rmax * widthCurve(fBase) * 0.62;
      const cx = Math.cos(az0) * attachR;
      const cz = Math.sin(az0) * attachR;
      const cy = fBase * H;

      // The sub-cola is a short phytomer stack that grows mostly UP with only a
      // slight outward lean, so it hugs the main cola as a fused lump (not a
      // satellite on a stalk).
      const subLen = (0.13 + 0.12 * rnd()) * H * (0.6 + 0.4 * dev);
      const subRmax = Rmax * (0.32 + 0.14 * rnd());
      const subNodes = 3 + Math.floor(rnd() * 3);
      const lean = 0.26; // outward lean fraction vs. upward growth
      let subSpiral = az0 * 1.7;

      for (let k = 0; k < subNodes && out.length < cap; k++) {
        const su = subNodes > 1 ? k / (subNodes - 1) : 0;
        const st = 1 - Math.pow(1 - su, 1.15);
        const swc = widthCurve(st);
        const sringR = subRmax * swc;
        const ncx = cx + Math.cos(az0) * lean * subLen * st;
        const ncz = cz + Math.sin(az0) * lean * subLen * st;
        const ncy = cy + st * subLen;

        subSpiral += GOLDEN_ANGLE;
        const sbracts = Math.max(2, Math.round((dna.calyxPerRowMin + (dna.calyxPerRowMax - dna.calyxPerRowMin) * swc) * 1.6 * densRoot));
        for (let m = 0; m < sbracts && out.length < cap; m++) {
          const az = subSpiral + (rnd() - 0.5) * 0.85;
          const rr = sringR * (0.62 + 0.4 * rnd());
          const x = ncx + Math.cos(az) * rr;
          const z = ncz + Math.sin(az) * rr;
          const y = ncy + (rnd() - 0.5) * 0.02;

          const sizeUnit = (dna.calyxSizeMin + (dna.calyxSizeMax - dna.calyxSizeMin) * rnd()) / Math.max(1, dna.budHeight);
          const swell = 0.7 + 0.6 * dev;
          const w = sizeUnit * H * swell * (0.9 + 0.35 * swc) * 0.86; // sub-bracts a touch smaller
          const hh = w * (1.18 + 0.55 * (dna.foxtailBias ?? 0));

          out.push({
            pos: [x, y, z],
            scale: [w, hh, w],
            rot: [Math.atan2(z - ncz, sringR || 1) * 0.4, az, (rnd() - 0.5) * 0.6],
            color: hslToRgb(pickPaletteColor(dna.palette, rnd())),
            node: 1000 + s * 16 + k,
            primary: m === 0,
          });
        }
      }
    }
  }

  return out;
}
