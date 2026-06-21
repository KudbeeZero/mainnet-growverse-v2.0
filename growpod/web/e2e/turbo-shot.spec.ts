import { test, type Page } from "@playwright/test";

// Proof capture: with the global ⚡10× faucet ON, show (a) the dashboard pod's
// LIVE harvest countdown + green turbo glow on the main view, and (b) the Grow
// Chamber's single turbo button. Uses the same mock-API pattern as smoke.spec.ts
// so it runs hermetically (no backend). Run: npx playwright test turbo-shot

const PLAYER = {
  id: "p1", username: "Tester", email: null, algorand_address: null,
  xp: 100, level: 3, created_at: null, cannabis_cup_title: null, university_title: null,
  wallet: { id: "w1", player_id: "p1", balance: 500, asa_balance: null, version: 0 },
};
const WALLET = { id: "w1", player_id: "p1", balance: 500, asa_balance: null, version: 0 };
const LEVEL = { xp: 100, level: 3, xp_into_level: 50, xp_for_next_level: 100, progress_pct: 50 };

// Turbo ON, 10× — this is what makes the pod glow green and the countdown race.
const TURBO = {
  enabled: true, multiplier: 10, offset_hours: 0,
  effective_now: new Date().toISOString(), wall_now: new Date().toISOString(),
  synced_pods: 1,
};

const POD = {
  id: "pod1", player_id: "p1", name: "Tent A", capacity: 4, tier: "standard",
  active: true, auto_water: false, auto_feed: false,
  temperature: 24, humidity: 55, co2_level: 900, light_intensity: 600, ph_level: 6.3,
};

const STRAIN = {
  id: "str1", name: "Galactic Runtz", slug: "galactic-runtz", lineage_type: "hybrid",
  rarity: "rare", indica_ratio: 0.5, thc_range: [22, 28], cbd_range: [0, 1],
  flowering_days: [55, 65], yield_range: [400, 600], difficulty: 3, terpenes: ["limonene"],
  stability: 80, generation: 0, parent_a_id: null, parent_b_id: null, is_base_catalog: true,
  genome: null, bud_dna: null, nft_asset_id: null, nft_status: "none",
};

const PLANT = {
  id: "plant1", player_id: "p1", pod_id: "pod1", strain_id: "str1",
  growth_stage: "flowering", planted_at: new Date(Date.now() - 200 * 3600_000).toISOString(),
  height: 80, health: 88, water_level: 70, nutrient_level: 65, pest_level: 5, disease_level: 2,
  condition_flags: [], is_alive: true, harvested: false,
};

function plantState() {
  const now = Date.now();
  return {
    ...PLANT,
    metrics: { vpd_kpa: 1.1, dli_mol: 32, ppfd: 600, photoperiod_hours: 12, nutrient_ppm: 850, stage_targets: [700, 1000] },
    forecast: {
      stage: "flowering", stage_index: 4, stage_count: 7, age_hours: 200, hours_in_stage: 40,
      next_stage: "late_flower", stage_progress_pct: 55, stage_base_hours: 120, stage_total_hours: 140,
      next_stage_eta: new Date(now + 30 * 60_000).toISOString(),
      hours_to_harvest: 1.5, harvest_eta: new Date(now + 90 * 60_000).toISOString(),
      is_harvest_ready: false,
    },
    recent_events: [],
  };
}

async function authedSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("gpe.player_id", "p1");
    localStorage.setItem("gpe.api_key", "test-key");
    // Mark the guided tutorial complete so its overlay doesn't cover the pod card.
    localStorage.setItem(
      "gpe.onboarding",
      JSON.stringify({ state: { completed: { p1: true } }, version: 0 }),
    );
  });
}

async function mockApi(page: Page) {
  // Order matters: more specific paths first (path.includes match).
  const overrides: Record<string, unknown> = {
    "/turbo": TURBO,
    "/pods": [POD],
    "/plants/plant1/state": plantState(),
    "/plants": [PLANT],
    "/strains": [STRAIN],
  };
  await page.route("**/api/game/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    for (const [needle, body] of Object.entries(overrides)) {
      if (path.includes(needle)) return json(body);
    }
    if (path.endsWith("/players/p1")) return json(PLAYER);
    if (path.endsWith("/wallet")) return json(WALLET);
    if (path.endsWith("/level")) return json(LEVEL);
    return json([]);
  });
}

test("PROOF: dashboard command center shows a live turbo countdown + ⚡ toggle, chamber has one ⚡ button", async ({ page }) => {
  await authedSession(page);
  await mockApi(page);

  // (a) Main dashboard view — the Command Center's live "TIME REMAINING"
  // countdown plus the ⚡10× turbo toggle (ON, green) right on the time strip.
  await page.goto("/dashboard");
  await page.getByText(/TIME REMAINING/i).first().waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /⚡\s*10×/ }).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(2500); // let the countdown tick a couple seconds
  await page.screenshot({ path: "e2e-output/turbo-dashboard-full.png", fullPage: true });

  // (b) Grow Chamber — confirm the single ⚡10× faucet button (ON, green).
  await page.goto("/dashboard/plants/plant1/chamber");
  await page.getByText(/⚡/).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e-output/turbo-chamber.png", fullPage: true });
});
