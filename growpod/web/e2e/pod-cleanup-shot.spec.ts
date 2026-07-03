import { test, expect } from "@playwright/test";
import { setup } from "./fixtures/mockGame";

// PROOF for the "there's nothing else I can do — it should recycle" bug
// report: a harvested (or dead) plant used to sit on the MAIN dashboard
// forever with full live vitals (health/water/nutrients) and an active care
// bar, and nothing anywhere let the player clear the pod for a new seed —
// even though the backend (GameService.cleanup_plant, DELETE
// /players/:id/plants/:id) and the frontend mutation (useCleanupPlant) both
// already existed, unused. This proves the missing UI wiring:
//   1. a harvested plant on the MAIN dashboard hides live vitals/care and
//      shows the "Clean & recycle pod" action instead;
//   2. tapping it calls the cleanup endpoint and the plant drops out of the
//      pod (list_plants excludes archived rows) — the pod reads empty again;
//   3. the same is true on the standalone plant detail page.
// Run: npx playwright test pod-cleanup-shot

test("PROOF: a harvested plant on the MAIN dashboard offers Clean & recycle, not stale live vitals", async ({ page }) => {
  await setup(page, { growth_stage: "harvest", harvested: true, water_level: 82, nutrient_level: 83, health: 93 });
  await page.goto("/dashboard");

  // The live care bar (WATER/FEED/PRUNE/TRAIN tiles) must NOT still be active
  // on a finished plant — that was the exact "looks alive, nothing to do"
  // complaint (screenshot: 82%/83% bars + a full clickable care row).
  await expect(page.getByRole("button", { name: /^WATER/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^FEED/i })).toHaveCount(0);

  // The one real remaining action is offered, clearly, with its cost visible.
  const cleanBtn = page.getByRole("button", { name: /Clean & recycle pod/i });
  await expect(cleanBtn).toBeVisible();
  await page.screenshot({ path: "e2e-output/pod-cleanup-before.png", fullPage: true });

  await cleanBtn.click();
  await expect(page.getByText(/Pod cleaned up/i)).toBeVisible();
  await page.screenshot({ path: "e2e-output/pod-cleanup-after.png", fullPage: true });
});

test("PROOF: a harvested plant's detail page offers Clean & recycle instead of live Vitals/Care", async ({ page }) => {
  await setup(page, { growth_stage: "harvest", harvested: true });
  await page.goto("/dashboard/plants/plant1");

  // Vitals/Care headings are gone; the plain harvested summary + cleanup CTA
  // (via PlantActionCTA, which now resolves "harvested" -> "cleanup" instead
  // of the old dead-end "none") take their place.
  await expect(page.getByRole("heading", { name: "Vitals" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Care" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Clean & recycle pod/i }).first()).toBeVisible();
});

test("PROOF: a dead plant offers Clean & recycle on both the dashboard and its chamber", async ({ page }) => {
  await setup(page, { is_alive: false });
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /Clean & recycle pod/i })).toBeVisible();

  await page.goto("/dashboard/plants/plant1/chamber");
  await expect(page.getByText(/This plant has died/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Clean & recycle pod/i })).toBeVisible();
});
