// Phase 2 — whole-plant SKELETON builder (pure, DOM-free, unit-testable).
//
// Owner spec layer 1 (central stem / core) + layer 2 (secondary branches). Given
// a strain `Silhouette` (the same knobs the 2D chamber reads) and a seed, this
// emits the plant's structural axis: a tapered main stalk sampled as a spline
// with a slight organic bend and visible node positions, plus an array of
// upward-curving secondary branches whose length/angle derive from the
// silhouette (lowerSpread → skirt reach, nodeDensity → node spacing,
// apicalDominance → shrinking the UPPER branches so the central leader dominates,
// matching reference 3's tall central spear). Each branch carries the world-space
// size of the cola that sits on its tip and a set of fan-leaf anchor slots.
//
// Everything is deterministic from (silhouette, seed) using the project's
// mulberry32 PRNG — no Math.random — so a plant always rebuilds identically.

import { mulberry32 } from "../chamber/morphology";
import type { Silhouette } from "../chamber/morphology";

export type Vec3 = [number, number, number];

/** Golden angle — phyllotaxic azimuth spacing so branches spiral, not stack. */
const GOLDEN_ANGLE = 2.399963229728653;

/** A sample point along the tapered main stalk (base t=0 → apex t=1). */
export interface StemSample {
  pos: Vec3;
  /** Stem radius here (world units) — thick at the base, tapering to the tip. */
  radius: number;
  t: number;
}

/** A node ring on the main stalk — where branches + fan leaves attach. */
export interface PlantNode {
  pos: Vec3;
  radius: number;
  t: number;
}

/** A fan-leaf attachment slot (raw anchor; leaves.ts adds colour + jitter). */
export interface LeafSlot {
  pos: Vec3;
  /** Outward+up unit direction the leaf blade points. */
  dir: Vec3;
  /** Blade length in world units. */
  size: number;
  /** Roll about `dir` (radians). */
  roll: number;
}

/** A secondary branch: an upward-curving path with a cola on its tip. */
export interface BranchSpec {
  /** Index into `nodes` this branch springs from. */
  originNode: number;
  /** Catmull control points base→tip (world space) for the woody branch. */
  path: Vec3[];
  tip: Vec3;
  /** Branch base radius (world units), tapering to the tip. */
  radius: number;
  length: number;
  /** Height (world units) of the cola sitting on this tip (side colas smaller). */
  colaHeight: number;
  /** Half-width (world units) of that cola. */
  colaWidth: number;
  /** Growth axis the tip cola points along (up-and-outward). */
  colaAxis: Vec3;
  leafSlots: LeafSlot[];
}

