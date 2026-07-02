// Phase 2 — fan-leaf builder (pure, DOM-free, unit-testable).
//
// Owner spec layer 3 (realistic serrated fan leaves). Two concerns:
//   1. GEOMETRY — `buildFanLeafOutlines(leaflets, seed)` returns 5–9 serrated
//      leaflet polygons radiating from a common petiole base, in a flat plane
//      (blade points +Y). PlantGL merges these into one instanced blade mesh.
//   2. PLACEMENT — `buildLeafPlacements(skeleton, seed)` turns the skeleton's
//      raw leaf slots into full instances with a deep waxy blue-green colour and
//      slight per-leaf yaw/pitch/roll variation, so no two fans face alike.
//
// Deterministic from the seed (mulberry32) — no Math.random.

import { mulberry32 } from "../chamber/morphology";
import type { PlantSkeleton, Vec3 } from "./skeleton";

export type Pt2 = [number, number];

/** One serrated leaflet outline (a closed polygon in the blade plane). */
export interface Leaflet {
  outline: Pt2[];
}

/**
 * Build a fan leaf as N serrated leaflets fanning from the petiole at (0,0),
 * blades pointing generally +Y. Central leaflet is longest; outer ones shorten
 * and splay wider — the classic cannabis hand. Each side of a leaflet carries a
 * few saw-teeth so the silhouette reads serrated, not a smooth lance.
 * Deterministic from `seed`.
 */
export function buildFanLeafOutlines(leaflets: number, seed: number): Leaflet[] {
  const n = Math.max(3, Math.min(9, leaflets | 0));
  const rnd = mulberry32((seed >>> 0) || 3);
  const half = (n - 1) / 2;
  const spread = 0.42; // radians between adjacent leaflets
  const out: Leaflet[] = [];

  for (let i = 0; i < n; i++) {
    const k = i - half; // -half .. +half (0 = centre)
    const angle = k * spread;
    // Central leaflet longest; falls off toward the outer fingers.
    const lenFall = 1 - 0.42 * Math.abs(k) / Math.max(1, half);
    const L = (0.9 + 0.2 * rnd()) * lenFall;
    const W = 0.15 * lenFall * (0.9 + 0.2 * rnd());
    const teeth = 4; // saw-teeth per side

    // Build the outline up one side (base→tip) then down the other, adding
    // little outward teeth so edges are serrated.
    const right: Pt2[] = [];
    const left: Pt2[] = [];
    for (let s = 0; s <= teeth; s++) {
      const t = s / teeth; // 0 base .. 1 tip
      // Lance width profile: swells low, tapers to a point.
      const wsw = Math.sin(Math.PI * (0.1 + 0.85 * t)) * W;
      const y = t * L;
      const tooth = s === teeth ? 0 : (s % 2 === 0 ? 1.28 : 0.85);
      right.push([wsw * tooth, y]);
      left.push([-wsw * tooth, y]);
    }
    // Assemble: base (0,0) → up right side → tip → down left side → base.
    const raw: Pt2[] = [[0, 0], ...right, ...left.reverse()];
    // Rotate the leaflet about the base by `angle`, offset the base outward a
    // touch so fingers separate at the petiole.
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const baseOff = 0.04 * k;
    const outline: Pt2[] = raw.map(([x, y]) => [
      x * ca - y * sa + baseOff,
      x * sa + y * ca,
    ]);
    out.push({ outline });
  }
  return out;
}

/** A placed fan leaf ready to instance. */
export interface LeafInstance {
  pos: Vec3;
  /** Outward+up unit growth direction (blade +Y aligns to this). */
  dir: Vec3;
  /** Blade world size (scales the unit outline). */
  scale: number;
  /** Roll about `dir` so blades don't all face the same way. */
  roll: number;
  /** Extra pitch/yaw jitter (radians) applied after the dir alignment. */
  pitch: number;
  yaw: number;
  /** Deep waxy blue-green RGB 0..1. */
  color: [number, number, number];
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Turn the skeleton's raw leaf slots into full fan-leaf instances with a deep,
 * slightly blue-shifted waxy green and small per-leaf orientation variation.
 * Deterministic from `seed`.
 */
export function buildLeafPlacements(skeleton: PlantSkeleton, seed: number): LeafInstance[] {
  const rnd = mulberry32(((seed >>> 0) ^ 0x1b56c4e9) || 5);
  const out: LeafInstance[] = [];
  for (const branch of skeleton.branches) {
    for (const slot of branch.leafSlots) {
      // Dark serrated fan-leaf green with a faint blue lift (reference 3's
      // leaves read almost blue-black in shadow). Slight per-leaf variation.
      const shade = 0.82 + 0.18 * rnd();
      const r = 0.07 * shade;
      const g = (0.24 + 0.05 * rnd()) * shade;
      const b = (0.13 + 0.03 * rnd()) * shade;
      out.push({
        pos: slot.pos,
        dir: slot.dir,
        scale: slot.size,
        roll: slot.roll,
        pitch: (rnd() - 0.5) * 0.5,
        yaw: (rnd() - 0.5) * 0.5,
        color: [clamp01(r), clamp01(g), clamp01(b)],
      });
    }
  }
  return out;
}
