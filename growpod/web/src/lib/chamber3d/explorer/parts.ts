// Pure assembly of the 3D Anatomy Explorer's instance sets from genetics + grow
// params, reusing the shipped, unit-tested bud3d generators. NO three.js here —
// this stays deterministic and unit-testable: identical (dna, seed, params)
// always yield identical instances, and the renderer turns each group into one
// InstancedMesh (so the whole bud is a fixed 3 draw calls, however many glands).
//
// The Explorer is a RENDERER over the pure core — this module adds zero new
// genetics/geometry logic; it only orchestrates the existing builders and tags
// each group with the anatomy label the UI surfaces on pick/hover.

import { buildCola, type ColaInstance } from "@/lib/chamber/bud3d/cola";
import {
  buildFrost,
  buildPistils,
  type FrostInstance,
  type PistilInstance,
} from "@/lib/chamber/bud3d/detail";
import type { BudDNA } from "@/lib/chamber/budDna";

/** Anatomy parts the Explorer can show + label. Ordered outer → inner detail. */
export const ANATOMY_PARTS = ["calyx", "pistil", "trichome"] as const;
export type AnatomyPart = (typeof ANATOMY_PARTS)[number];

/** Short teaching labels (Professor-Flora voice) keyed by part. */
export const PART_LABELS: Record<AnatomyPart, { title: string; blurb: string }> = {
  calyx: {
    title: "Calyx",
    blurb:
      "The teardrop floral pod — the bud is a spiral of these. Swollen calyxes are where most resin sits.",
  },
  pistil: {
    title: "Pistil",
    blurb:
      "The hair (stigma) that catches pollen. It shifts white → amber → brown as the flower ripens.",
  },
  trichome: {
    title: "Trichome",
    blurb:
      "The resin gland. Clear → cloudy → amber tracks potency; you read harvest timing off these heads.",
  },
};

/** 0..1 grow params that drive the generators (mirror the BudGL prop set). */
export interface ExplorerParams {
  budDev: number; // bud development (accretion + swell)
  ripe: number; // ripeness (frost maturity + pistil amber)
  brown: number; // browning (pistils brown + curl)
  trich: number; // frost amount (× dna.trichomeDensity)
  purple: number; // anthocyanin (lavender frost + magenta pistils)
  isMobile?: boolean;
}

export const DEFAULT_PARAMS: ExplorerParams = {
  budDev: 1,
  ripe: 0.5,
  brown: 0.1,
  trich: 0.8,
  purple: 0,
  isMobile: false,
};

export interface ExplorerInstances {
  cola: ColaInstance[];
  frost: FrostInstance[];
  pistils: PistilInstance[];
}

/**
 * Build every instance group for the Explorer from genetics + params. Pure and
 * deterministic — wraps the shipped generators with the exact arg shapes BudGL
 * uses, so the Explorer renders the same plant the chamber does for a given id.
 */
export function buildExplorerInstances(
  dna: BudDNA,
  seed: number,
  p: ExplorerParams = DEFAULT_PARAMS,
): ExplorerInstances {
  const isMobile = p.isMobile ?? false;
  const cola = buildCola(dna, seed, { budDev: p.budDev });
  const frost = buildFrost(cola, {
    seed,
    density: dna.trichomeDensity * p.trich,
    ripe: p.ripe,
    amberBias: p.purple * 0.4,
    isMobile,
  });
  const pistils = buildPistils(cola, {
    seed,
    chance: dna.pistilChance,
    ripe: p.ripe,
    brown: p.brown,
    magenta: p.purple,
    isMobile,
  });
  return { cola, frost, pistils };
}

/**
 * Draw-call cost of rendering these instances: one InstancedMesh per non-empty
 * group, so it is bounded by ANATOMY_PARTS.length (3) no matter the gland count.
 * The Explorer's perf budget (< 50 draw calls on mid mobile) holds by construction.
 */
export function drawCallCount(inst: ExplorerInstances): number {
  return (
    (inst.cola.length ? 1 : 0) +
    (inst.frost.length ? 1 : 0) +
    (inst.pistils.length ? 1 : 0)
  );
}
