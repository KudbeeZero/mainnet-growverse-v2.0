import { test, type Page } from "@playwright/test";

// Proof: the global speed toggle (⚡10×) is now reachable on the DASHBOARD plant
// card, so growth can be sped up from the main view. Hermetic (mock API).

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
  temperature: 24, humidity: 50, co2_level: 900, light_intensity: 700, ph_level: 6.3,
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
  growth_stage: "flowering", planted_at: new Date(Date.now() - 400 * 3600_000).toISOString(),
  height: 90, health: 90, water_level: 70, nutrient_level: 65, pest_level: 0, disease_level: 0,
  condition_flags: [], is_alive: true, harvested: false,
};
function plantState() {
  const now = Date.now();
  return {
    ...PLANT,
    metrics: { vpd_kpa: 1.1, dli_mol: 32, ppfd: 700, photoperiod_hours: 12, nutrient_ppm: 850, stage_targets: [700, 1000] },
    forecast: {
      stage: "flowering", stage_index: 4, stage_count: 7, age_hours: 400, hours_in_stage: 80,
      next_stage: "late_flower", stage_progress_pct: 60, stage_base_hours: 140, stage_total_hours: 150,
      next_stage_eta: new Date(now + 30 * 60_000).toISOString(),
      hours_to_harvest: 10, harvest_eta: new Date(now + 10 * 3600_000).toISOString(),
      is_harvest_ready: false,
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

test("PROOF: dashboard has a growth-preview scrubber", async ({ page }) => {
  await setup(page);
  await page.goto("/dashboard");
  // The dashboard's time control is the PREVIEW GROWTH scrubber now (the 250×
  // turbo toggle / ACCELERATE TIME were removed — the slider shows every stage).
  await page.getByText(/PREVIEW GROWTH/i).first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "e2e-output/dashboard-growth-preview.png", fullPage: true });
});
