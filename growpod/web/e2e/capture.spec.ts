import { test, expect } from "@playwright/test";
import { setup, POD } from "./fixtures/mockGame";

// Parameterized screenshot capture — the permanent replacement for the
// throwaway one-off specs every visual-verification session used to write.
// See docs/memory/VERIFIED_RENDERS.md (the chapter list) and the
// .claude/skills/capture-shots skill for the full recipe book.
//
// Drive it entirely from env vars — no file edits needed:
//
//   CAPTURE_ROUTE=/dashboard/plants/plant1/chamber npx playwright test capture
//   CAPTURE_ROUTE=/lab/microscope CAPTURE_NAME=microscope npx playwright test capture
//   CAPTURE_ROUTE=/dashboard CAPTURE_STATE='growth_stage=harvest' npx playwright test capture
//
// Vars:
//   CAPTURE_ROUTE      route to shoot (default /dashboard/plants/plant1/chamber)
//   CAPTURE_STATE      comma-separated k=v overrides applied to the mock plant/
//                      state (values JSON-parsed when possible, e.g.
//                      growth_stage=late_flower,harvested=true,health=96)
//   CAPTURE_VIEWPORTS  WxH list (default "1440x900,390x844" — the project's
//                      blessed desktop+mobile pair)
//   CAPTURE_NAME       filename prefix (default "capture")
//   CAPTURE_OUT        output dir (default e2e-output/capture — gitignored;
//                      promote keepers to docs/memory/verification/ + add a
//                      VERIFIED_RENDERS.md entry in the same PR)
//   CAPTURE_WAIT       settle time in ms before shooting (default 1800 — lets
//                      the canvas plant finish its first paint)
//   CAPTURE_CANVAS     "1" → also shoot the first <canvas> element alone
//   CAPTURE_UNAUTH     "1" → skip the mock-API/auth seed entirely (for the
//                      logged-out onboarding/landing routes, which redirect
//                      an authed session straight to /dashboard)
//   CAPTURE_POD_STATE  comma-separated k=v overrides applied to the mock POD
//                      (equipped gear, environment) — e.g.
//                      equipped_gear='[{"gear_key":"inline_exhaust_6in","category":"fan","name":"6\" Inline Exhaust"}]',light_intensity=950
//
// Skipped entirely unless CAPTURE_ROUTE is set, so it never runs (and never
// costs time) in CI or a plain `npx playwright test` sweep.

const ROUTE = process.env.CAPTURE_ROUTE;
const NAME = process.env.CAPTURE_NAME || "capture";
const OUT = process.env.CAPTURE_OUT || "e2e-output/capture";
const WAIT = Number(process.env.CAPTURE_WAIT || 1800);
const UNAUTH = process.env.CAPTURE_UNAUTH === "1";
const VIEWPORTS = (process.env.CAPTURE_VIEWPORTS || "1440x900,390x844")
  .split(",")
  .map((s) => s.trim().toLowerCase().split("x").map(Number) as [number, number]);

function parseState(raw: string | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw) return out;
  for (const pair of raw.split(",")) {
    const i = pair.indexOf("=");
    if (i < 0) continue;
    const k = pair.slice(0, i).trim();
    const v = pair.slice(i + 1).trim();
    try {
      out[k] = JSON.parse(v);
    } catch {
      out[k] = v; // bare strings like late_flower
    }
  }
  return out;
}

test.describe("capture", () => {
  test.skip(!ROUTE, "set CAPTURE_ROUTE to use the capture harness");

  for (const [w, h] of VIEWPORTS) {
    test(`shoot ${ROUTE} @ ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      if (!UNAUTH) {
        const podOver = parseState(process.env.CAPTURE_POD_STATE);
        const extra = Object.keys(podOver).length ? { "/pods": [{ ...POD, ...podOver }] } : {};
        await setup(page, parseState(process.env.CAPTURE_STATE), extra);
      }
      await page.goto(ROUTE!);
      await page.waitForTimeout(WAIT);
      await page.screenshot({ path: `${OUT}/${NAME}-${w}x${h}.png`, fullPage: true });
      if (process.env.CAPTURE_CANVAS === "1") {
        const canvas = page.locator("canvas").first();
        await expect(canvas).toBeVisible();
        await canvas.screenshot({ path: `${OUT}/${NAME}-${w}x${h}-canvas.png` });
      }
    });
  }
});
