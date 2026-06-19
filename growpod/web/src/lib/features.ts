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

// ⚠️ TESTING MODE: all flags forced ON. Before launch, replace this literal with
// the env-driven version below so non-MVP surfaces can be turned off per-env:
//
//   export const FEATURES = computeFeatures({
//     NEXT_PUBLIC_ENABLE_MARKETPLACE: process.env.NEXT_PUBLIC_ENABLE_MARKETPLACE,
//     NEXT_PUBLIC_ENABLE_CHAIN:       process.env.NEXT_PUBLIC_ENABLE_CHAIN,
//     NEXT_PUBLIC_ENABLE_CUP:         process.env.NEXT_PUBLIC_ENABLE_CUP,
//     NEXT_PUBLIC_ENABLE_UNIVERSITY:  process.env.NEXT_PUBLIC_ENABLE_UNIVERSITY,
//     NEXT_PUBLIC_ENABLE_CONTRACTS:   process.env.NEXT_PUBLIC_ENABLE_CONTRACTS,
//   });
export const FEATURES: Record<FeatureName, boolean> = {
  marketplace: true,
  chain:       true,
  cup:         true,
  university:  true,
  contracts:   true,
};

/** True if a named feature is enabled in this build. */
export function isFeatureEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}

/**
 * Dev/test-only "skip login" bypass.
 *
 * OFF unless `NEXT_PUBLIC_ENABLE_DEV_BYPASS=true` is set at build time (the
 * test-env launch script sets it). When on, the onboarding screen shows an
 * "Enter as tester" button that auto-provisions a throwaway player and drops
 * straight into the game — no password, no wallet. NEVER enable in production.
 */
export function isDevBypassEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS === "true";
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
