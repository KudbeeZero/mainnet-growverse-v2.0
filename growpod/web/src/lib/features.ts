/**
 * MVP feature flags (client mirror of the backend's FEATURE_* gates).
 *
 * ⚠️  TESTING MODE — `FEATURES` is forced ON so every screen is reachable.
 * Before launch: switch `FEATURES` to the env-driven `computeFeatures(...)` call
 * shown at the bottom so unfinished systems can be toggled off per-environment.
 *
 * `computeFeatures` (the pure env→flags mapper) stays a live export regardless of
 * testing mode — it's the launch-time source of truth and is unit-tested.
 */

export type FeatureName =
  | "marketplace"
  | "chain"
  | "cup"
  | "university"
  | "contracts";

/** A flag is enabled only by the exact string "true" (not "TRUE"/"1"/"yes"). */
function on(value: string | undefined): boolean {
  return value === "true";
}

/**
 * Opt-out resolver: a flag is ON unless explicitly disabled with the exact
 * string "false". Used by the live `FEATURES` map so production keeps serving
 * the surfaces that are live today, while still allowing any surface to be
 * killed per-environment by setting its NEXT_PUBLIC_ENABLE_* var to "false"
 * (no code change / redeploy of code needed).
 */
export function enabledUnlessDisabled(value: string | undefined): boolean {
  return value !== "false";
}

export type FeatureEnv = {
  NEXT_PUBLIC_ENABLE_MARKETPLACE?: string;
  NEXT_PUBLIC_ENABLE_CHAIN?: string;
  NEXT_PUBLIC_ENABLE_CUP?: string;
  NEXT_PUBLIC_ENABLE_UNIVERSITY?: string;
  NEXT_PUBLIC_ENABLE_CONTRACTS?: string;
};

/** Pure mapper from NEXT_PUBLIC_ENABLE_* env strings to the flag record. */
export function computeFeatures(env: FeatureEnv): Record<FeatureName, boolean> {
  return {
    marketplace: on(env.NEXT_PUBLIC_ENABLE_MARKETPLACE),
    chain:       on(env.NEXT_PUBLIC_ENABLE_CHAIN),
    cup:         on(env.NEXT_PUBLIC_ENABLE_CUP),
    university:  on(env.NEXT_PUBLIC_ENABLE_UNIVERSITY),
    contracts:   on(env.NEXT_PUBLIC_ENABLE_CONTRACTS),
  };
}

/**
 * Resolved feature flags for THIS build.
 *
 * Security: these were previously hardcoded `true` with no way to disable a
 * surface per environment. They are now env-driven via NEXT_PUBLIC_ENABLE_*, so
 * any feature can be turned OFF in a given deployment by setting its var to
 * "false" — a real per-env kill switch.
 *
 * Default-ON / opt-out (`enabledUnlessDisabled`) is deliberate: it preserves the
 * features that are live in production today (so this hardening change can't
 * silently dark-launch the site) while still making every surface gateable. To
 * move to strict opt-in (default-OFF unless explicitly "true"), swap the resolver
 * for `computeFeatures({ ... })` once the deploy env sets the vars explicitly.
 */
export const FEATURES: Record<FeatureName, boolean> = {
  marketplace: enabledUnlessDisabled(process.env.NEXT_PUBLIC_ENABLE_MARKETPLACE),
  chain:       enabledUnlessDisabled(process.env.NEXT_PUBLIC_ENABLE_CHAIN),
  cup:         enabledUnlessDisabled(process.env.NEXT_PUBLIC_ENABLE_CUP),
  university:  enabledUnlessDisabled(process.env.NEXT_PUBLIC_ENABLE_UNIVERSITY),
  contracts:   enabledUnlessDisabled(process.env.NEXT_PUBLIC_ENABLE_CONTRACTS),
};

/** True if a named feature is enabled in this build. */
export function isFeatureEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}

/**
 * 3D bud renderer (WebGL/three.js) — experimental, OFF by default.
 *
 * Opt-IN: only the exact string "true" enables it build-wide. The chamber page
 * additionally honours a `?bud3d=1` query param so it can be previewed (and
 * screenshotted in e2e) without a dedicated build. Falls back to the Canvas
 * `GrowChamber` when off / unsupported / reduced-motion.
 */
export function isBud3DEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_BUD3D === "true";
}

/**
 * Dev/test-only "skip login" bypass.
 *
 * When on, the onboarding screen shows an "Enter as tester" button that
 * auto-provisions a throwaway player and drops straight into the game — no
 * password, no wallet, no onboarding. Enabled when EITHER:
 *   - `NEXT_PUBLIC_ENABLE_DEV_BYPASS=true` is set at build time, OR
 *   - the build is a non-production deployment (Vercel preview, local dev) — so
 *     the owner can test a PR preview without signing up / logging in every time.
 *
 * Hard rule: NEVER on production. `NEXT_PUBLIC_BUILD_ENV` is `VERCEL_ENV`
 * ("production" | "preview" | "development") on Vercel, falling back to
 * `NODE_ENV`/"local" elsewhere (see next.config.mjs); production is excluded.
 */
export function isDevBypassEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS === "true") return true;
  const env = process.env.NEXT_PUBLIC_BUILD_ENV;
  return env === "preview" || env === "development" || env === "local";
}

/**
 * Mission Control v0 gate (owner/admin-only, internal operations board).
 *
 * ⚠️ HONEST LIMITATION: this is NOT a real role/permission system. v0 visibility
 * is a build-flag + login gate only:
 *   - the page is NOT linked in the nav (players won't discover it), and
 *   - it requires a logged-in session (RequireAuth), and
 *   - it is "active" only when `NEXT_PUBLIC_ENABLE_MISSION_CONTROL=true` OR the
 *     dev/test bypass is on (so owner/tester can reach it in test builds).
 * A true owner/admin role is future work — do not treat this as security.
 */
export function isMissionControlEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_MISSION_CONTROL === "true" ||
    isDevBypassEnabled()
  );
}
