import { test, expect, type Page } from "@playwright/test";

// Proof for the "remove duplicate floating boost tray" fix: the chamber used
// to show TWO boost-apply surfaces reading the same useBoostStore state — the
// floating ArcadeHUD tray (4 boost buttons + its own grow-speed readout) AND
// the inline BoostsInline quick-chip row embedded in the GROW/ARCADE sheet.
// ArcadeHUD is now slimmed to REWIND + the chain row only; BoostsInline is the
// single boost-apply surface. Verifies (mobile 390x844 + desktop):
//   1. exactly one boost-apply surface (BoostsInline's quick chips) — no
//      "Add Boost" button, no ArcadeHUD-style boost buttons with a
//      "<LABEL> <N>× boost" aria-label duplicating the chips;
//   2. the REWIND control (⏪) still renders and opens its snapshot sheet;
//   3. nothing else regressed: care tiles, ARCADE sheet, growth-boost button.
// Hermetic (mock API), same pattern as care-loop-shot.spec.ts.

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
    const entries = Object.entries(overrides).sort((a, b) => b[0].length - a[0].length);
    for (const [needle, body] of entries) if (path.includes(needle)) return json(body);
    if (path.endsWith("/players/p1")) return json(PLAYER);
    if (path.endsWith("/wallet")) return json(WALLET);
    if (path.endsWith("/level")) return json(LEVEL);
    return json([]);
  });
}

async function assertSingleBoostSurface(page: Page) {
  // BoostsInline is present (the one boost surface).
  await expect(page.getByText(/^BOOSTS/i).first()).toBeVisible();
  // No leftover "Add Boost" button (used to expand the old ArcadeHUD tray).
  await expect(page.getByRole("button", { name: /Add Boost/i })).toHaveCount(0);
  // No duplicate ArcadeHUD-style boost-apply buttons (their old aria-label
  // pattern was "<LABEL> <N>× boost", e.g. "NUTRIENT SURGE 2× boost" — distinct
  // from the ChamberActionBar's single "Apply boost" tile, which stays).
  await expect(
    page.getByRole("button", { name: /(NUTRIENT SURGE|LIGHT BLAST|MYCORRHIZAL POP|ROOT JUICE) [\d.]+× boost/i }),
  ).toHaveCount(0);
  // Exactly the 4 quick-boost chips from BoostsInline remain (title attrs are
  // unique per type/cooldown state, so count via the accessible label prefix).
  const chips = page.getByRole("button", { name: /Quick-apply|on cooldown, ready in/i });
  await expect(chips).toHaveCount(4);
  // The REWIND control (ArcadeHUD, slimmed) still renders.
  await expect(page.getByRole("button", { name: /Time rewind/i })).toBeVisible();
}

test.describe("mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("PROOF: single boost surface + rewind works on mobile", async ({ page }) => {
    await setup(page);
    await page.goto("/dashboard/plants/plant1/chamber");
    await assertSingleBoostSurface(page);

    // Rewind still opens its snapshot sheet.
    await page.getByRole("button", { name: /Time rewind/i }).click();
    await expect(page.getByText(/Rewind ·.*snapshots/i)).toBeVisible();

    // Nothing else regressed: care tiles + growth-boost button still present.
    for (const label of ["WATER", "FEED", "PRUNE", "TRAIN"]) {
      await expect(page.getByRole("button", { name: new RegExp(label, "i") }).first()).toBeVisible();
    }
    await expect(page.getByTestId("growth-boost")).toBeVisible();

    await page.screenshot({ path: "e2e-output/dedupe-mobile.png", fullPage: true });
  });
});

test.describe("desktop 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("PROOF: single boost surface + rewind works on desktop", async ({ page }) => {
    await setup(page);
    await page.goto("/dashboard/plants/plant1/chamber");
    await assertSingleBoostSurface(page);

    await page.getByRole("button", { name: /Time rewind/i }).click();
    await expect(page.getByText(/Rewind ·.*snapshots/i)).toBeVisible();

    for (const label of ["WATER", "FEED", "PRUNE", "TRAIN"]) {
      await expect(page.getByRole("button", { name: new RegExp(label, "i") }).first()).toBeVisible();
    }
    await expect(page.getByTestId("growth-boost")).toBeVisible();

    await page.screenshot({ path: "e2e-output/dedupe-desktop.png", fullPage: true });
  });
});
