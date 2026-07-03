import type { Page } from "@playwright/test";

// Shared mock-game fixtures for e2e specs and ad-hoc captures.
//
// Extracted verbatim from care-loop-shot.spec.ts, which every screenshot
// session used to copy by hand (the recon specs, the plant-round captures,
// the glow-layer evidence shots all carried private duplicates of these
// constants + setup()). One import replaces that ritual:
//
//   import { setup } from "./fixtures/mockGame";
//   await setup(page);                                  // flowering Gelato
//   await setup(page, { growth_stage: "harvest" });     // harvest-ready
//
// setup() mocks the entire game API at the network layer (page.route) and
// seeds localStorage auth, so no backend is required and runs are
// deterministic. `stateOver` overrides fields on the plant/state objects;
// `extraOverrides` adds/replaces path-matched API responses (longest needle
// wins, same matching rule as always).

export const PLAYER = {
  id: "p1", username: "Tester", email: null, algorand_address: null,
  xp: 100, level: 3, created_at: null, cannabis_cup_title: null, university_title: null,
  wallet: { id: "w1", player_id: "p1", balance: 500, asa_balance: null, version: 0 },
};
export const WALLET = { id: "w1", player_id: "p1", balance: 500, asa_balance: null, version: 0 };
export const LEVEL = { xp: 100, level: 3, xp_into_level: 50, xp_for_next_level: 100, progress_pct: 50 };
export const POD = {
  id: "pod1", player_id: "p1", name: "Tent A", capacity: 4, tier: "standard",
  active: true, auto_water: false, auto_feed: false,
  temperature: 22, humidity: 50, co2_level: 900, light_intensity: 700, ph_level: 6.3,
};
export const STRAIN = {
  id: "str1", name: "Gelato", slug: "gelato", lineage_type: "hybrid",
  rarity: "rare", indica_ratio: 0.55, thc_range: [22, 28], cbd_range: [0, 1],
  flowering_days: [55, 65], yield_range: [400, 600], difficulty: 3, terpenes: ["caryophyllene"],
  stability: 80, generation: 0, parent_a_id: null, parent_b_id: null, is_base_catalog: true,
  genome: null, bud_dna: null, nft_asset_id: null, nft_status: "none",
};

export function plant(over: Record<string, unknown> = {}) {
  return {
    id: "plant1", player_id: "p1", pod_id: "pod1", strain_id: "str1",
    growth_stage: "flowering", planted_at: new Date(Date.now() - 600 * 3600_000).toISOString(),
    height: 110, health: 92, water_level: 75, nutrient_level: 70, pest_level: 0, disease_level: 0,
    condition_flags: [], is_alive: true, harvested: false,
    ...over,
  };
}

export function plantState(over: Record<string, unknown> = {}) {
  const now = Date.now();
  const p = plant(over);
  return {
    ...p,
    metrics: { vpd_kpa: 1.1, dli_mol: 34, ppfd: 700, photoperiod_hours: 12, nutrient_ppm: 900, stage_targets: [700, 1000] },
    forecast: {
      stage: p.growth_stage, stage_index: 4, stage_count: 7, age_hours: 600, hours_in_stage: 120,
      next_stage: "late_flower", stage_progress_pct: 85, stage_base_hours: 140, stage_total_hours: 150,
      next_stage_eta: new Date(now + 30 * 60_000).toISOString(),
      hours_to_harvest: 12, harvest_eta: new Date(now + 12 * 3600_000).toISOString(),
      is_harvest_ready: p.growth_stage === "harvest",
    },
    trichomes: {
      active: true, density: 0.74, head_development: 0.7,
      clear_pct: 30.0, cloudy_pct: 62.0, amber_pct: 8.0,
      dominant: "cloudy", harvest_window: "peak",
      recommendation: "Cloudy-dominant with little amber — the ideal harvest window.",
    },
    recent_events: [],
  };
}

