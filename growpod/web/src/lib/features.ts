/**
 * Web feature flags — the client mirror of the backend balance.yaml
 * `feature_flags:` gates. Exposure-gating only: the server stays authoritative
 * for behavior; these just decide whether a surface is shown.
 *
 * Polarity mirrors the backend (default ON, flip OFF per-environment for launch):
 * a surface is enabled UNLESS its env var is the exact string "false". So the
 * testing / free-playtest build (no env vars set) shows every screen — preserving
 * current behavior — while a launch build hides unfinished surfaces with
 * `NEXT_PUBLIC_ENABLE_<NAME>=false`, no code change required.
 *
 * `computeFeatures` (the pure env→flags mapper) is the launch-time source of truth
 * and stays a live, unit-tested export; `FEATURES` is wired to it from process.env.
 */

export type FeatureName =
  | "marketplace"
  | "chain"
  | "cup"
  | "university"
  | "contracts";

export type FeatureEnv = {
  NEXT_PUBLIC_ENABLE_MARKETPLACE?: string;
  NEXT_PUBLIC_ENABLE_CHAIN?: string;
  NEXT_PUBLIC_ENABLE_CUP?: string;
  NEXT_PUBLIC_ENABLE_UNIVERSITY?: string;
  NEXT_PUBLIC_ENABLE_CONTRACTS?: string;
};

/** A surface is ON unless explicitly disabled with the exact string "false". */
function enabled(value: string | undefined): boolean {
  return value !== "false";
}

/** Pure mapper from NEXT_PUBLIC_ENABLE_* env strings to the flag record. */
export function computeFeatures(env: FeatureEnv): Record<FeatureName, boolean> {
  return {
    marketplace: enabled(env.NEXT_PUBLIC_ENABLE_MARKETPLACE),
    chain: enabled(env.NEXT_PUBLIC_ENABLE_CHAIN),
    cup: enabled(env.NEXT_PUBLIC_ENABLE_CUP),
    university: enabled(env.NEXT_PUBLIC_ENABLE_UNIVERSITY),
    contracts: enabled(env.NEXT_PUBLIC_ENABLE_CONTRACTS),
  };
}

export const FEATURES: Record<FeatureName, boolean> = computeFeatures({
  NEXT_PUBLIC_ENABLE_MARKETPLACE: process.env.NEXT_PUBLIC_ENABLE_MARKETPLACE,
  NEXT_PUBLIC_ENABLE_CHAIN: process.env.NEXT_PUBLIC_ENABLE_CHAIN,
  NEXT_PUBLIC_ENABLE_CUP: process.env.NEXT_PUBLIC_ENABLE_CUP,
  NEXT_PUBLIC_ENABLE_UNIVERSITY: process.env.NEXT_PUBLIC_ENABLE_UNIVERSITY,
  NEXT_PUBLIC_ENABLE_CONTRACTS: process.env.NEXT_PUBLIC_ENABLE_CONTRACTS,
});

/** True if a named feature is enabled in this build. */
export function isFeatureEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}
