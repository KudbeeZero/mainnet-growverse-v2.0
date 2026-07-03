import { test, expect, type Page } from "@playwright/test";

// Proof: onboarding is skippable in ONE click for everyone. The first-grow
// tutorial (/ftue) and the dashboard guided tour used to stack — finishing or
// skipping the first did not dismiss the second, so a player faced ~18 prompts.
// Now leaving /ftue (skip OR finish) marks the dashboard tour complete too, so
// landing on /dashboard shows NO tutorial overlay. Hermetic (mock API), same
// pattern as smoke.spec.ts.

const PLAYER = {
  id: "p1", username: "Tester", email: null, algorand_address: null,
  xp: 100, level: 3, created_at: null, cannabis_cup_title: null, university_title: null,
  wallet: { id: "w1", player_id: "p1", balance: 5000, asa_balance: null, version: 0 },
};
const WALLET = { id: "w1", player_id: "p1", balance: 5000, asa_balance: null, version: 0 };
const LEVEL = { xp: 100, level: 3, xp_into_level: 50, xp_for_next_level: 100, progress_pct: 50 };
const POD = {
  id: "pod1", player_id: "p1", name: "Starter Pod", capacity: 4, tier: "basic",
  active: true, auto_water: false, auto_feed: false,
  temperature: 24, humidity: 50, co2_level: 900, light_intensity: 700, ph_level: 6.3,
};
const COACHING = {
  provider: "ftue_coach",
  summary: "Welcome to GrowPod Empire 🌱",
  diagnosis: "Your Starter Pod and seed are ready — let's raise your first plant.",
  suggestions: [],
};

async function authedSession(page: Page) {
  // Authed, but DON'T pre-mark onboarding complete — the skip is what must do it.
  await page.addInitScript(() => {
    localStorage.setItem("gpe.player_id", "p1");
    localStorage.setItem("gpe.api_key", "test-key");
  });
}

async function mockApi(page: Page, ftueStep: "welcome" | "completed") {
  const status = {
    step: ftueStep,
    plant_id: null,
    completed: ftueStep === "completed",
    completed_at: ftueStep === "completed" ? new Date().toISOString() : null,
  };
  const overrides: Record<string, unknown> = {
    "/ftue/coaching": COACHING,
    "/ftue/status": status,
    "/pods": [POD],
    "/plants": [],
    "/strains": [],
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

test("PROOF: 'Skip onboarding' on /ftue lands on a clean dashboard with no tour overlay", async ({ page }) => {
  await authedSession(page);
  await mockApi(page, "welcome");

  await page.goto("/ftue");
  await page.getByRole("button", { name: /^Skip/ }).click();

  await page.waitForURL("**/dashboard");
  // The dashboard guided tour must NOT auto-start — skipping /ftue dismissed it.
  await expect(page.getByRole("dialog", { name: /Tutorial/ })).toHaveCount(0);
});

test("PROOF: finishing /ftue ('Enter the game') also skips the dashboard tour", async ({ page }) => {
  await authedSession(page);
  await mockApi(page, "completed");

  await page.goto("/ftue");
  await page.getByRole("button", { name: /Enter the game/ }).click();

  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("dialog", { name: /Tutorial/ })).toHaveCount(0);
});