export interface PlantSkeleton {
  /** Overall plant height in world units (base at y≈0). */
  height: number;
  /** Densely sampled main-stalk spline (for a tapered tube). */
  stem: StemSample[];
  /** Node rings up the stalk. */
  nodes: PlantNode[];
  branches: BranchSpec[];
  /** World position of the base of the main (apex) cola. */
  apex: Vec3;
  /** Growth axis of the main cola (essentially up, with the stalk's lean). */
  apexAxis: Vec3;
  /** Height (world units) of the main spear cola — the tallest on the plant. */
  apexColaHeight: number;
  /** Half-width (world units) of the main cola. */
  apexColaWidth: number;
}

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function norm(v: Vec3): Vec3 {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

/** Nominal plant height before the silhouette's vertical stacking is applied. */
const BASE_HEIGHT = 3.0;

/**
 * Build the plant skeleton. Pure + deterministic. The main stalk is a slightly
 * bent tapered spline; branches spring from node rings, curve upward, and shrink
 * toward the top by `apicalDominance` so the central leader reads as a dominant
 * spear (reference 3). Buds sit ON the branch tips.
 */
export function buildPlantSkeleton(sil: Silhouette, seed: number): PlantSkeleton {
  const rnd = mulberry32((seed >>> 0) || 1);

  const height = BASE_HEIGHT * (0.9 + 0.24 * sil.vertStack);
  const baseRadius = height * 0.028;

  // --- Main stalk: a spline with a gentle, coherent organic bend. ----------
  // One low-frequency lean (so the whole plant tilts a hair, like a real plant
  // reaching for light) plus a subtler secondary wobble. Deterministic phase.
  const leanDir = rnd() * Math.PI * 2;
  const leanAmp = height * 0.035 * (0.6 + rnd() * 0.8);
  const wobblePhase = rnd() * Math.PI * 2;
  const SAMPLES = 48;
  const stem: StemSample[] = [];
  const stemAt = (t: number): Vec3 => {
    const bend = leanAmp * t * t; // accumulates toward the top
    const wob = height * 0.012 * Math.sin(t * Math.PI * 2.3 + wobblePhase);
    const x = Math.cos(leanDir) * bend + Math.cos(leanDir + 1.7) * wob;
    const z = Math.sin(leanDir) * bend + Math.sin(leanDir + 1.7) * wob;
    return [x, t * height, z];
  };
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    // Taper: thick base → thin tip, with a slight base flare.
    const radius = baseRadius * lerp(1.0, 0.22, Math.pow(t, 0.85)) * (t < 0.06 ? 1.15 : 1);
    stem.push({ pos: stemAt(t), radius, t });
  }

  // --- Node rings: spacing from nodeDensity; live band up the stalk. --------
  const nodeCount = clamp(Math.round(7 * sil.nodeDensity), 5, 10);
  const nodeLo = 0.14; // first branch node above the bare base
  const nodeHi = 0.9; // last node below the apex cola
  const nodes: PlantNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    // vertStack packs nodes tighter toward the lower/mid stalk when >1.
    const u = nodeCount > 1 ? i / (nodeCount - 1) : 0;
    const packed = Math.pow(u, sil.vertStack > 1 ? 1.15 : 0.9);
    const t = lerp(nodeLo, nodeHi, packed);
    const p = stemAt(t);
    nodes.push({ pos: p, radius: baseRadius * lerp(1.0, 0.3, t), t });
  }

  // --- Branches: an opposite-ish pair per node, spiralling by golden angle. -
  const branches: BranchSpec[] = [];
  const skirt = sil.lowerSpread; // lower branches reach out this much more
  const upright = clamp(0.55 * sil.branchStrength - 0.18 * (sil.budWeightMul - 1), 0.28, 0.85);
  let azimuth = rnd() * Math.PI * 2;

  for (let n = 0; n < nodes.length; n++) {
    const node = nodes[n];
    const hf = node.t; // 0 lower .. ~1 upper
    // Upper branches shrink hard with apicalDominance so the leader dominates;
    // lower branches keep their skirt reach from lowerSpread.
    const domCut = 1 - sil.apicalDominance * hf * 0.92;
    const shorten = 1 - sil.upperShorten * hf;
    const lenBase = height * 0.34 * skirt;
    const length = clamp(lenBase * shorten * domCut * (0.85 + rnd() * 0.3), height * 0.08, height * 0.46);

    // A pair of branches at each node (decussate), rotated by the golden angle
    // between nodes so the canopy fills evenly rather than stacking in a plane.
    for (let s = 0; s < 2; s++) {
      const az = azimuth + s * Math.PI + (rnd() - 0.5) * 0.5;
      const out: Vec3 = [Math.cos(az), 0, Math.sin(az)];
      const o = node.pos;
      // A straight-ish branch climbing out and up at ~35–60° (steeper when the
      // stems are sturdy / apical). No inward curl — the tip ends past the elbow
      // so the cola clearly sits ON the branch tip (reference 3), not looped back.
      const theta = 0.62 + 0.5 * upright; // up-angle in radians
      const horiz = length * Math.cos(theta);
      const vert = length * Math.sin(theta);
      const tip: Vec3 = [o[0] + out[0] * horiz, o[1] + vert, o[2] + out[2] * horiz];
      const elbow: Vec3 = [
        o[0] + out[0] * horiz * 0.5,
        o[1] + vert * 0.42,
        o[2] + out[2] * horiz * 0.5,
      ];
      // Gentle upward bow: pull the mid a touch above the chord.
      const mid: Vec3 = [
        o[0] + out[0] * horiz * 0.76,
        o[1] + vert * 0.72 + length * 0.03,
        o[2] + out[2] * horiz * 0.76,
      ];
      // Side cola points mostly UP with a little outward lean (like the ref).
      const colaAxis = norm([out[0] * 0.4, 1, out[2] * 0.4]);

      // Side cola: smaller than the leader, sized off branch length × colaScale.
      const colaHeight = length * lerp(0.58, 0.4, hf) * sil.colaScale;
      const colaWidth = colaHeight * 0.4;

      // Fan-leaf slots: a big node fan at the branch base + a couple along it.
      const leafSlots: LeafSlot[] = [];
      const nodeLeafSize = height * 0.11 * sil.nodeLeaf;
      const slotCount = 2 + Math.floor(rnd() * 2);
      for (let l = 0; l < slotCount; l++) {
        const lt = l / Math.max(1, slotCount - 1); // 0 base .. 1 near tip
        const bp: Vec3 = [
          lerp(o[0], tip[0], lt * 0.8),
          lerp(o[1], tip[1], lt * 0.8),
          lerp(o[2], tip[2], lt * 0.8),
        ];
        const spin = azimuth + l * GOLDEN_ANGLE * 0.5;
        const ldir = norm([
          out[0] * 0.7 + Math.cos(spin) * 0.4,
          0.5 + 0.4 * upright,
          out[2] * 0.7 + Math.sin(spin) * 0.4,
        ]);
        leafSlots.push({
          pos: bp,
          dir: ldir,
          size: nodeLeafSize * lerp(1.0, 0.55, hf) * (0.8 + rnd() * 0.4),
          roll: rnd() * Math.PI * 2,
        });
      }

      branches.push({
        originNode: n,
        path: [o, elbow, mid, tip],
        tip,
        radius: node.radius * 0.6,
        length,
        colaHeight,
        colaWidth,
        colaAxis,
        leafSlots,
      });
    }
    azimuth += GOLDEN_ANGLE;
  }

  // --- Apex: the dominant main spear cola on top of the leader. ------------
  const apex = stemAt(nodeHi + 0.01);
  const apexAxis = norm([
    stemAt(1)[0] - stemAt(0.9)[0],
    (stemAt(1)[1] - stemAt(0.9)[1]) || 1,
    stemAt(1)[2] - stemAt(0.9)[2],
  ]);
  // The leader is the tallest cola on the plant — grows taller with
  // apicalDominance and colaScale so it clearly out-spears the satellites.
  const apexColaHeight = height * (0.24 + 0.16 * sil.apicalDominance) * sil.colaScale;
  const apexColaWidth = apexColaHeight * 0.26;

  return {
    height,
    stem,
    nodes,
    branches,
    apex,
    apexAxis,
    apexColaHeight,
    apexColaWidth,
  };
}
