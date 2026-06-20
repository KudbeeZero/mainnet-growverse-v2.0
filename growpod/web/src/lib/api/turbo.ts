import { apiFetch } from "./client";

/** Server-truth state of the global per-account 10× speed faucet. */
export interface TurboState {
  enabled: boolean;
  multiplier: number;
  offset_hours: number;
  effective_now: string;
  wall_now: string;
  /** Number of pods caught up to the new clock (set on a toggle response). */
  synced_pods?: number;
}

export const turbo = {
  get: (playerId: string) =>
    apiFetch<TurboState>(`/players/${playerId}/turbo`, { auth: true }),
  /** Turn the global speed faucet ON/OFF for the whole account. */
  set: (playerId: string, enabled: boolean) =>
    apiFetch<TurboState>(`/players/${playerId}/turbo`, {
      method: "POST",
      body: { enabled },
    }),
};
