import { test, expect } from "@playwright/test";
import { setup } from "./fixtures/mockGame";

// Core game loop proof (owner directive: "anybody should be able to play the
// ENTIRE game from the main game page; the chamber is the ARCADE part").
// Hermetic — the mock API + auth seed live in ./fixtures/mockGame (shared, so
// ad-hoc capture sessions stop hand-copying them). Verifies:
//   1. the MAIN GAME PAGE (/dashboard) carries the full care loop — the six
//      care tiles, Today's Plan, Plant Insights, journal link — and tapping
//      Water makes the PLANT react (targeted reaction overlay);
//   2. a harvest-ready plant shows an unmissable next action ON THE MAIN PAGE
//      (Harvest now plan row + Harvest button — harvesting no longer force-sells,
//      so cure/mint/Enter Cup stay reachable from the Harvests panel afterward);
//   3. the CHAMBER reads as the arcade layer: action tiles + BOOSTS + growth
//      boost stay, the dashboard-y panels (Today's Plan / Plant Insights) are
//      gone from it;
//   4. a harvested plant's chamber shows the full next-action set
//      (Grow another / Harvest review / Enter the Cup / Save snapshot).
// Run: npx playwright test care-loop-shot

test("PROOF: the MAIN PAGE carries the full care loop + tapping Water makes the plant react", async ({ page }) => {
  await setup(page);
  await page.goto("/dashboard");

  // The Command Center's care deck shows the six glassy tiles.
  for (const label of ["WATER", "FEED", "PRUNE", "TRAIN", "BOOST"]) {
    await expect(page.getByRole("button", { name: new RegExp(label, "i") }).first()).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /INSPECT/i })).toBeVisible();
  // Dock panels live on the main page now: Today's Plan + Plant Insights + journal.
  await expect(page.getByText(/TODAY'S PLAN/i)).toBeVisible();
  await expect(page.getByText(/PLANT INSIGHTS/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /journal/i })).toBeVisible();
  // The chamber (arcade) is one tap away but never required.
  await expect(page.getByRole("link", { name: /Arcade/i })).toBeVisible();

  // Tap Water → the PLANT reacts: blue pulse in the root zone on the stage.
  await page.getByRole("button", { name: /WATER/i }).first().click();
  await expect(page.getByTestId("plant-reaction-water")).toBeVisible();
  await page.screenshot({ path: "e2e-output/care-loop-water-reaction.png", fullPage: true });
});

test("PROOF: harvest-ready plant shows an unmissable next action on the MAIN PAGE", async ({ page }) => {
  await setup(page, { growth_stage: "harvest" });
  await page.goto("/dashboard");
  // Today's Plan resolves to harvest as the top Do-Now row...
  await expect(page.getByText(/Harvest now/i).first()).toBeVisible();
  // ...and the primary harvest button is right there. Harvesting no longer
  // force-sells (that used to make cure/mint/Enter Cup unreachable from the
  // UI) — it now just harvests, landing the crop in the Harvests panel where
  // sell/cure/mint/Enter-Cup are all offered explicitly.
  await expect(page.getByRole("button", { name: "✂️ Harvest" })).toBeVisible();
});

test("PROOF: the CHAMBER is the arcade layer — boosts stay, dashboard panels are gone", async ({ page }) => {
  await setup(page);
  await page.goto("/dashboard/plants/plant1/chamber");

  // Arcade feel keeps the embedded action tiles on the stage...
  for (const label of ["WATER", "FEED", "PRUNE", "TRAIN"]) {
    await expect(page.getByRole("button", { name: new RegExp(label, "i") }).first()).toBeVisible();
  }
  // ...and the ARCADE sheet: boosts inline + quick chips + growth boost.
  await expect(page.getByRole("button", { name: /ARCADE/i })).toBeVisible();
  await expect(page.getByText(/^BOOSTS/i).first()).toBeVisible();
  await expect(page.getByTestId("growth-boost")).toBeVisible();

  // The dashboard-y panels moved to the main page — they must NOT be here.
  await expect(page.getByText(/TODAY'S PLAN/i)).toHaveCount(0);
  await expect(page.getByText(/PLANT INSIGHTS/i)).toHaveCount(0);
  await expect(page.getByText(/PLANT PROGRESS/i)).toHaveCount(0);
  await page.screenshot({ path: "e2e-output/care-loop-chamber-arcade.png", fullPage: true });
});

test("PROOF: harvested plant shows the full next-action set", async ({ page }) => {
  await setup(page, { growth_stage: "harvest", harvested: true });
  await page.goto("/dashboard/plants/plant1/chamber");
  await expect(page.getByText(/Harvest complete!/i)).toBeVisible();
  // "Grow another" pays the pod-cleanup fee before navigating away (was a
  // plain Link that left the harvested plant sitting in the pod forever) —
  // now a button so it can fire the DELETE /plants/:id cleanup first.
  await expect(page.getByRole("button", { name: /Grow another/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Harvest review/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Enter the Cup/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Save snapshot/i })).toBeVisible();
  await page.screenshot({ path: "e2e-output/care-loop-harvested.png", fullPage: true });
});
