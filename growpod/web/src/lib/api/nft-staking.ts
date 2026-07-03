import { apiFetch } from "./client";
import type { StakingLock } from "@/lib/types";

export const stakes = {
  createLock: (playerId: string, assetId: number, harvestId: string) =>
    apiFetch<{
      lock_id: string;
      asset_id: number;
      status: string;
      cure_end_at: string;
      rewards_amount: string;
    }>(`/api/stakes`, {
      method: "POST",
      body: { asset_id: assetId, harvest_id: harvestId },
      auth: true,
      headers: { "X-Player-ID": playerId },
    }),

  getLocks: (playerId: string) =>
    apiFetch<StakingLock[]>(`/api/stakes`, {
      auth: true,
      headers: { "X-Player-ID": playerId },
    }),

  getLockProgress: (playerId: string, lockId: string) =>
    apiFetch<{
      lock_id: string;
      status: string;
      progress_pct: number;
      time_remaining_seconds: number;
      can_claim: boolean;
      rewards_amount: string;
    }>(`/api/stakes/${lockId}`, {
      auth: true,
      headers: { "X-Player-ID": playerId },
    }),

  claimRewards: (playerId: string, lockId: string) =>
    apiFetch<{ lock_id: string; rewards_claimed: string; status: string }>(
      `/api/stakes/${lockId}/claim`,
      {
        method: "POST",
        auth: true,
        headers: { "X-Player-ID": playerId },
      },
    ),
};
