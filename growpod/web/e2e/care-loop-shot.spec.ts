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
//      (Harvest now plan row + Harvest & Sell button);
//   3. the CHAMBER is now the GameShell HUD (see hud-shell-shot.spec.ts for
//      the full redesign proof): the persistent bottom dock keeps the six
//      care tiles always visible, while Plant Insights / Progress / Arcade
//      Boosts live inside the right edge overlay — present in the DOM only
//      once a player opens it, never permanently taking over the chamber;
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
  // ...and the primary harvest button is right there.
  await expect(page.getByRole("button", { name: /Harvest & Sell/i })).toBeVisible();
});

test("PROOF: the CHAMBER's bottom dock always shows the six care tiles; Insights stay tucked away until opened", async ({ page }) => {
  await setup(page);
  await page.goto("/dashboard/plants/plant1/chamber");

  // The persistent bottom command dock keeps the care tiles visible with NO
  // panel open at all — the chamber (hero) is never blocked to reach them.
  for (const label of ["WATER", "FEED", "PRUNE", "TRAIN"]) {
    await expect(page.getByRole("button", { name: new RegExp(label, "i") }).first()).toBeVisible();
  }

  // Insights/Boosts/Progress are real, but they live inside the right edge
  // overlay — not permanently on the chamber. Closed by default, so absent
  // from the DOM entirely (not just hidden), same as the old "moved to the
  // main page" assertion, but now the content is a swipe/click away instead
  // of gone.
  await expect(page.getByText(/PLANT INSIGHTS/i)).toHaveCount(0);
  await expect(page.getByText(/^BOOSTS/i)).toHaveCount(0);
  await page.screenshot({ path: "e2e-output/care-loop-chamber-compact.png", fullPage: true });

  // Open the right overlay (Insights & Management) — hovering the tab expands
  // it (desktop's "hover or click to reveal"); the real data appears.
  await page.getByTestId("edge-tab-right").hover();
  await expect(page.getByText(/Plant Insights/i)).toBeVisible();
  // Boosts/growth-boost live inside a nested collapsible — open it too.
  await page.getByRole("button", { name: /Arcade Boosts/i }).click();
  await expect(page.getByText(/^BOOSTS/i).first()).toBeVisible();
  await expect(page.getByTestId("growth-boost")).toBeVisible();
  await page.screenshot({ path: "e2e-output/care-loop-chamber-insights-open.png", fullPage: true });
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
