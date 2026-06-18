// Display-only morphology rows for the Command Center "PLANT DNA" rail.
//
// The backend does not (yet) track node counts, internode length, leaf shape,
// etc. — so these are derived deterministically from the SAME inputs the chamber
// renderer already uses (the strain's continuous `morphologyFor(indica_ratio)`
// and authored/derived `silhouetteFor(...)`), plus the lifecycle stage for node
// count. This is a thin presentation wrapper over existing chamber derivations,
// not a new model: an indica reads bushier/wider/denser, a sativa taller/airier,
// exactly as it renders. If the backend later makes morphology authoritative,
// swap this for the real fields.

import { morphologyFor } from "@/lib/chamber/morphology";
import { silhouetteFor } from "@/lib/chamber/strainVisuals";
import type { GrowthStage, Strain } from "@/lib/types";

export interface MorphologyRow {
  label: string;
  value: string;
}

// Approximate visible node count per lifecycle stage (before silhouette density).
const BASE_NODES: Record<GrowthStage, number> = {
  seed: 0,
  germination: 1,
  seedling: 2,
  vegetative: 5,
  flowering: 8,
  late_flower: 9,
  harvest: 9,
};

function bucket(v: number, lowMax: number, midMax: number, labels: [string, string, string]): string {
  return v < lowMax ? labels[0] : v < midMax ? labels[1] : labels[2];
}

export function morphologyRows(strain: Strain | undefined, stage: GrowthStage): MorphologyRow[] {
  const indica = strain?.indica_ratio ?? 0.5;
  const m = morphologyFor(indica);
  const s = silhouetteFor(strain?.slug ?? strain?.name, indica);
  const nodes = Math.max(0, Math.round((BASE_NODES[stage] ?? 0) * s.nodeDensity));

  return [
    { label: "Nodes", value: String(nodes) },
    // internode ranges ~0.08 (indica, tight) .. ~0.112 (sativa, stretched).
    { label: "Internode Length", value: bucket(m.internode, 0.092, 0.104, ["Short", "Medium", "Long"]) },
    // lowerSpread ranges ~0.96 (lean) .. ~1.5 (chunky / bushy).
    { label: "Branch Potential", value: bucket(s.lowerSpread, 1.05, 1.22, ["Low", "Medium", "High"]) },
    // leafW ranges ~0.62 (sativa, narrow) .. ~1.3 (indica, broad).
    { label: "Leaf Width", value: bucket(m.leafW, 0.85, 1.12, ["Narrow", "Medium", "Wide"]) },
    // lit ~31 (indica, dark) .. ~41 (sativa, light).
    { label: "Leaf Color", value: m.lit >= 38 ? "Light Green" : m.lit <= 34 ? "Dark Green" : "Green" },
    // branchStrength ~0.82 (weak) .. ~1.2 (sturdy).
    { label: "Stem Thickness", value: bucket(s.branchStrength, 0.95, 1.1, ["Thin", "Medium", "Thick"]) },
  ];
}
