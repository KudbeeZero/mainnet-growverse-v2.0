import { apiFetch } from "./client";
import type { NFTAsset } from "@/lib/types";

// NFT collection + minting (Sprint 4, testnet/mock, gated behind
// `nft_marketplace`). Blueprint lives at /api/nft, not /api/game, so every
// call uses `raw: true` and spells out the full path.
export const nft = {
  getCollection: (playerId: string) =>
    apiFetch<NFTAsset[]>(`/api/nft/players/${playerId}/collection`, {
      raw: true,
      auth: true,
    }),

  mint: (playerId: string, harvestId: string) =>
    apiFetch<NFTAsset>(`/api/nft/players/${playerId}/mint`, {
      method: "POST",
      body: { harvest_id: harvestId },
      raw: true,
      auth: true,
    }),
};
