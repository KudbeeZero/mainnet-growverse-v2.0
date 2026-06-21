// Local Demo Mode — a fully offline, on-device grow so the owner can reach the
// playable loop while cloud login (growverse-api / BACKEND_URL) is being
// finalized. This is NOT the real server-authoritative simulation: growth and
// care here are a simple local tick persisted to localStorage. Nothing syncs to
// the cloud, no wallet/chain, no backend calls. Honest by design.

import type { ConditionFlag, GrowthStage } from "@/lib/types";

export const DEMO_STORAGE = "gpe.demo";

// Schema version for the locally-saved demo grow. Bump whenever the demo's shape
// or seeding changes so stale state is evicted on the next load instead of
// resuming. v2 evicts the pre-#52 fixed "original" plant that was saved before
// the demo became a strain picker — that legacy grow must not reappear.
export const DEMO_VERSION = 2;

/** A strain a demo grower can pick. Curated (offline) — mirrors the authored
 * catalog strains the renderer already knows, with the headline stats. */
export interface DemoStrain {
  slug: string;
  name: string;
  lineage: "indica" | "sativa" | "hybrid";
  thc: number;
  floweringDays: [number, number];
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

export const DEMO_STRAINS: DemoStrain[] = [
  { slug: "white-widow", name: "White Widow", lineage: "hybrid", thc: 19, floweringDays: [56, 63], rarity: "common" },
  { slug: "white-rhino", name: "White Rhino", lineage: "indica", thc: 22, floweringDays: [56, 63], rarity: "uncommon" },
  { slug: "g13", name: "G13", lineage: "indica", thc: 24, floweringDays: [56, 63], rarity: "rare" },
  { slug: "white-fire-og", name: "White Fire OG", lineage: "hybrid", thc: 22, floweringDays: [60, 67], rarity: "rare" },
  { slug: "animal-mints", name: "Animal Mints", lineage: "hybrid", thc: 26, floweringDays: [56, 63], rarity: "rare" },
  { slug: "gelato", name: "Gelato", lineage: "hybrid", thc: 25, floweringDays: [55, 60], rarity: "epic" },
  { slug: "purple-diddy-punch", name: "Purple Diddy Punch", lineage: "indica", thc: 23, floweringDays: [58, 65], rarity: "epic" },
  { slug: "wedding-cake", name: "Wedding Cake", lineage: "hybrid", thc: 25, floweringDays: [58, 63], rarity: "legendary" },
];

/** The chosen demo strain, falling back to the first when the slug is unknown. */
export function strainForSlug(slug?: string): DemoStrain {
  return DEMO_STRAINS.find((s) => s.slug === slug) ?? DEMO_STRAINS[0];
}

export interface DemoGrow {
  /** Schema version (see DEMO_VERSION). Older/absent → evicted on load. */
  version: number;
  growerName: string;
  podName: string;
  strainName: string;
  /** Slug of the picked strain (links to the renderer/genetics). */
  strainSlug: string;
  day: number;
  stage: GrowthStage;
  /** 0..120, cosmetic height for the renderer scale narrative. */
  height: number;
  health: number; // 0..100
  water: number; // 0..100
  nutrients: number; // 0..100
  light: boolean;
  createdAt: string;
  updatedAt: string;
}

const STAGES: GrowthStage[] = [
  "seed",
  "germination",
  "seedling",
  "vegetative",
  "flowering",
  "late_flower",
  "harvest",
];

export function loadDemo(): DemoGrow | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE);
    if (!raw) return null;
    const g = JSON.parse(raw) as DemoGrow;
    // Evict legacy/stale demo state (e.g. the pre-#52 fixed "original" plant
    // saved before the strain picker existed) so the visit starts clean.
    if (!g || g.version !== DEMO_VERSION) {
      window.localStorage.removeItem(DEMO_STORAGE);
      return null;
    }
    return g;
  } catch {
    return null;
  }
}

export function saveDemo(g: DemoGrow): DemoGrow {
  const next = { ...g, version: DEMO_VERSION, updatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(DEMO_STORAGE, JSON.stringify(next));
  } catch {
    /* storage disabled/full — keep the in-memory grow usable */
  }
  return next;
}

export function startDemo(growerName?: string, strainSlug?: string): DemoGrow {
  const now = new Date().toISOString();
  const strain = strainForSlug(strainSlug);
  return saveDemo({
    version: DEMO_VERSION,
    growerName: (growerName ?? "").trim() || "Demo Grower",
    podName: "Starter Pod",
    strainName: strain.name,
    strainSlug: strain.slug,
    day: 1,
    stage: "seed",
    height: 2,
    health: 100,
    water: 80,
    nutrients: 70,
    light: true,
    createdAt: now,
    updatedAt: now,
  });
}

export function resetDemo(): void {
  try {
    window.localStorage.removeItem(DEMO_STORAGE);
  } catch {
    /* ignore */
  }
}

export function waterPlant(g: DemoGrow): DemoGrow {
  return saveDemo({ ...g, water: Math.min(100, g.water + 35) });
}

export function feedPlant(g: DemoGrow): DemoGrow {
  return saveDemo({ ...g, nutrients: Math.min(100, g.nutrients + 30) });
}

export function toggleLight(g: DemoGrow): DemoGrow {
  return saveDemo({ ...g, light: !g.light });
}

/**
 * Advance one local "day": move toward harvest, decay water/nutrients, and
 * nudge health based on care. Deliberately simple — a teaser of the loop, not
 * the real simulation engine.
 */
export function advanceDay(g: DemoGrow): DemoGrow {
  const idx = STAGES.indexOf(g.stage);
  const stage = idx < STAGES.length - 1 ? STAGES[idx + 1] : g.stage;

  const water = Math.max(0, g.water - 25);
  const nutrients = Math.max(0, g.nutrients - 15);

  let health = g.health;
  if (g.water < 20 || g.water > 95) health -= 8; // thirsty or drowning
  else health += 4; // well-watered recovers
  if (!g.light) health -= 6; // no light hurts
  if (g.nutrients < 15) health -= 4;
  health = Math.max(0, Math.min(100, health));

  const height = stage === "harvest" ? g.height : Math.min(120, g.height + 6);

  return saveDemo({ ...g, day: g.day + 1, stage, water, nutrients, health, height });
}

/** Map the local grow state to renderer condition flags (visual feedback). */
export function demoFlags(g: DemoGrow): ConditionFlag[] {
  if (g.health <= 0) return [{ condition: "dead", severity: "severe" }];
  if (g.water < 20)
    return [{ condition: "underwatered", severity: g.water < 10 ? "moderate" : "mild" }];
  if (g.water > 95) return [{ condition: "overwatered", severity: "mild" }];
  if (g.nutrients < 15) return [{ condition: "nutrient_deficient", severity: "mild" }];
  return [{ condition: "healthy", severity: "mild" }];
}

export const STAGE_LABEL: Record<GrowthStage, string> = {
  seed: "Seed",
  germination: "Germination",
  seedling: "Seedling",
  vegetative: "Vegetative",
  flowering: "Flowering",
  late_flower: "Late Flower",
  harvest: "Harvest-ready",
};
