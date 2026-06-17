/**
 * MVP feature flags (client mirror of the backend's FEATURE_* gates).
 *
 * Non-MVP systems are OFF by default so the launch build shows only the core
 * grow loop. Flip one on by setting the matching NEXT_PUBLIC_ENABLE_* env var
 * to "true" at build time (see web/.env.local.example). These must stay in sync
 * with the backend flags in src/growpodempire/config.py.
 */

function on(value: string | undefined): boolean {
  return value === "true";
}

type FeatureEnv = {
  NEXT_PUBLIC_ENABLE_MARKETPLACE?: string;
  NEXT_PUBLIC_ENABLE_CHAIN?: string;
  NEXT_PUBLIC_ENABLE_CUP?: string;
  NEXT_PUBLIC_ENABLE_UNIVERSITY?: string;
  NEXT_PUBLIC_ENABLE_CONTRACTS?: string;
};

/** Pure + testable: derive the feature map from an env-like object. */
export function computeFeatures(env: FeatureEnv) {
  return {
    marketplace: on(env.NEXT_PUBLIC_ENABLE_MARKETPLACE),
    chain: on(env.NEXT_PUBLIC_ENABLE_CHAIN),
    cup: on(env.NEXT_PUBLIC_ENABLE_CUP),
    university: on(env.NEXT_PUBLIC_ENABLE_UNIVERSITY),
    contracts: on(env.NEXT_PUBLIC_ENABLE_CONTRACTS),
  };
}

// Production map. Each access is a *literal* `process.env.NEXT_PUBLIC_*` so
// Next.js statically inlines it into the client bundle at build time (a dynamic
// `process.env[key]` would NOT be replaced and would read as undefined).
export const FEATURES = computeFeatures({
  NEXT_PUBLIC_ENABLE_MARKETPLACE: process.env.NEXT_PUBLIC_ENABLE_MARKETPLACE,
  NEXT_PUBLIC_ENABLE_CHAIN: process.env.NEXT_PUBLIC_ENABLE_CHAIN,
  NEXT_PUBLIC_ENABLE_CUP: process.env.NEXT_PUBLIC_ENABLE_CUP,
  NEXT_PUBLIC_ENABLE_UNIVERSITY: process.env.NEXT_PUBLIC_ENABLE_UNIVERSITY,
  NEXT_PUBLIC_ENABLE_CONTRACTS: process.env.NEXT_PUBLIC_ENABLE_CONTRACTS,
});

export type FeatureName = keyof typeof FEATURES;

/** True if a named feature is enabled in this build. */
export function isFeatureEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}
