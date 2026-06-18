/**
 * MVP feature flags (client mirror of the backend's FEATURE_* gates).
 *
 * ⚠️  TESTING MODE — all flags forced ON so every screen is reachable.
 * Before launch: restore the computeFeatures / env-var version below so
 * unfinished systems can be toggled off per-environment.
 *
 * Original env-var version is preserved in comments at the bottom.
 */

export type FeatureName =
  | "marketplace"
  | "chain"
  | "cup"
  | "university"
  | "contracts";

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

// ── Production feature resolution (kept live + tested) ──────────────────────
// `FEATURES` above is hardcoded ON for the current testing phase. To restore
// per-environment gating before launch, swap the `FEATURES` definition above to
// `computeFeatures({ ... process.env.NEXT_PUBLIC_ENABLE_* ... })`. The resolver
// stays exported and unit-tested so the launch swap is a one-liner.
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

export function computeFeatures(env: FeatureEnv): Record<FeatureName, boolean> {
  return {
    marketplace: on(env.NEXT_PUBLIC_ENABLE_MARKETPLACE),
    chain:       on(env.NEXT_PUBLIC_ENABLE_CHAIN),
    cup:         on(env.NEXT_PUBLIC_ENABLE_CUP),
    university:  on(env.NEXT_PUBLIC_ENABLE_UNIVERSITY),
    contracts:   on(env.NEXT_PUBLIC_ENABLE_CONTRACTS),
  };
}
