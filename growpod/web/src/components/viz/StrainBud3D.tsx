"use client";

// Strain-catalog hero bud — the high-fidelity 3D render (frost + pistils + ribbed
// calyxes) used on the strain-lab "Buy seed" page, replacing the flat Canvas-2D
// GrowChamber for the showcase view. It reuses the shipped BudGL pipeline
// (instanced calyxes / trichome-frost icospheres with a wet-resin material /
// amber pistil strands) so a catalog strain reads as a real frosted cola, not a
// cluster of green discs. Deterministic per strain (same dna+seed → same bud).
//
// Must load via dynamic({ ssr: false }) at the call site (three.js touches window).

import { useMemo } from "react";
import { BudGL } from "@/components/viz/BudGL";
import type { BudDNA } from "@/lib/chamber/budDna";

// Hue band counted as "purple-capable" (mirrors applyEnvironmentToBudDNA).
const PURPLE_LO = 255;
const PURPLE_HI = 320;

/** Share of the palette weight sitting in the purple band → how purple this
 * pheno reads. Deterministic; drives BudGL's lavender-frost / magenta-pistil tint
 * so green strains stay green-with-orange-pistils and purple strains shift. */
function purpleness(dna: BudDNA): number {
  const total = dna.palette.reduce((s, p) => s + p.weight, 0) || 1;
  const purple = dna.palette
    .filter((p) => p.hue >= PURPLE_LO && p.hue <= PURPLE_HI)
    .reduce((s, p) => s + p.weight, 0);
  return Math.min(1, purple / total);
}

export interface StrainBud3DProps {
  dna: BudDNA;
  seed: number;
  reducedMotion?: boolean;
}

/**
 * A mature, heavily-frosted catalog bud. Tuned for the "is this worth buying?"
 * shot: full development, peak trichome coverage (reads white-frosted), a
 * cloudy→amber ripeness so the frost catches warm light, light browning on the
 * pistils. Genetics still drive the base colour + structure.
 */
export function StrainBud3D({ dna, seed, reducedMotion = false }: StrainBud3DProps) {
  const purple = useMemo(() => purpleness(dna), [dna]);
  return (
    <BudGL
      dna={dna}
      seed={seed}
      budDev={1} // fully accreted, swollen cola
      ripe={0.58} // cloudy→amber: frost reads bright with warm glints
      brown={0.12} // a little pistil age
      trich={1} // PEAK frost — the catalog bud should look caked in resin
      purple={purple}
      reducedMotion={reducedMotion}
    />
  );
}
