"use client";

/**
 * MVP feature flags (client mirror of the backend's FEATURE_* gates).
 *
 * The real kill-switch state lives server-side in `balance.yaml`'s
 * `feature_flags:` block (env-overridable via `FEATURE_<NAME>`), served
 * publicly at `GET /api/game/flags`. `useFeatureFlags()` (see below, backed by
 * `useBackendFlags()` in `hooks/queries.ts`) reads that endpoint — turning a
 * flag off on the backend actually hides the gated surface in the web client,
 * not just the API. `FEATURES` (the env-driven, build-time map) is now only a
 * same-request fallback for the instant before that fetch resolves (and for
 * non-React call sites), not the source of truth.
 *
 * `computeFeatures` (the pure env→flags mapper) stays a live export — it backs
 * both `FEATURES` and the fallback path, and is unit-tested.
 */

import { useBackendFlags } from "@/hooks/queries";

export type FeatureName =
  | "marketplace"
  | "chain"
  | "cup"
  | "university"
  | "contracts";

/** Maps a client `FeatureName` to its backend `balance.yaml` flag key — names
 *  don't all match 1:1 (e.g. the client's "cup" is the backend's
 *  "cup_competitions"). */
const BACKEND_FLAG_KEY: Record<FeatureName, string> = {
  marketplace: "marketplace",
  chain: "chain",
  cup: "cup_competitions",
  university: "university",
  contracts: "contracts",
};

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
 * Env-driven fallback map, used only until the real backend flags load (or for
 * non-React call sites that can't use the `useFeatureFlags` hook).
 *
 * Security: these were previously hardcoded `true` with no way to disable a
 * surface per environment. They are env-driven via NEXT_PUBLIC_ENABLE_*, so any
 * feature can still be turned OFF at build time by setting its var to "false".
 *
 * Default-ON / opt-out (`enabledUnlessDisabled`) is deliberate: it preserves the
 * features that are live in production today as the pre-fetch fallback (so this
 * can't silently dark-launch the site before the flags request resolves) while
 * still making every surface gateable. To move to strict opt-in (default-OFF
 * unless explicitly "true"), swap the resolver for `computeFeatures({ ... })`
 * once the deploy env sets the vars explicitly.
 */
export const FEATURES: Record<FeatureName, boolean> = {
  marketplace: enabledUnlessDisabled(process.env.NEXT_PUBLIC_ENABLE_MARKETPLACE),
  chain:       enabledUnlessDisabled(process.env.NEXT_PUBLIC_ENABLE_CHAIN),
  cup:         enabledUnlessDisabled(process.env.NEXT_PUBLIC_ENABLE_CUP),
  university:  enabledUnlessDisabled(process.env.NEXT_PUBLIC_ENABLE_UNIVERSITY),
  contracts:   enabledUnlessDisabled(process.env.NEXT_PUBLIC_ENABLE_CONTRACTS),
};

/** True if a named feature is enabled per the env-driven fallback map. Prefer
 *  `useFeatureFlags()` inside React components — this reads build-time env
 *  only, not the backend's live flag state. */
export function isFeatureEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}

/**
 * Pure merge: overlays the backend's resolved flag map (from `GET
 * /api/game/flags`, keyed by `BACKEND_FLAG_KEY`) onto the `fallback` map. A
 * missing/undefined `backend` (request loading, errored, or offline) returns
 * `fallback` unchanged, so a flaky network can't dark-launch every gated
 * surface. Split out from `useFeatureFlags` so the merge logic is unit-testable
 * without a QueryClient/React tree.
 */
export function mergeBackendFlags(
  backend: Record<string, boolean> | undefined,
  fallback: Record<FeatureName, boolean> = FEATURES,
): Record<FeatureName, boolean> {
  if (!backend) return fallback;

  const resolved = { ...fallback };
  for (const name of Object.keys(BACKEND_FLAG_KEY) as FeatureName[]) {
    const backendKey = BACKEND_FLAG_KEY[name];
    if (backendKey in backend) resolved[name] = backend[backendKey];
  }
  return resolved;
}

/**
 * The live, backend-authoritative feature-flag map for use inside React
 * components. Reads `GET /api/game/flags` (via `useBackendFlags`) and merges it
 * over the env-driven `FEATURES` fallback with `mergeBackendFlags`.
 *
 * This is what actually connects a backend kill switch (`FEATURE_MARKETPLACE=false`,
 * or flipping `feature_flags.marketplace` in `balance.yaml`) to the web UI.
 */
export function useFeatureFlags(): Record<FeatureName, boolean> {
  const { data } = useBackendFlags();
  return mergeBackendFlags(data?.flags);
}

/**
 * 3D bud renderer (WebGL/three.js) — the high-fidelity frosted bud, ON by
 * default for the pod/strain-hero previews (PodCommandCenter, StrainBud3D).
 *
 * The dedicated Bud Viewer (`dashboard/plants/[plantId]/bud`) always renders
 * BudGL when `hasWebGL()` is true — it doesn't consult this flag, since a 2D
 * fallback would defeat the point of a screen whose entire purpose is the 3D
 * inspection. The whole-plant Grow Chamber never mounts BudGL at all (2D
 * `GrowChamber` is its sole renderer). Set `NEXT_PUBLIC_ENABLE_BUD3D=false` to
 * force the remaining 3D-preview surfaces off build-wide. Always pair with
 * `hasWebGL()` at the mount so devices without WebGL fall back gracefully.
 */
export function isBud3DEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_BUD3D !== "false";
}

/**
 * Whether this browser can create a WebGL context. Cached after the first probe.
 * Used to gate the 3D bud renderer so no-WebGL devices fall back to the 2D
 * Canvas renderer instead of crashing. SSR-safe (returns false on the server).
 */
let _webgl: boolean | null = null;
export function hasWebGL(): boolean {
  if (_webgl !== null) return _webgl;
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    _webgl = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    _webgl = false;
  }
  return _webgl;
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
