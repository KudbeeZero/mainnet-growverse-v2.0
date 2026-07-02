// Phase 2 — whole-plant ASSEMBLY (pure, DOM-free, unit-testable).
//
// Owner spec layers 4–7: place a big elongated cola on the apex (the main spear)
// and a smaller dense cola on every branch tip, then clad each cola with
// trichome frost (7), pistils (6) and sugar leaves (5) — all by REUSING the
// existing bud3d builders (buildCola / buildFrost / buildPistils /
// buildSugarLeaves) so the on-plant cola can never drift from the macro bud.
//
// Each cola is built once in the builders' UNIT space (y 0..1) and paired with a
// world transform (origin + growth axis + height/width scale). PlantGL applies
// that transform when it writes the instanced matrices, so nothing here touches
// three.js. LOD multipliers thin the per-cola instance counts for mid/far.
//
// Deterministic: every cola derives its own seed from the plant seed + its index.

import { buildCola, type ColaInstance } from "../chamber/bud3d/cola";
import {
  buildFrost,
  buildPistils,
  buildSugarLeaves,
  type FrostInstance,
  type PistilInstance,
  type SugarLeafInstance,
} from "../chamber/bud3d/detail";
import type { BudDNA } from "../chamber/budDna";
import type { Silhouette } from "../chamber/morphology";
import { buildPlantSkeleton, type PlantSkeleton, type Vec3 } from "./skeleton";
import { buildLeafPlacements, type LeafInstance } from "./leaves";

export type LODLevel = "close" | "mid" | "far";

/** Per-layer instance-count multipliers by LOD (all monotonic close ≥ mid ≥ far). */
export interface LODMul {
  /** Hard cap on calyxes per cola. */
  calyxCap: number;
  /** Frost density multiplier (0 disables). */
  frost: number;
  /** Pistil spawn-chance multiplier. */
  pistil: number;
  /** Sugar-leaf amount multiplier. */
  sugar: number;
}

export const LOD: Record<LODLevel, LODMul> = {
  close: { calyxCap: 380, frost: 1.0, pistil: 1.0, sugar: 1.0 },
  mid: { calyxCap: 180, frost: 0.5, pistil: 0.6, sugar: 0.6 },
  far: { calyxCap: 70, frost: 0.0, pistil: 0.0, sugar: 0.25 },
};

/** One cola placed in the world: unit-space instances + a world transform. */
export interface ColaPlacement {
  id: number;
  /** Base of the cola in world space. */
  origin: Vec3;
  /** Unit growth axis the cola points along. */
  axis: Vec3;
  /** World height of the cola (unit y 0..1 scales to this). */
  height: number;
  /** World half-width of the cola (unit x/z scales to this). */
  width: number;
  cola: ColaInstance[];
  frost: FrostInstance[];
  pistils: PistilInstance[];
  sugar: SugarLeafInstance[];
}

export interface PlantAssembly {
  skeleton: PlantSkeleton;
  colas: ColaPlacement[];
  leaves: LeafInstance[];
  /** Totals for the perf budget / LOD readout. */
  counts: {
    colas: number;
    calyxes: number;
    frost: number;
    pistils: number;
    sugar: number;
    leaves: number;
  };
}

export interface AssemblyOpts {
  lod: LODLevel;
  /** 0..1 ripeness (frost maturity + pistil amber). Default 0.5. */
  ripe?: number;
  /** 0..1 frost amount multiplier (× dna.trichomeDensity). Default 1. */
  trich?: number;
}

function buildOneCola(
  dna: BudDNA,
  seed: number,
  lod: LODMul,
  ripe: number,
  trich: number,
  /** Satellites carry lighter detail than the apex spear to hold the tri budget:
   *  a smaller calyx cap and the mobile frost/pistil/sugar budgets. */
  satellite: boolean,
): Pick<ColaPlacement, "cola" | "frost" | "pistils" | "sugar"> {
  const cap = satellite ? Math.round(lod.calyxCap * 0.72) : lod.calyxCap;
  const cola = buildCola(dna, seed, { budDev: 1, maxInstances: cap });
  const frost =
    lod.frost > 0
      ? buildFrost(cola, {
          seed,
          density: dna.trichomeDensity * trich * lod.frost,
          ripe,
          amberBias: 0,
          isMobile: satellite,
        })
      : [];
  const pistils =
    lod.pistil > 0
      ? buildPistils(cola, {
          seed,
          chance: dna.pistilChance * lod.pistil,
          // Pistils warm toward amber-orange faster than the frost matures, so
          // Blue Dream keeps silvery frost + vivid orange hairs woven through.
          ripe: Math.min(1, ripe + 0.5),
          brown: 0,
          magenta: 0,
          isMobile: satellite,
        })
      : [];
  const sugar =
    lod.sugar > 0
      ? buildSugarLeaves(cola, {
          seed,
          amount: dna.sugarLeafChance * 4 * lod.sugar,
          frost: trich,
          isMobile: satellite,
        })
      : [];
  return { cola, frost, pistils, sugar };
}

/**
 * Assemble the whole plant. Reuses the skeleton (layers 1–2), the fan leaves
 * (layer 3) and the bud3d cola/detail builders (layers 4–7). Pure + deterministic.
 */
export function buildPlantAssembly(
  dna: BudDNA,
  sil: Silhouette,
  seed: number,
  opts: AssemblyOpts,
): PlantAssembly {
  const lod = LOD[opts.lod];
  const ripe = opts.ripe ?? 0.5;
  const trich = opts.trich ?? 1;

  const skeleton = buildPlantSkeleton(sil, seed);
  const leaves = buildLeafPlacements(skeleton, seed);
  const colas: ColaPlacement[] = [];

  // Apex spear — the dominant main cola (id 0).
  {
    const s = (seed ^ 0x2545f491) >>> 0;
    const parts = buildOneCola(dna, s, lod, ripe, trich, false);
    colas.push({
      id: 0,
      origin: skeleton.apex,
      axis: skeleton.apexAxis,
      height: skeleton.apexColaHeight,
      width: skeleton.apexColaWidth,
      ...parts,
    });
  }

  // Satellite colas on every branch tip — smaller but dense.
  skeleton.branches.forEach((branch, i) => {
    const s = (seed + (i + 1) * 0x9e3779b1) >>> 0;
    const parts = buildOneCola(dna, s, lod, ripe, trich, true);
    colas.push({
      id: i + 1,
      origin: branch.tip,
      axis: branch.colaAxis,
      height: branch.colaHeight,
      width: branch.colaWidth,
      ...parts,
    });
  });

  const counts = {
    colas: colas.length,
    calyxes: colas.reduce((n, c) => n + c.cola.length, 0),
    frost: colas.reduce((n, c) => n + c.frost.length, 0),
    pistils: colas.reduce((n, c) => n + c.pistils.length, 0),
    sugar: colas.reduce((n, c) => n + c.sugar.length, 0),
    leaves: leaves.length,
  };

  return { skeleton, colas, leaves, counts };
}
