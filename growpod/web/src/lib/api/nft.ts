import { apiFetch } from "./client";

interface NFTAsset {
  asset_id: number;
  type: "SEED" | "HARVEST";
  status: "minted" | "listed" | "staking" | "traded";
  game_item_id: string;
  ipfs_hash?: string;
  metadata?: Record<string, any>;
  minted_at: string;
}

export const nft = {
  getCollection: (playerId: string) =>
    apiFetch<NFTAsset[]>(`/api/nft/collection`, {
      headers: { "X-Player-ID": playerId },
    }),

  mint: (playerId: string, harvestId: string) =>
    apiFetch<{ asset_id: number; ipfs_hash?: string; status: string; txid: string }>(
      `/api/nft/mint`,
      {
        method: "POST",
        body: { harvest_id: harvestId },
        headers: { "X-Player-ID": playerId },
      },
    ),
};
