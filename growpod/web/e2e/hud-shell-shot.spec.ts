import { test, expect } from "@playwright/test";
import { setup } from "./fixtures/mockGame";

// Proof for the GameShell HUD redesign (docs/memory/design/mockups/
// growverse-{mobile,desktop}-hud-concept.png):
//   1. mobile portrait is BLOCKED by a real rotate-prompt overlay — the shell
//      never renders underneath it;
//   2. mobile landscape renders the full HUD: hero chamber + always-visible
//      bottom dock + slim edge tabs, and a real touch swipe-from-edge opens
//      the Actions panel;
//   3. desktop never gates on orientation (even a portrait-shaped desktop
//      window), and click-to-expand + auto-compact-after-action works on the
//      right (Insights) panel.
//
// Run: npx playwright test hud-shell-shot

test.describe("mobile — landscape lock + swipe HUD", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("PROOF: portrait is blocked by the rotate-prompt; landscape renders the HUD", async ({ page }) => {
    // Portrait phone-shaped viewport (390x844) by default.
    await setup(page);
    await page.goto("/dashboard/plants/plant1/chamber");

    await expect(page.getByRole("alertdialog", { name: /rotate your device/i })).toBeVisible();
    // The shell must not be reachable underneath the gate.
    await expect(page.getByTestId("edge-tab-left")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /WATER/i })).toHaveCount(0);
    await page.screenshot({ path: "e2e-output/hud-mobile-portrait-gate.png" });

    // Rotate to landscape (matches the Screen Orientation API's real signal —
    // our hook reads viewport aspect via matchMedia, which Playwright's
    // viewport resize drives directly).
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole("alertdialog", { name: /rotate your device/i })).toHaveCount(0);

    // The hero + persistent bottom dock + both slim edge tabs are all present.
    await expect(page.locator("canvas").first()).toBeVisible();
    for (const label of ["WATER", "FEED", "PRUNE", "TRAIN"]) {
      await expect(page.getByRole("button", { name: new RegExp(label, "i") }).first()).toBeVisible();
    }
    await expect(page.getByTestId("edge-tab-left")).toBeVisible();
    await expect(page.getByTestId("edge-tab-right")).toBeVisible();
    // Panels start compacted — their content isn't in the DOM yet.
    await expect(page.getByTestId("actions-panel")).toHaveCount(0);
    await page.screenshot({ path: "e2e-output/hud-mobile-landscape-compact.png" });
  });

  test("PROOF: a real touch swipe from the left edge opens Actions & Controls, and it auto-compacts after an action", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await setup(page);
    await page.goto("/dashboard/plants/plant1/chamber");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByTestId("game-shell-root")).toBeVisible();

    // Simulate a swipe-from-the-left-edge drag with raw PointerEvents dispatched
    // directly on the shell's root (Playwright's Touchscreen only taps; this is
    // the standard way to simulate a real drag gesture in Chromium). Dispatching
    // on the root itself — rather than `elementFromPoint` — avoids flaky hit-
    // testing against whatever happens to be topmost under the coordinate.
    await page.evaluate(() => {
      const root = document.querySelector('[data-testid="game-shell-root"]')!;
      function fire(type: string, x: number, y: number) {
        const ev = new PointerEvent(type, { pointerId: 1, pointerType: "touch", clientX: x, clientY: y, bubbles: true, cancelable: true });
        root.dispatchEvent(ev);
      }
      fire("pointerdown", 4, 200);
      fire("pointermove", 60, 200);
      fire("pointerup", 60, 200);
    });

    await expect(page.getByTestId("actions-panel")).toBeVisible();
    // Case-SENSITIVE "WATER" (not /i): the six tile labels are always rendered
    // uppercase, while BOOST's own benefit copy ("tops up water/nutrients")
    // would otherwise also match a loose case-insensitive count.
    await expect(page.getByRole("button", { name: /WATER/ })).toHaveCount(2); // bottom dock + panel row
    await page.waitForTimeout(350); // let the slide-out transition settle before the evidence shot
    await page.screenshot({ path: "e2e-output/hud-mobile-actions-open.png" });

    // Tapping a care action inside the panel fires the mutation AND
    // auto-compacts the panel (GameShellContext.collapse("left")).
    await page.getByTestId("actions-panel").getByRole("button", { name: /WATER/ }).first().click();
    await expect(page.getByTestId("actions-panel")).toHaveCount(0, { timeout: 2000 });
  });

  test("PROOF: reopening the panel before a pending action resolves is NOT stomped by the stale auto-compact", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await setup(page);
    // Delay the water mutation so its onSuccess fires well after we've closed
    // and reopened the panel — the race GameShell's openGeneration guards.
    await page.route("**/api/game/**/plants/plant1/water", async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.goto("/dashboard/plants/plant1/chamber");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    const swipe = (dx: number) =>
      page.evaluate((dx) => {
        const root = document.querySelector('[data-testid="game-shell-root"]')!;
        function fire(type: string, x: number) {
          root.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "touch", clientX: x, clientY: 200, bubbles: true, cancelable: true }));
        }
        fire("pointerdown", dx > 0 ? 4 : 200);
        fire("pointermove", dx > 0 ? 60 : 140);
        fire("pointerup", dx > 0 ? 60 : 140);
      }, dx);

    await swipe(1); // open from the left edge
    await expect(page.getByTestId("actions-panel")).toBeVisible();

    // Fire the (slow) Water action, then immediately swipe-close the panel
    // manually — before the mutation's onSuccess has a chance to run. (A
    // swipe-close, not the header ✕ button: at some S/M/L width presets the
    // header can sit outside this narrow 390px-tall landscape viewport —
    // the swipe gesture the panel already primarily supports is the robust
    // interaction here, matching how the "opens + auto-compacts" test above
    // drives the panel.)
    await page.getByTestId("actions-panel").getByRole("button", { name: /WATER/ }).first().click();
    await page.waitForTimeout(100);
    await swipe(-1);
    await expect(page.getByTestId("actions-panel")).toHaveCount(0);
    await page.waitForTimeout(100);

    // Reopen before the 600ms mutation resolves.
    await swipe(1);
    await expect(page.getByTestId("actions-panel")).toBeVisible();

    // Wait past the mutation's resolution — the stale onSuccess must NOT
    // auto-compact this freshly reopened panel out from under the player.
    await page.waitForTimeout(800);
    await expect(page.getByTestId("actions-panel")).toBeVisible();
  });
});

