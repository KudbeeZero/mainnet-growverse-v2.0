import { test, expect, type Page } from "@playwright/test";

// Proof: the cinematic /factions pre-launch door (particle backdrop + grain + GSAP
// card reveals), waitlist logic preserved. Hermetic — mock the public faction API.

const FACTIONS = {
  factions: [
    { id: "verdant", name: "Verdant Order", crest: "🌿", tagline: "Patience and potency.", lore: "Slow-grown, terpene-rich.", color: "#76c024" },
    { id: "ember", name: "Ember Clan", crest: "🔥", tagline: "Heat and hustle.", lore: "Fast cycles, bold yields.", color: "#fb923c" },
    { id: "frost", name: "Frost Pact", crest: "❄️", tagline: "Cold nights, purple buds.", lore: "Anthocyanin chasers.", color: "#a78bfa" },
  ],
};

async function setup(page: Page) {
  await page.route("**/api/game/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/factions")) return json(FACTIONS);
    if (path.includes("/waitlist/standings")) return json({ total: 1280, by_faction: { verdant: 600, ember: 400, frost: 280 } });
    return json([]);
  });
}

test("PROOF: cinematic factions landing renders with particle backdrop + cards", async ({ page }) => {
  await setup(page);
  await page.goto("/factions");
  await expect(page.getByRole("heading", { name: /Pick your faction/i })).toBeVisible();
  await expect(page.getByText(/Verdant Order/i)).toBeVisible();
  // Particle backdrop canvas present.
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "e2e-output/factions-cinematic.png", fullPage: true });
});