export async function setup(
  page: Page,
  stateOver: Record<string, unknown> = {},
  extraOverrides: Record<string, unknown> = {},
) {
  await page.addInitScript(() => {
    localStorage.setItem("gpe.player_id", "p1");
    localStorage.setItem("gpe.api_key", "test-key");
    localStorage.setItem("gpe.onboarding", JSON.stringify({ state: { completed: { p1: true } }, version: 0 }));
  });
  const overrides: Record<string, unknown> = {
    "/pods": [POD],
    "/plants/plant1/state": plantState(stateOver),
    "/plants/plant1/water": { ok: true },
    // Explicit, not just the "/plants" fallback below: without this, the
    // substring match returns the plants LIST for the events endpoint too
    // (both contain "/plants"), so EventLog renders plant objects as if they
    // were PlantEvents and crashes on the missing event_type field.
    "/plants/plant1/events": [],
    "/plants": [plant(stateOver)],
    // Must precede "/strains" in intent (longest-needle-first sorting handles
    // the ordering): the seasonal-drops endpoint is `/seasonal/strains`, which
    // otherwise substring-matches "/strains" and returns the CATALOG (whose
    // objects have `name`, not `strain_name`) — surfacing a bogus
    // "undefined — Seasonal genetics" card in the store.
    "/seasonal/strains": [],
    "/strains": [STRAIN],
    "/turbo": { enabled: false, multiplier: 10, offset_hours: 0, effective_now: new Date().toISOString(), wall_now: new Date().toISOString(), synced_pods: 0 },
    // University siblings — all contain "/players/p1/university" as a substring,
    // so they MUST be longer than the transcript key (27 chars) to sort before it
    // and avoid being swallowed. Without explicit entries, the transcript shape
    // would be returned for progress/learner/roadmap/admissions too.
    "/players/p1/university/progress": { kxp: 0, streak_count: 0, freeze_tokens: 0, last_study_date: null, next_nudge: null },
    "/players/p1/university/learner": { mastery_by_skill: {}, misconceptions: {}, preferred_format: null, goals: null, experience_level: "beginner", risk_level: "none", updated_at: null, engagement: { kxp: 0, streak_count: 0, freeze_tokens: 0, last_study_date: null } },
    "/players/p1/university/roadmap": { horizon_days: 7, steps: [], skipped_mastered: [], rationale: "", mastery_by_skill: {} },
    // Transcript — shorter key (27 chars), wins only for the exact transcript path
    // after the longer sibling keys above have already matched.
    "/players/p1/university": { player_id: "p1", title: null, departments: {}, courses: [], degrees: [] },
    // Strain sub-endpoints — all contain "/strains/str1", so they MUST be longer
    // (>13 chars) to sort before the single-strain key and return the right shape.
    // Without these, the STRAIN object was returned for knowledge/lineage/provenance
    // (which then crash reading .lineage.map / .in_knowledge_base on a Strain).
    "/strains/str1/knowledge": { strain_id: "str1", name: "Gelato", slug: "gelato", rarity: "rare", lineage_type: "hybrid", is_base_catalog: true, in_knowledge_base: false, knowledge: null },
    "/strains/str1/lineage": { strain_id: "str1", fully_verified: false, node_count: 0, root_count: 0, truncated: false, lineage: [] },
    "/strains/str1/provenance": { strain_id: "str1", verifiable: false },
    // Single-strain detail — shorter key (13 chars), wins only for the strain root
    "/strains/str1": STRAIN,
    // Owned-consumables catalog (GET /players/p1/shop) — one owned, one not, one
    // stage-gated — so the "use item" panel has something to render + gate.
    "/shop": [
      { key: "cal_mag", name: "Cal-Mag", cost: 20, description: "Corrects deficiency", stage_req: null, owned: 2 },
      { key: "bloom_boost", name: "Bloom Boost", cost: 40, description: "Fattens flowering buds", stage_req: "flowering", owned: 1 },
      { key: "rooting_gel", name: "Rooting Gel", cost: 15, description: "Speeds early roots", stage_req: "seedling", owned: 0 },
    ],
    // Apply an owned consumable — uses the full plant-scoped path so it sorts
    // longer than "/plants" (7 chars) and fires instead of returning the plant list.
    "/plants/plant1/apply": plant(stateOver),
    ...extraOverrides,
  };
  await page.route("**/api/game/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    // longest needle first so "/plants/plant1/state" beats "/plants"
    const entries = Object.entries(overrides).sort((a, b) => b[0].length - a[0].length);
    for (const [needle, body] of entries) if (path.includes(needle)) return json(body);
    if (path.endsWith("/players/p1")) return json(PLAYER);
    if (path.endsWith("/wallet")) return json(WALLET);
    if (path.endsWith("/level")) return json(LEVEL);
    return json([]);
  });
}
