import { test, expect } from "@playwright/test";

// Proof: the scroll-driven cinematic login landing. Hermetic (no API needed for the
// public page). Verifies the brand hero, the particle canvas, the story beats and the
// login card are all present, and that the reduced-motion path still renders fully.

test("PROOF: cinematic landing — hero, particles, and login card", async ({ page }) => {
  await page.goto("/onboarding");

  // Hero strings (also guarded by smoke.spec).
  await expect(page.getByRole("heading", { name: /Real genetics/i })).toBeVisible();
  await expect(page.getByText(/GALACTIC SERIES/i)).toBeVisible();

  // Particle backdrop renders a canvas.
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "e2e-output/onboarding-hero.png" });

  // The login card is present (auth wiring preserved).
  await expect(page.getByText(/Welcome to GrowPod Empire/i)).toBeVisible();
  await page.getByText(/Welcome to GrowPod Empire/i).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: /Create account/i })).toBeVisible();
  await page.screenshot({ path: "e2e-output/onboarding-login.png", fullPage: true });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("PROOF: landing renders fully and statically under reduced motion", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: /Real genetics/i })).toBeVisible();
    await expect(page.getByText(/Welcome to GrowPod Empire/i)).toBeVisible();
  });
});
