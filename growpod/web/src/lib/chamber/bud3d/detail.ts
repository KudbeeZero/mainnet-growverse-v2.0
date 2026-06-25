// Phase 1b — bud detail builders (pure, DOM-free, unit-testable).
//
// Given the cola's calyx instances, scatter trichome frost over their surfaces
// and grow pistils ("hairs") from them — deterministic, derived from the SAME
// seed/genetics so they track the cola. Maturity colour reuses the Engine-7
// model in trichomes.ts so frost reads ripeness with no text. three.js wiring
// (geometry + instancing) lives in BudGL.tsx.

import { mulberry32 } from "../morphology";
import { maturityMix, maturityFor, TRICHOME_BUDGET } from "../trichomes";
import type { ColaInstance } from "./cola";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---- Trichome frost ------------------------------------------------------

/** 0 = clear (blue-white), 1 = cloudy (milky), 2 = amber (gold). */
export type FrostMat = 0 | 1 | 2;

export interface FrostInstance {
  /** Position in the cola's UNIT space (renderer applies the same y-centring). */
  pos: [number, number, number];
  /** Head radius in unit space. */
  r: number;
  mat: FrostMat;
}

export interface FrostOpts {
  seed: number;
  /** 0..1 frost density (dna.trichomeDensity × dev.trich). */
  density: number;
  /** 0..1 ripeness — drives the clear→cloudy→amber mix. */
  ripe: number;
  amberBias?: number;
  isMobile?: boolean;
}

/**
 * Scatter resin glands over each calyx (more on bigger/denser calyxes, capped to
 * the device budget). Each gland buckets to a maturity state from a stable roll
 * against the population mix, so the field doesn't flicker — only the ratios
 * drift as the plant ripens. Heavier frost up the cola falls out naturally
 * because upper calyxes are smaller/tighter and sampled the same way.
 */
export function buildFrost(cola: ColaInstance[], opts: FrostOpts): FrostInstance[] {
  const rnd = mulberry32(((opts.seed >>> 0) ^ 0x9e3779b9) || 7);
  const budget = opts.isMobile ? TRICHOME_BUDGET.mobile : TRICHOME_BUDGET.desktop;
  const density = clamp01(opts.density);
  const mix = maturityMix(clamp01(opts.ripe), opts.amberBias ?? 0);
  const out: FrostInstance[] = [];
  if (density <= 0) return out;

  for (const c of cola) {
    // Frost concentrates up the cola (tips/edges) like a real plant — weight the
    // gland count by the calyx's height in the cola (y≈0 base .. 1 apex).
    const heightFrac = clamp01(c.pos[1]);
    // Many glands per calyx so a frosty bud reads caked in resin, not lightly dusted.
    const per = Math.round((4 + 12 * density) * (0.55 + 0.85 * heightFrac));
    for (let k = 0; k < per && out.length < budget; k++) {
      // A point on the calyx ellipsoid surface (uniform-ish direction).
      const u = rnd() * Math.PI * 2;
      const v = Math.acos(2 * rnd() - 1);
      const nx = Math.sin(v) * Math.cos(u);
      const ny = Math.cos(v);
      const nz = Math.sin(v) * Math.sin(u);
      const pos: [number, number, number] = [
        c.pos[0] + nx * c.scale[0] * 0.58,
        c.pos[1] + ny * c.scale[1] * 0.58,
        c.pos[2] + nz * c.scale[2] * 0.58,
      ];
      const m = maturityFor(rnd(), mix);
      out.push({
        // Bigger gland heads so the frost actually reads at phone-screen scale.
        r: (0.007 + 0.011 * rnd()) * (0.8 + 0.45 * density),
        pos,
        mat: m === "clear" ? 0 : m === "cloudy" ? 1 : 2,
      });
    }
  }
  return out;
}

// ---- Pistils ("hairs") ---------------------------------------------------

export interface PistilInstance {
  /** Base position on a calyx, in the cola's UNIT space. */
  pos: [number, number, number];
  /** Unit direction the strand points (outward + up). */
  dir: [number, number, number];
  /** Strand length in unit space. */
  len: number;
  /** Roll about `dir` (radians) so each wispy hair curls a different way. */
  roll: number;
  /** RGB 0..1 (white → amber → brown by ripeness/browning). */
  color: [number, number, number];
}

export interface PistilOpts {
  seed: number;
  /** Per-calyx spawn chance (dna.pistilChance). */
  chance: number;
  /** 0..1 ripeness (white → amber). */
  ripe: number;
  /** 0..1 browning (→ brown, curled, late). */
  brown: number;
  /** 0..1 purple/magenta phenotype tint. */
  magenta?: number;
  isMobile?: boolean;
}

/** Pistil colour: fresh white → ripe amber → late brown, with an optional
 * magenta tint for purple phenos. */
export function pistilColor(ripe: number, brown: number, magenta = 0): [number, number, number] {
  const r0 = 1.0, g0 = 1.0, b0 = 0.96;        // white
  const r1 = 0.86, g1 = 0.58, b1 = 0.34;       // amber
  const t = clamp01(ripe);
  let r = lerp(r0, r1, t), g = lerp(g0, g1, t), b = lerp(b0, b1, t);
  const br = clamp01(brown);
  r = lerp(r, 0.42, br); g = lerp(g, 0.26, br); b = lerp(b, 0.16, br);
  const mg = clamp01(magenta) * 0.4;
  if (mg > 0) { r = lerp(r, 0.85, mg); g = lerp(g, 0.4, mg); b = lerp(b, 0.6, mg); }
  return [r, g, b];
}

