import { test, expect } from "@playwright/test";
import { setup } from "./fixtures/mockGame";

// Regression net for the "unexpected API shape white-screens the whole page"
// class of bug. Several pages guarded only `!data` (presence), so a truthy-but-
// malformed response (an empty array, a list where an object was expected, a
// partial body) slipped through and crashed on the first field access —
// surfacing to the user as a full-page "Application error" and, in CI, as an
// opaque Playwright timeout. This spec loads every route under the shared mock
// fixture and fails if any throws a client-side exception or shows the Next.js
// error boundary. It caught 4 real crashes (2026-07-03): /university,
// /lab/strains/[id], /university/learner, /admin/economy.
//
// React #418 (a benign server/client hydration text mismatch) is ignored — it's
// non-fatal and tracked/fixed separately; this net is only for fatal crashes.

const ROUTES = [
  "/account",
  "/admin/economy",
  "/contracts",
  "/cup",
  "/cup/hall-of-fame",
  "/dashboard",
  "/dashboard/plants/plant1",
  "/dashboard/plants/plant1/bud",
  "/dashboard/plants/plant1/chamber",
  "/dashboard/plants/plant1/command",
  "/demo",
  "/factions",
  "/ftue",
  "/guide",
  "/lab",
  "/lab/breed",
  "/lab/genbank",
  "/lab/microscope",
  "/lab/strains/str1",
  "/leaderboards",
  "/market",
  "/mission",
  "/privacy",
  "/profile",
  "/store",
  "/university",
  "/university/coach",
  "/university/explorer",
  "/university/learner",
  "/university/transcript",
];

for (const route of ROUTES) {
  test(`no client-side crash: ${route}`, async ({ page }) => {
    const fatal: string[] = [];
    page.on("pageerror", (e) => {
      // #418 is a benign hydration text mismatch, not a crash.
      if (!e.message.includes("#418")) fatal.push(e.message);
    });
    await setup(page);
    await page.goto(route);
    await page.waitForTimeout(900);
    await expect(
      page.getByText(/Application error/i),
      `${route} rendered the Next.js error boundary`,
    ).toHaveCount(0);
    expect(fatal, `${route} threw: ${fatal[0] ?? ""}`).toEqual([]);
  });
}
