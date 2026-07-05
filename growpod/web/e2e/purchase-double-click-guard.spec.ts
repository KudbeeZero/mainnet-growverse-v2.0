import { test, expect } from "@playwright/test";
import { setup } from "./fixtures/mockGame";

// PROOF for the store/market double-charge finding (2026-07-05 playtest QA):
// a raw-HTTP concurrency repro against gear + seasonal-strain purchase showed
// both requests succeed and both charge. Root-caused to a client-side gap,
// not a server race (the server's optimistic wallet lock already resolves a
// genuine concurrent-request race — see tests/test_concurrency.py): the
// `busy`/`buying` React state these buttons use to self-disable only reaches
// the DOM after a re-render, so two click events dispatched in the same JS
// task (a fast double-click, or a duplicate synthetic click some browsers/
// devices fire) can both run the handler's synchronous prefix before either
// commit, firing the purchase request twice.
//
// `el.click(); el.click();` inside one `page.evaluate` reproduces exactly
// that: two native click events dispatched back-to-back with no render in
// between, deterministically (no network-timing luck required). Before the
// fix (web/src/hooks/useInFlightGuard.ts) this fired two POSTs; after it,
// the second call is swallowed synchronously and only one POST goes out.
//
// Run: npx playwright test purchase-double-click-guard

test("PROOF: a fast double-click on gear Buy fires exactly one purchase POST", async ({ page }) => {
  let purchaseCalls = 0;
  const GEAR = {
    key: "led_light", name: "SeedSpark LED", category: "light", cost: 150,
    description: "Test light", image: null,
    specs: { watts: 125, ppfd: 300, coverage: "2x2 ft" }, owned: 0, equipped_pod_id: null,
  };

  await setup(page, {}, { "/store/gear": [GEAR] });
  // Registered after setup(): Playwright matches the most-recently-registered
  // route first, so this narrower pattern intercepts the purchase POST ahead
  // of the broad **/api/game/** stub — letting us count calls precisely.
  await page.route("**/store/gear/led_light/purchase", async (route) => {
    purchaseCalls += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([{ ...GEAR, owned: purchaseCalls }]),
    });
  });

  await page.goto("/store");
  const buyButton = page.getByRole("button", { name: "Buy" }).first();
  await expect(buyButton).toBeVisible();

  // Two click events, same JS task — no React re-render can land in between.
  await buyButton.evaluate((el: HTMLElement) => {
    el.click();
    el.click();
  });

  // Give the (single, guarded) in-flight request time to resolve.
  await expect.poll(() => purchaseCalls).toBeGreaterThan(0);
  await page.waitForTimeout(200); // let a would-be second request also land, if any
  expect(purchaseCalls).toBe(1);
});

test("PROOF: a fast double-click on a seasonal Buy Seed fires exactly one purchase POST", async ({ page }) => {
  let purchaseCalls = 0;
  const SEASONAL_STRAIN = {
    id: "seasonal1", strain_id: "str1", strain_name: "Nova Haze", strain_rarity: "epic",
    strain_thc_max: 30, strain_terpenes: ["limonene"], available_month: "2026-07",
    price_gc: 60, auto_renew: false, is_current: true,
  };

  await setup(page, {}, { "/seasonal/strains": [SEASONAL_STRAIN] });
  await page.route("**/seasonal/strains/seasonal1/purchase", async (route) => {
    purchaseCalls += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        seasonal_id: "seasonal1", strain_id: "str1", strain_name: "Nova Haze",
        available_month: "2026-07", price_gc: 60,
      }),
    });
  });

  await page.goto("/lab");
  const buyButton = page.getByRole("button", { name: "Buy Seed" }).first();
  await expect(buyButton).toBeVisible();

  await buyButton.evaluate((el: HTMLElement) => {
    el.click();
    el.click();
  });

  await expect.poll(() => purchaseCalls).toBeGreaterThan(0);
  await page.waitForTimeout(200);
  expect(purchaseCalls).toBe(1);
});
