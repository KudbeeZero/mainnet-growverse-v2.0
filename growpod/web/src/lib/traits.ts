// Genome -> displayed 0..100 trait bars for the Command Center "PLANT DNA" rail.
//
// IMPORTANT: genome values are NOT uniformly 0..1. Per the backend trait specs
// (src/growpodempire/genetics/traits.py) `thc` is 0–35 and `yield` is 50–800,
// while vigor / resistances / terpenes are 0..1. So each trait is normalized
// against its real range — never blindly ×100. Missing genome keys fall back to
// the same defaults the backend uses (0.5 for hidden traits, 0.12 terpene
// baseline, range midpoints for thc/yield) so catalog strains still render.

import type { Strain } from "@/lib/types";
import { morphologyFor, seedForPlant } from "@/lib/chamber/morphology";
import { budColorForStrain } from "@/lib/chamber/strainVisuals";

export interface TraitRow {
  key: string;
  label: string;
  /** 0..100, ready for the Bar component. */
  value: number;
}

const TERPENES = ["myrcene", "limonene", "caryophyllene", "pinene"] as const;

function gene(genome: Strain["genome"], key: string, fallback: number): number {
  const g = genome?.[key];
  return g && typeof g.value === "number" ? g.value : fallback;
}

const pct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** The six display traits shown in the mockup, normalized to 0..100. */
export function traitRows(strain: Strain | undefined): TraitRow[] {
  if (!strain) return [];
  const g = strain.genome;
  const yieldMid = (strain.yield_range[0] + strain.yield_range[1]) / 2;
  const thcMid = (strain.thc_range[0] + strain.thc_range[1]) / 2;

  const vigor = gene(g, "vigor", 0.5);
  const yieldVal = gene(g, "yield", yieldMid);
  const disease = gene(g, "disease_resistance", 0.5);
  const pest = gene(g, "pest_resistance", 0.5);
  const thc = gene(g, "thc", thcMid);
  const terpAvg = TERPENES.reduce((s, t) => s + gene(g, t, 0.12), 0) / TERPENES.length;
  // Colour expression reuses the deterministic per-strain anthocyanin roll the
  // chamber already uses to tint calyxes — no new genetics, stays consistent
  // with how the plant actually renders.
  const anthocyanin = budColorForStrain(
    strain.slug ?? strain.name,
    morphologyFor(strain.indica_ratio).hue,
    seedForPlant(strain.id),
  ).anthocyanin;

  return [
    { key: "growth", label: "Growth Rate", value: pct(vigor * 100) },
    { key: "yield", label: "Yield Potential", value: pct(((yieldVal - 50) / 750) * 100) },
    { key: "resilience", label: "Resilience", value: pct(((disease + pest) / 2) * 100) },
    { key: "thc", label: "THC Potential", value: pct((thc / 35) * 100) },
    { key: "terpene", label: "Terpene Richness", value: pct(terpAvg * 100) },
    { key: "color", label: "Color Expression", value: pct(anthocyanin * 100) },
  ];
}
