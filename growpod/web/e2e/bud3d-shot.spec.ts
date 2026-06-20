import { test, type Page } from "@playwright/test";

// Proof capture for Phase 1a — the WebGL/3D bud (macro "View Buds") rendering a
// real lit, volumetric cola instead of the flat 2D blob. Hermetic (mock API),
// mirrors slider-shot.spec.ts. The `?bud3d=1` query enables the renderer without
// a dedicated build. Run: npx playwright test bud3d-shot

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
const PLANT = {
  id: "plant1", player_id: "p1", pod_id: "pod1", strain_id: "str1",
  growth_stage: "flowering", planted_at: new Date(Date.now() - 600 * 3600_000).toISOString(),
  height: 110, health: 92, water_level: 75, nutrient_level: 70, pest_level: 0, disease_level: 0,
  condition_flags: [], is_alive: true, harvested: false,
};
function plantState() {
  const now = Date.now();
  return {
    ...PLANT,
    metrics: { vpd_kpa: 1.1, dli_mol: 34, ppfd: 700, photoperiod_hours: 12, nutrient_ppm: 900, stage_targets: [700, 1000] },
    forecast: {
      stage: "flowering", stage_index: 4, stage_count: 7, age_hours: 600, hours_in_stage: 120,
      next_stage: "late_flower", stage_progress_pct: 85, stage_base_hours: 140, stage_total_hours: 150,
      next_stage_eta: new Date(now + 30 * 60_000).toISOString(),
      hours_to_harvest: 12, harvest_eta: new Date(now + 12 * 3600_000).toISOString(),
      is_harvest_ready: false,
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

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("gpe.player_id", "p1");
    localStorage.setItem("gpe.api_key", "test-key");
    localStorage.setItem("gpe.onboarding", JSON.stringify({ state: { completed: { p1: true } }, version: 0 }));
  });
  const overrides: Record<string, unknown> = {
    "/pods": [POD],
    "/plants/plant1/state": plantState(),
    "/plants": [PLANT],
    "/strains": [STRAIN],
    "/turbo": { enabled: false, multiplier: 10, offset_hours: 0, effective_now: new Date().toISOString(), wall_now: new Date().toISOString(), synced_pods: 0 },
  };
  await page.route("**/api/game/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    for (const [needle, body] of Object.entries(overrides)) if (path.includes(needle)) return json(body);
    if (path.endsWith("/players/p1")) return json(PLAYER);
    if (path.endsWith("/wallet")) return json(WALLET);
    if (path.endsWith("/level")) return json(LEVEL);
    return json([]);
  });
}

test("PROOF: 3D bud renders in the macro view", async ({ page }) => {
  await setup(page);
  await page.goto("/dashboard/plants/plant1/chamber?bud3d=1");
  // "View Buds" appears once the plant is flowering; tap it to enter the macro view.
  const viewBuds = page.getByRole("button", { name: /View Buds/i });
  await viewBuds.waitFor({ timeout: 20_000 });
  await viewBuds.click();
  // Let the WebGL canvas mount + paint a few frames.
  await page.waitForSelector("canvas", { timeout: 15_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "e2e-output/bud3d-macro.png", fullPage: true });
});
