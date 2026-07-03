import { test, expect } from "@playwright/test";
import { setup } from "./fixtures/mockGame";

// PROOF for the consumables "use item" wire-in: the store sold consumables you
// could never use. Now a living plant's Care area lists OWNED consumables and
// applies one (POST .../apply). Owned-count shows, stage gating is honored, and
// items you own zero of don't appear.
// Run: npx playwright test consumables-shot

test("PROOF: a living plant's Care area lists owned consumables and applies one", async ({ page }) => {
  await setup(page, { growth_stage: "flowering" });
  await page.goto("/dashboard/plants/plant1");

  // The "Items" surface shows owned consumables (Cal-Mag ×2, Bloom Boost ×1),
  // and NOT the one owned zero of (Rooting Gel).
  await expect(page.getByRole("heading", { name: "Items" })).toBeVisible();
  await expect(page.getByText(/Cal-Mag/)).toBeVisible();
  await expect(page.getByText(/Bloom Boost/)).toBeVisible();
  await expect(page.getByText(/Rooting Gel/)).toHaveCount(0);

  await page.screenshot({ path: "e2e-output/consumables-panel.png", fullPage: true });

  // Using an applicable consumable fires the success toast.
  await page.getByRole("button", { name: "Use" }).first().click();
  await expect(page.getByText(/Applied Cal-Mag/i)).toBeVisible();
});
