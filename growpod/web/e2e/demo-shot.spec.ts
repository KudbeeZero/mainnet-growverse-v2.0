import { test } from "@playwright/test";

// Proof: the offline Demo Mode now opens on a STRAIN PICKER (select any seed to
// simulate) instead of one fixed "Demo Kush" plant. Public route, no login.
test("PROOF: demo mode opens on a strain picker", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("gpe.demo"));
  await page.goto("/demo");
  await page.getByText(/Pick a strain to grow/i).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /Grow Gelato/i }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "e2e-output/demo-picker.png", fullPage: true });
});