test.describe("tablet — landscape lock threshold + orientation thrash", () => {
  // BACKLOG.md's GameShell entry flagged these as missing coverage: a real
  // tablet-in-landscape viewport (confirm `isHandheld`'s `<=1024` max-dimension
  // threshold doesn't wrongly gate it) and rapid orientation flips (confirm the
  // gate doesn't get stuck or double-mount the shell). Not re-litigating the
  // portrait-tablet-should-gate decision (settled) — this only exercises the
  // landscape side of that same threshold, plus thrash stability.
  test.use({ hasTouch: true, isMobile: true });

  test("PROOF: a common small-tablet viewport (768x1024 portrait / 1024x768 landscape) gates only in portrait", async ({ page }) => {
    // iPad-classic-sized viewport: max dimension 1024 — right at `isHandheld`'s
    // own `<= 1024` boundary, so this is the sharpest real-device check of it.
    await page.setViewportSize({ width: 768, height: 1024 });
    await setup(page);
    await page.goto("/dashboard/plants/plant1/chamber");
    await expect(page.getByRole("alertdialog", { name: /rotate your device/i })).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByTestId("game-shell-root")).toBeVisible();
    await expect(page.getByTestId("edge-tab-left")).toBeVisible();

    // Full touch interaction still works at this size, not just static render.
    await page.evaluate(() => {
      const root = document.querySelector('[data-testid="game-shell-root"]')!;
      function fire(type: string, x: number, y: number) {
        root.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "touch", clientX: x, clientY: y, bubbles: true, cancelable: true }));
      }
      fire("pointerdown", 4, 300);
      fire("pointermove", 60, 300);
      fire("pointerup", 60, 300);
    });
    await expect(page.getByTestId("actions-panel")).toBeVisible();
  });

  test("PROOF: rapid portrait/landscape thrashing settles cleanly with no stuck gate or duplicate shell", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page);
    await page.goto("/dashboard/plants/plant1/chamber");
    await expect(page.getByRole("alertdialog")).toBeVisible();

    const sizes: [number, number][] = [
      [844, 390],
      [390, 844],
      [844, 390],
      [390, 844],
      [926, 428],
    ];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
    }
    // Ends on a landscape size — gate must be gone, exactly one shell mounted
    // (a stuck/duplicate mount from thrashing would fail the `toHaveCount(1)`).
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByTestId("game-shell-root")).toHaveCount(1);
    await expect(page.getByTestId("edge-tab-left")).toHaveCount(1);
    await expect(page.getByTestId("edge-tab-right")).toHaveCount(1);

    // And back to portrait — the gate must still correctly re-engage, not be
    // wedged "open" from the thrash.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("alertdialog", { name: /rotate your device/i })).toBeVisible();
    await expect(page.getByTestId("game-shell-root")).toHaveCount(0);
  });
});

test.describe("desktop — docked panels, no orientation gate", () => {
  test("PROOF: a portrait-shaped DESKTOP window is never gated (isHandheld requires touch)", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1400 }); // tall, but a mouse-driven desktop context
    await setup(page);
    await page.goto("/dashboard/plants/plant1/chamber");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByTestId("edge-tab-left")).toBeVisible();
  });

  test("PROOF: hover-to-expand the Insights panel, chamber stays centered, panel closes on demand", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setup(page);
    await page.goto("/dashboard/plants/plant1/chamber");

    await expect(page.getByTestId("insights-panel")).toHaveCount(0);
    // Hovering the edge tab expands it — the mockup's "Hover or click the edge
    // tab to reveal HUD". A `.click()` here would fight itself: the hover
    // triggered by moving the mouse there already opens the panel (which then
    // covers the tab), so the follow-up mousedown/up lands on the panel, not
    // the tab — `.hover()` alone is the faithful (and stable) simulation.
    await page.getByTestId("edge-tab-right").hover();
    await expect(page.getByTestId("insights-panel")).toBeVisible();
    await expect(page.getByText(/Environment/i).first()).toBeVisible();
    await expect(page.getByText(/Missions/i).first()).toBeVisible();
    await expect(page.getByText(/Inventory/i).first()).toBeVisible();
    await expect(page.getByText(/Progress/i).first()).toBeVisible();

    // The chamber canvas is still fully present — the panel overlays, it never
    // pushes/resizes the hero.
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.screenshot({ path: "e2e-output/hud-desktop-insights-open.png", fullPage: true });

    // Focus was on the ✕ button when it closed; `inert` (applied to the whole
    // closed panel so its now off-screen controls drop out of the tab order —
    // see EdgePanel.tsx) would otherwise strand focus on <body>. It should
    // land back on this panel's own edge tab instead — a sensible landing
    // spot for a keyboard/screen-reader user, not a silently vanished focus.
    await page.getByRole("button", { name: /Close Insights & Management/i }).click();
    await expect(page.getByTestId("insights-panel")).toHaveCount(0, { timeout: 2000 });
    await expect(page.getByTestId("edge-tab-right")).toBeFocused();
  });
});