/**
 * Grow pistils from a subset of calyxes (by `chance`), each a small bundle of
 * 2–4 strands aimed outward + up from the stem axis. Deterministic; capped to a
 * device budget so dense colas stay cheap.
 */
export function buildPistils(cola: ColaInstance[], opts: PistilOpts): PistilInstance[] {
  const rnd = mulberry32(((opts.seed >>> 0) ^ 0x85ebca6b) || 11);
  const budget = opts.isMobile ? 90 : 190;
  const chance = clamp01(opts.chance);
  const color = pistilColor(opts.ripe, opts.brown, opts.magenta ?? 0);
  const out: PistilInstance[] = [];

  for (const c of cola) {
    if (rnd() > chance) continue;
    const bundle = 3 + Math.floor(rnd() * 4); // 3..6 strands per calyx
    // Outward (radial) direction from the central stem axis.
    const radial = Math.hypot(c.pos[0], c.pos[2]) || 1e-3;
    const ox = c.pos[0] / radial;
    const oz = c.pos[2] / radial;
    for (let k = 0; k < bundle && out.length < budget; k++) {
      // Wider splay than before — real pistils fan out in every direction.
      const spread = 0.8;
      const dx = ox + (rnd() - 0.5) * spread;
      const dz = oz + (rnd() - 0.5) * spread;
      const dy = 0.45 + 0.6 * rnd() - opts.brown * 0.7; // curl down as it browns
      const m = Math.hypot(dx, dy, dz) || 1;
      out.push({
        pos: [c.pos[0] + ox * c.scale[0] * 0.4, c.pos[1] + c.scale[1] * 0.3, c.pos[2] + oz * c.scale[2] * 0.4],
        dir: [dx / m, dy / m, dz / m],
        // Longer, finer hairs that read as wispy threads, not stubble.
        len: (0.09 + 0.11 * rnd()) * (1 + opts.ripe * 0.35),
        roll: rnd() * Math.PI * 2,
        color,
      });
    }
  }
  return out;
}

// ---- Sugar leaves --------------------------------------------------------

export interface SugarLeafInstance {
  /** Base position on a calyx, in the cola's UNIT space. */
  pos: [number, number, number];
  /** Unit direction the leaf points (outward + up). */
  dir: [number, number, number];
  /** Leaf size in unit space. */
  scale: number;
  /** Roll about `dir` (radians) so leaves don't all face the same way. */
  roll: number;
  /** Frosted-green RGB (0..1). */
  color: [number, number, number];
}

export interface SugarLeafOpts {
  seed: number;
  /** 0..1 — how leafy the bud is (per-calyx spawn chance). */
  amount: number;
  /** 0..1 frost — lightens the leaf toward a sugar-coated white-green. */
  frost: number;
  isMobile?: boolean;
}

/**
 * Grow small serrated SUGAR LEAVES out from a subset of calyxes — the frosted
 * leaflets poking through a real cola. Deterministic from the same seed/genetics,
 * budgeted for the device, and weighted toward the lower/mid cola (where sugar
 * leaves are densest on a real plant). `frost` lightens them toward a sugar-coated
 * white-green so a frosty bud reads leafier and brighter, like the reference photo.
 */
export function buildSugarLeaves(cola: ColaInstance[], opts: SugarLeafOpts): SugarLeafInstance[] {
  const rnd = mulberry32(((opts.seed >>> 0) ^ 0x27d4eb2f) || 13);
  const budget = opts.isMobile ? 45 : 140;
  const amount = clamp01(opts.amount);
  const frost = clamp01(opts.frost);
  const out: SugarLeafInstance[] = [];
  if (amount <= 0) return out;

  for (const c of cola) {
    // Sugar leaves favour the lower/mid cola — weight the spawn by (1 - height),
    // but keep a strong floor so the bud always reads leafy (real plant matter).
    const h = clamp01(c.pos[1]); // 0 base .. ~1 apex
    if (rnd() > amount * (0.62 + 0.45 * (1 - h))) continue;
    if (out.length >= budget) break;

    const radial = Math.hypot(c.pos[0], c.pos[2]) || 1e-3;
    const ox = c.pos[0] / radial;
    const oz = c.pos[2] / radial;
    const dx = ox;
    const dy = 0.28 + 0.42 * rnd(); // outward, tilted up
    const dz = oz;
    const m = Math.hypot(dx, dy, dz) || 1;

    // Frosted green that stays GREEN: a mid leaf-green only modestly lifted toward
    // white-green by frost, so the leaves read as plant matter, not white paddles.
    const base = 0.36 + 0.14 * rnd();
    const r = lerp(base * 0.5, 0.7, frost * 0.6);
    const g = lerp(base * 1.05, 0.86, frost * 0.55);
    const b = lerp(base * 0.42, 0.66, frost * 0.6);

    out.push({
      pos: [
        c.pos[0] + ox * c.scale[0] * 0.45,
        c.pos[1] + c.scale[1] * 0.1,
        c.pos[2] + oz * c.scale[2] * 0.45,
      ],
      dir: [dx / m, dy / m, dz / m],
      // Bigger blades so they give the bud visible mass / silhouette.
      scale: (0.18 + 0.16 * rnd()) * (c.scale[0] + c.scale[1]),
      roll: rnd() * Math.PI * 2,
      color: [Math.min(1, r), Math.min(1, g), Math.min(1, b)],
    });
  }
  return out;
}
