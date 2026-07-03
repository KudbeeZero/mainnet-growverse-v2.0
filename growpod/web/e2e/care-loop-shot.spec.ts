import { test, expect, type Page } from "@playwright/test";

// Core game loop proof (owner directive: "ship the playable game loop").
// Hermetic (mock API). Verifies, on the live chamber route:
//   1. all 7 care buttons render with availability states + benefit text,
//      and tapping one makes the PLANT react (targeted reaction overlay);
//   2. a harvest-ready plant shows an unmissable next action;
//   3. a harvested plant shows the full next-action set
//      (Grow another / Harvest review / Enter the Cup / Save snapshot).
// Run: npx playwright test care-loop-shot

const PLAYER = {
  id: "p1", username: "Tester", email: null, algorand_address: null,
  xp: 100, level: 3, created_at: null, cannabis_cup_title: null, university_title: null,
  wallet: { id: "w1", player_id: "p1", balance: 500, asa_balance: null, version: 0 },
};
const WALLET = { id: "w1", player_id: "p1", balance: 500, asa_balance: null, version: 0 };
const LEVEL = { xp: 100, level: 3, xp_into_level: 50, xp_for_next_level: 100, progress_pct: 50 };
const POD = {
  id: "pod1", player_id: "p1", name: "Tent A", capacity: 4, tier: "standard",
  active: true, auto_water: false, auto_feed: false,
  temperature: 22, humidity: 50, co2_level: 900, light_intensity: 700, ph_level: 6.3,
};
const STRAIN = {
  id: "str1", name: "Gelato", slug: "gelato", lineage_type: "hybrid",
  rarity: "rare", indica_ratio: 0.55, thc_range: [22, 28], cbd_range: [0, 1],
  flowering_days: [55, 65], yield_range: [400, 600], difficulty: 3, terpenes: ["caryophyllene"],
  stability: 80, generation: 0, parent_a_id: null, parent_b_id: null, is_base_catalog: true,
  genome: null, bud_dna: null, nft_asset_id: null, nft_status: "none",
};

function plant(over: Record<string, unknown> = {}) {
  return {
    id: "plant1", player_id: "p1", pod_id: "pod1", strain_id: "str1",
    growth_stage: "flowering", planted_at: new Date(Date.now() - 600 * 3600_000).toISOString(),
    height: 110, health: 92, water_level: 75, nutrient_level: 70, pest_level: 0, disease_level: 0,
    condition_flags: [], is_alive: true, harvested: false,
    ...over,
  };
}

function plantState(over: Record<string, unknown> = {}) {
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

async function setup(page: Page, stateOver: Record<string, unknown> = {}) {
  await page.addInitScript(() => {
    localStorage.setItem("gpe.player_id", "p1");
    localStorage.setItem("gpe.api_key", "test-key");
    localStorage.setItem("gpe.onboarding", JSON.stringify({ state: { completed: { p1: true } }, version: 0 }));
  });
  const overrides: Record<string, unknown> = {
    "/pods": [POD],
    "/plants/plant1/state": plantState(stateOver),
    "/plants/plant1/water": { ok: true },
    "/plants": [plant(stateOver)],
    "/strains": [STRAIN],
    "/turbo": { enabled: false, multiplier: 10, offset_hours: 0, effective_now: new Date().toISOString(), wall_now: new Date().toISOString(), synced_pods: 0 },
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

test("PROOF: care buttons show states + tapping Water makes the plant react", async ({ page }) => {
  await setup(page);
  await page.goto("/dashboard/plants/plant1/chamber");

  // All 7 care actions on the GROW tab (default tab).
  for (const label of ["Water", "Feed", "Treat Pests", "Treat Disease", "Prune", "Train", "Boost"]) {
    await expect(page.getByRole("button", { name: new RegExp(label, "i") }).first()).toBeVisible();
  }
  // No pests/disease on this plant → treatments are proactively disabled with a reason.
  await expect(page.getByRole("button", { name: /Treat Pests/i })).toBeDisabled();
  await expect(page.getByText(/No pests to treat right now/i)).toBeVisible();
  // Inspect + Journal always reachable from the care cluster.
  await expect(page.getByRole("link", { name: /Inspect/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Journal/i })).toBeVisible();

  // Tap Water → the PLANT reacts: blue pulse in the root zone on the stage.
  await page.getByRole("button", { name: /Water/i }).first().click();
  await expect(page.getByTestId("plant-reaction-water")).toBeVisible();
  await page.screenshot({ path: "e2e-output/care-loop-water-reaction.png", fullPage: true });
});

test("PROOF: harvest-ready plant shows an unmissable next action", async ({ page }) => {
  await setup(page, { growth_stage: "harvest" });
  await page.goto("/dashboard/plants/plant1/chamber");
  // The "what to do next" banner resolves to harvest...
  await expect(page.getByText(/Harvest now/i).first()).toBeVisible();
  // ...and the primary harvest button is right there.
  await expect(page.getByRole("button", { name: /Harvest & Sell/i })).toBeVisible();
});

test("PROOF: harvested plant shows the full next-action set", async ({ page }) => {
  await setup(page, { growth_stage: "harvest", harvested: true });
  await page.goto("/dashboard/plants/plant1/chamber");
  await expect(page.getByText(/Harvest complete/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Grow another/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Harvest review/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Enter the Cup/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Save snapshot/i })).toBeVisible();
  await page.screenshot({ path: "e2e-output/care-loop-harvested.png", fullPage: true });
});
