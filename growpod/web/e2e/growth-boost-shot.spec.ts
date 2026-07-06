import { test, type Page } from "@playwright/test";

// Proof: the purchasable (simulated) GROWTH BOOST in the Grow Chamber. The "grow"
// tab shows the "⚡ Boost Growth · 60 🌿" button; tapping it spends in-game GROW
// (mocked here) and plays the electric surge over the stage. Hermetic, mirrors
// bud3d-shot.spec.ts. Run: npx playwright test growth-boost-shot

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
  height: 110, health: 60, water_level: 55, nutrient_level: 50, pest_level: 0, disease_level: 0,
  condition_flags: [], is_alive: true, harvested: false,
};
function plantState(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    ...PLANT, ...overrides,
    metrics: { vpd_kpa: 1.1, dli_mol: 34, ppfd: 700, photoperiod_hours: 12, nutrient_ppm: 900, stage_targets: [700, 1000] },
    forecast: {
      stage: "flowering", stage_index: 4, stage_count: 7, age_hours: 600, hours_in_stage: 120,
      next_stage: "late_flower", stage_progress_pct: 85, stage_base_hours: 140, stage_total_hours: 150,
      next_stage_eta: new Date(now + 30 * 60_000).toISOString(),
      hours_to_harvest: 12, harvest_eta: new Date(now + 12 * 3600_000).toISOString(),
      is_harvest_ready: false,
    },
    recent_events: [],
  };
}
// After a boost: fast-forwarded + revived (taller, healthy, topped up).
const BOOSTED = plantState({ height: 130, health: 78, water_level: 80, nutrient_level: 80 });

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("gpe.player_id", "p1");
    localStorage.setItem("gpe.api_key", "test-key");
    localStorage.setItem("gpe.onboarding", JSON.stringify({ state: { completed: { p1: true } }, version: 0 }));
  });
  const overrides: Record<string, unknown> = {
    "/growth-boost": BOOSTED,            // must precede "/plants" (substring match)
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

test("PROOF: growth boost button + electric surge", async ({ page }) => {
  await setup(page);
  await page.goto("/dashboard/plants/plant1/chamber");
  // The CLIMATE tab is default and folds in the arcade toolbar — the
  // purchasable boost button is visible without switching tabs.
  const boost = page.getByTestId("growth-boost");
  await boost.waitFor({ timeout: 20_000 });
  await page.screenshot({ path: "e2e-output/growth-boost-button.png", fullPage: true });
  // Tap it → spends GROW (mocked) and flashes the ⚡ surge over the stage.
  await boost.click();
  await page.waitForTimeout(350); // catch the electric flash mid-animation
  await page.screenshot({ path: "e2e-output/growth-boost-surge.png", fullPage: true });
});
