import { apiFetch } from "./client";

interface StakingLock {
  lock_id: string;
  asset_id: number;
  status: "active" | "complete" | "withdrawn";
  cure_started_at: string;
  cure_ends_at: string;
  progress_pct: number;
  time_remaining_seconds: number;
  rewards_amount: string;
  can_claim: boolean;
}

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
      headers: { "X-Player-ID": playerId },
    }),

  getLocks: (playerId: string) =>
    apiFetch<StakingLock[]>(`/api/stakes`, {
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
      headers: { "X-Player-ID": playerId },
    }),

  claimRewards: (playerId: string, lockId: string) =>
    apiFetch<{ lock_id: string; rewards_claimed: string; status: string }>(
      `/api/stakes/${lockId}/claim`,
      {
        method: "POST",
        headers: { "X-Player-ID": playerId },
      },
    ),
};
