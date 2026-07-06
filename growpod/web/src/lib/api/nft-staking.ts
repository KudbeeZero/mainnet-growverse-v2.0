import { apiFetch } from "./client";
import type { StakingLock } from "@/lib/types";

// The "curing room": lock a minted NFT for a duration, earn bonus GC on claim
// (Sprint 4, testnet/mock, gated behind `nft_staking`). Blueprint lives at
// /api/stakes, not /api/game, so every call uses `raw: true`.
export const stakes = {
  createLock: (playerId: string, assetId: number, harvestId: string) =>
    apiFetch<{
      lock_id: string;
      asset_id: number;
      status: string;
      cure_end_at: string;
      rewards_amount: string;
    }>(`/api/stakes/players/${playerId}`, {
      method: "POST",
      body: { asset_id: assetId, harvest_id: harvestId },
      raw: true,
      auth: true,
    }),

  getLocks: (playerId: string) =>
    apiFetch<StakingLock[]>(`/api/stakes/players/${playerId}`, { raw: true, auth: true }),

  getLockProgress: (playerId: string, lockId: string) =>
    apiFetch<{
      lock_id: string;
      status: string;
      progress_pct: number;
      time_remaining_seconds: number;
      can_claim: boolean;
      rewards_amount: string;
    }>(`/api/stakes/players/${playerId}/${lockId}`, { raw: true, auth: true }),

  claimRewards: (playerId: string, lockId: string) =>
    apiFetch<{ lock_id: string; rewards_claimed: string; status: string }>(
      `/api/stakes/players/${playerId}/${lockId}/claim`,
      {
        method: "POST",
        raw: true,
        auth: true,
      },
    ),
};
