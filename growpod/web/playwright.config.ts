import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// E2E smoke for the web client. Self-contained: the game API is mocked at the
// network layer (page.route), so no backend is required and runs are
// deterministic. The full wire contract is verified separately against a live
// backend; this guards the rendered UI + the core navigation/auth flows.

// Chromium resolution, in priority order: PW_CHROMIUM env override → the Claude
// Code cloud sandbox's preinstalled browser (auto-detected; Playwright's own
// download is blocked there, and every agent session used to hand-patch this
// file with the same path) → undefined, i.e. Playwright's normal resolution
// (CI and local dev are unaffected).
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
const chromiumPath =
  process.env.PW_CHROMIUM ?? (existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: chromiumPath } },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
