import { apiFetch } from "./client";

/** Response shape of `GET /api/game/flags`: the resolved backend feature-flag
 *  map (balance.yaml defaults with FEATURE_<NAME> env overrides applied). */
export interface FlagsResponse {
  flags: Record<string, boolean>;
}

/** Public, unauthenticated read of the backend's real feature-flag state. */
export const flags = {
  get: () => apiFetch<FlagsResponse>("/flags", { auth: false }),
};
