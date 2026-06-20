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
    const per = Math.round(2 + 7 * density);
    for (let k = 0; k < per && out.length < budget; k++) {
      // A point on the calyx ellipsoid surface (uniform-ish direction).
      const u = rnd() * Math.PI * 2;
      const v = Math.acos(2 * rnd() - 1);
      const nx = Math.sin(v) * Math.cos(u);
      const ny = Math.cos(v);
      const nz = Math.sin(v) * Math.sin(u);
      const pos: [number, number, number] = [
        c.pos[0] + nx * c.scale[0] * 0.56,
        c.pos[1] + ny * c.scale[1] * 0.56,
        c.pos[2] + nz * c.scale[2] * 0.56,
      ];
      const m = maturityFor(rnd(), mix);
      out.push({
        pos,
        r: (0.0035 + 0.0055 * rnd()) * (0.7 + 0.6 * density),
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
  const budget = opts.isMobile ? 70 : 150;
  const chance = clamp01(opts.chance);
  const color = pistilColor(opts.ripe, opts.brown, opts.magenta ?? 0);
  const out: PistilInstance[] = [];

  for (const c of cola) {
    if (rnd() > chance) continue;
    const bundle = 2 + Math.floor(rnd() * 3); // 2..4 strands
    // Outward (radial) direction from the central stem axis.
    const radial = Math.hypot(c.pos[0], c.pos[2]) || 1e-3;
    const ox = c.pos[0] / radial;
    const oz = c.pos[2] / radial;
    for (let k = 0; k < bundle && out.length < budget; k++) {
      const spread = 0.5;
      const dx = ox + (rnd() - 0.5) * spread;
      const dz = oz + (rnd() - 0.5) * spread;
      const dy = 0.5 + 0.5 * rnd() - opts.brown * 0.6; // curl down as it browns
      const m = Math.hypot(dx, dy, dz) || 1;
      out.push({
        pos: [c.pos[0] + ox * c.scale[0] * 0.4, c.pos[1] + c.scale[1] * 0.3, c.pos[2] + oz * c.scale[2] * 0.4],
        dir: [dx / m, dy / m, dz / m],
        len: (0.05 + 0.06 * rnd()) * (1 + opts.ripe * 0.3),
        color,
      });
    }
  }
  return out;
}
