import { test, expect } from "@playwright/test";
import { setup } from "./fixtures/mockGame";

// PROOF for the arcade boost juice (owner: "on a boost the plant shrinks a teeny
// bit, then pops bigger, then bounces back"). A boost fires the squash-stretch
// `gpe-plant-bounce` on the plant canvas. See the rulebook in
// docs/memory/design/12-arcade-animation-system.md.

test("PROOF: an arcade boost plays the squash-stretch bounce on the plant", async ({ page }) => {
  await setup(page, { growth_stage: "late_flower" });
  await page.goto("/dashboard/plants/plant1/chamber");
  await page.waitForTimeout(1500);

  // No bounce at rest.
  await expect(page.locator("canvas.gpe-plant-bounce")).toHaveCount(0);

  // A boost-applied event squashes/stretches the plant.
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("growpod:boost-applied", { detail: { type: "water", multiplier: 2 } }),
    ),
  );
  await expect(page.locator("canvas.gpe-plant-bounce")).toHaveCount(1);
});
