import { apiFetch } from "./client";
import type { NFTAsset } from "@/lib/types";

export const nft = {
  getCollection: (playerId: string) =>
    apiFetch<NFTAsset[]>(`/api/nft/collection`, {
      auth: true,
      headers: { "X-Player-ID": playerId },
    }),

  mint: (playerId: string, harvestId: string) =>
    apiFetch<{ asset_id: number; ipfs_hash?: string; status: string; txid: string }>(
      `/api/nft/mint`,
      {
        method: "POST",
        body: { harvest_id: harvestId },
        auth: true,
        headers: { "X-Player-ID": playerId },
      },
    ),
};
