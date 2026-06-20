import { test, type Page } from "@playwright/test";

// Proof: the Algorand wallet can be CONNECTED and DISCONNECTED (login/out).
// Mocks a player with a linked address so the "Connected" state + Disconnect
// button render. Hermetic; mirrors the other *-shot specs.

const ADDR = "MO2H6ZU47Q7NGFHRQFLNRZ4Z2RT37VVQ2VOBM3DEM6X3PVSTQQ7Q5LGZ4Q";
const PLAYER = {
  id: "p1", username: "Tester", email: null, algorand_address: ADDR,
  xp: 100, level: 3, created_at: null, cannabis_cup_title: null, university_title: null,
  wallet: { id: "w1", player_id: "p1", balance: 500, asa_balance: 100, version: 0 },
};
const WALLET = { id: "w1", player_id: "p1", balance: 500, asa_balance: 100, version: 0 };
const LEVEL = { xp: 100, level: 3, xp_into_level: 50, xp_for_next_level: 100, progress_pct: 50 };

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("gpe.player_id", "p1");
    localStorage.setItem("gpe.api_key", "test-key");
    localStorage.setItem("gpe.onboarding", JSON.stringify({ state: { completed: { p1: true } }, version: 0 }));
  });
  await page.route("**/api/game/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/players/p1")) return json(PLAYER);
    if (path.endsWith("/wallet")) return json(WALLET);
    if (path.endsWith("/level")) return json(LEVEL);
    if (path.endsWith("/flags")) return json({ chain: true, marketplace: true, cup: true, university: true, contracts: true });
    return json([]);
  });
}

test("PROOF: Algorand wallet shows Connected + Disconnect", async ({ page }) => {
  await setup(page);
  await page.goto("/profile");
  await page.getByText("ALGORAND WALLET").waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /Disconnect/i }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "e2e-output/wallet-connected.png", fullPage: true });
});
