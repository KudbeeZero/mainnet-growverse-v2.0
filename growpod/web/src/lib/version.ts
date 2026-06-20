// Human-visible build marker so the owner can confirm at a glance which update
// is live after a hard refresh. Bump APP_VERSION with each shipped UI update.
//   2.0   — mainnet baseline
//   2.0.1 — guided onboarding + token-claim banner
//   2.0.2 — honest QA 10× + QA milestone toasts
//   2.0.3 — in-game Grow Guide + Kudbee branding
//   2.0.4 — integrated build: deeper 14-step onboarding + Guide + QA feedback
//   2.0.5 — 10× faster grow pacing · jitter-free countdown timers · real
//           per-strain plant render on detail page · deploy build-stamp + PR guardrails
//   2.0.7 — global 10× speed faucet: server-owned per-account turbo (every pod at
//           once, banked/forward-only, production-safe), toggled in ONE place —
//           the Grow Chamber. Verified working; economy-safe (stipend unaffected).
//   2.0.8 — turbo single-toggle confirmed (removed the duplicate nav button) +
//           smooth wall-anchored countdown + Central-time build stamp in footer.
export const APP_VERSION = "2.0.8";

// Automatic build stamp — injected at build time from Vercel's git env (see
// next.config.mjs `env`). Unlike APP_VERSION, these change on EVERY deploy even
// when the version string wasn't bumped, so "is my update actually live?" is
// answerable at a glance (the footer SHA / `/version` changes when a new build
// ships). Empty/"dev" locally.
const RAW_SHA = process.env.NEXT_PUBLIC_BUILD_SHA || "";

/** Short commit SHA of the deployed build, or "dev" when built locally. */
export const BUILD_SHA = RAW_SHA ? RAW_SHA.slice(0, 7) : "dev";

/** ISO timestamp of when this bundle was built. */
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || "";

/** Build time formatted in US Central (Chicago) time — e.g. "Jun 20, 2026,
 *  6:15 AM CT" — so the owner can read at a glance WHEN the live build shipped,
 *  in their own timezone. Empty when built locally (no injected build time). */
export const BUILD_TIME_CT = BUILD_TIME
  ? `${new Date(BUILD_TIME).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "medium",
      timeStyle: "short",
    })} CT`
  : "";

/** Deploy environment: "production" | "preview" | "development" | "local". */
export const BUILD_ENV = process.env.NEXT_PUBLIC_BUILD_ENV || "local";

/** True when this is a real deployed build (has a commit SHA), not local dev. */
export const IS_DEPLOYED_BUILD = RAW_SHA.length > 0;

/** Single object surfaced by the `/version` endpoint and footer. */
export const BUILD_INFO = {
  version: APP_VERSION,
  sha: BUILD_SHA,
  builtAt: BUILD_TIME,
  env: BUILD_ENV,
} as const;
