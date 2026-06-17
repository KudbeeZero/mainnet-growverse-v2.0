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

/*
// ── Production version (restore before launch) ──────────────────────────────
function on(value: string | undefined): boolean { return value === "true"; }

type FeatureEnv = {
  NEXT_PUBLIC_ENABLE_MARKETPLACE?: string;
  NEXT_PUBLIC_ENABLE_CHAIN?: string;
  NEXT_PUBLIC_ENABLE_CUP?: string;
  NEXT_PUBLIC_ENABLE_UNIVERSITY?: string;
  NEXT_PUBLIC_ENABLE_CONTRACTS?: string;
};

export function computeFeatures(env: FeatureEnv) {
  return {
    marketplace: on(env.NEXT_PUBLIC_ENABLE_MARKETPLACE),
    chain:       on(env.NEXT_PUBLIC_ENABLE_CHAIN),
    cup:         on(env.NEXT_PUBLIC_ENABLE_CUP),
    university:  on(env.NEXT_PUBLIC_ENABLE_UNIVERSITY),
    contracts:   on(env.NEXT_PUBLIC_ENABLE_CONTRACTS),
  };
}

export const FEATURES = computeFeatures({
  NEXT_PUBLIC_ENABLE_MARKETPLACE: process.env.NEXT_PUBLIC_ENABLE_MARKETPLACE,
  NEXT_PUBLIC_ENABLE_CHAIN:       process.env.NEXT_PUBLIC_ENABLE_CHAIN,
  NEXT_PUBLIC_ENABLE_CUP:         process.env.NEXT_PUBLIC_ENABLE_CUP,
  NEXT_PUBLIC_ENABLE_UNIVERSITY:  process.env.NEXT_PUBLIC_ENABLE_UNIVERSITY,
  NEXT_PUBLIC_ENABLE_CONTRACTS:   process.env.NEXT_PUBLIC_ENABLE_CONTRACTS,
});
// ────────────────────────────────────────────────────────────────────────────
*/
