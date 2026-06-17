import { test, expect, type Page } from "@playwright/test";

// A minimal valid player/wallet so the authed shell renders.
const PLAYER = {
  id: "p1",
  username: "Tester",
  email: null,
  algorand_address: null,
  xp: 100,
  level: 3,
  created_at: null,
  cannabis_cup_title: null,
  university_title: null,
  wallet: { id: "w1", player_id: "p1", balance: 500, asa_balance: null, version: 0 },
};
const WALLET = { id: "w1", player_id: "p1", balance: 500, asa_balance: null, version: 0 };
const LEVEL = { xp: 100, level: 3, xp_into_level: 50, xp_for_next_level: 100, progress_pct: 50 };

/** Pretend we're a logged-in player (the app reads these on mount). */
async function authedSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("gpe.player_id", "p1");
    localStorage.setItem("gpe.api_key", "test-key");
  });
}

/** Stub every game-API call with deterministic JSON. */
async function mockApi(page: Page, overrides: Record<string, unknown> = {}) {
  await page.route("**/api/game/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (body: unknown) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });

    for (const [needle, body] of Object.entries(overrides)) {
      if (path.includes(needle)) return json(body);
    }
    if (path.endsWith("/players/p1")) return json(PLAYER);
    if (path.endsWith("/wallet")) return json(WALLET);
    if (path.endsWith("/level")) return json(LEVEL);
    if (path.endsWith("/pods")) return json([]);
    if (path.endsWith("/plants")) return json([]);
    // Default: an empty list is a safe shape for the remaining list endpoints.
    return json([]);
  });
}

test("onboarding renders the brand hero and sign-up form", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: /Real genetics/i })).toBeVisible();
  await expect(page.getByText(/GALACTIC SERIES/i)).toBeVisible();
  // The create-account form is present.
  await expect(page.getByText(/Welcome to GrowPod Empire/i)).toBeVisible();
});

test("authed dashboard renders with an empty grow", async ({ page }) => {
  await authedSession(page);
  await mockApi(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Grow Dashboard/i })).toBeVisible();
  await expect(page.getByText(/No grow pods yet/i)).toBeVisible();
});

test("university catalog renders departments and courses", async ({ page }) => {
  await authedSession(page);
  await mockApi(page, {
    "/players/p1/university": {
      player_id: "p1",
      title: null,
      departments: { cultivation: "Cultivation" },
      courses: [
        {
          key: "basics_101",
          name: "Cultivation Basics",
          department: "cultivation",
          credits: 3,
          level_req: 1,
          duration_hours: 24,
          tuition: 150,
          prereqs: [],
          perks: {},
          lecture_topic: "Seedling care",
          practical: null,
          status: "available",
          progress: null,
        },
      ],
      degrees: [],
    },
  });
  await page.goto("/university");
  await expect(page.getByRole("heading", { name: /Course Catalog/i })).toBeVisible();
  await expect(page.getByText(/Cultivation Basics/i)).toBeVisible();
});
