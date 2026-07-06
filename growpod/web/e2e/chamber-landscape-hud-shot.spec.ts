import { test, expect, type Page } from "@playwright/test";
import { setup } from "./fixtures/mockGame";

// Proof for the owner's "Landscape Mobile Overlay System" mockup: on a phone
// held sideways (landscape + short viewport) the chamber drops the docked rail
// and instead shows two edge tabs that reveal slide-out HUDs — LEFT = grow
// controls (actions), RIGHT = insights & management — keeping the plant the
// unobstructed center of the stage. Verifies:
//   1. the docked GROW/CLIMATE/TIME rail is NOT rendered (it's replaced);
//   2. both edge tabs (▸ open controls, ◂ open insights) are visible;
//   3. tapping the LEFT tab opens the GROW CONTROLS HUD with the care actions;
//   4. tapping a care action auto-compacts the HUD (closes it) so the plant
//      reaction plays center-stage;
//   5. the RIGHT tab opens the PLANT INSIGHTS HUD.
// Hermetic (shared mock fixture). Run: npx playwright test chamber-landscape-hud-shot

// iPhone-ish landscape: wide + short, which trips the (orientation: landscape)
// and (max-height: 520px) media query the chamber switches on.
test.use({ viewport: { width: 844, height: 390 } });

async function openChamber(page: Page) {
  await setup(page);
  await page.goto("/dashboard/plants/plant1/chamber");
}

test("PROOF: phone-landscape shows slide-out HUDs, not the docked rail", async ({ page }) => {
  await openChamber(page);

  // The docked tab rail is gone in this mode — no GROW/CLIMATE/TIME tab buttons.
  await expect(page.getByRole("button", { name: /^CLIMATE$/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^TIME$/i })).toHaveCount(0);

  // Both edge tabs are present.
  const leftTab = page.getByRole("button", { name: /Open grow controls/i });
  const rightTab = page.getByRole("button", { name: /Open plant insights/i });
  await expect(leftTab).toBeVisible();
  await expect(rightTab).toBeVisible();
  await page.screenshot({ path: "e2e-output/chamber-landscape-compact.png", fullPage: true });

  // LEFT HUD: grow controls with the care actions.
  await leftTab.click();
  await expect(page.getByRole("heading", { name: /GROW CONTROLS/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /WATER/i }).first()).toBeVisible();
  await page.screenshot({ path: "e2e-output/chamber-landscape-left-hud.png", fullPage: true });

  // Auto-compact: tapping a care action closes the HUD (plant reaction plays
  // center-stage), so the heading is gone and the edge tabs are back.
  await page.getByRole("button", { name: /WATER/i }).first().click();
  await expect(page.getByRole("heading", { name: /GROW CONTROLS/i })).toHaveCount(0);
  await expect(leftTab).toBeVisible();

  // RIGHT HUD: insights & management. (The HUD title h2 + the panel's own h3
  // both read "PLANT INSIGHTS", so target the first.)
  await rightTab.click();
  await expect(page.getByRole("heading", { name: /PLANT INSIGHTS/i }).first()).toBeVisible();
  await expect(page.getByText(/TODAY'S PLAN/i)).toBeVisible();
  await page.screenshot({ path: "e2e-output/chamber-landscape-right-hud.png", fullPage: true });

  // Close via the ✕ button returns to the compact (plant-focused) view.
  await page.getByRole("button", { name: /Close panel/i }).first().click();
  await expect(page.getByRole("heading", { name: /PLANT INSIGHTS/i })).toHaveCount(0);
});
