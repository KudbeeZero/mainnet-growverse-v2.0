import { apiFetch } from "./client";
import type { NFTListing, NFTTrade } from "@/lib/types";

// NFT marketplace: browsing is public, mutations are player-scoped (Sprint 4,
// testnet/mock, gated behind `nft_marketplace`). Blueprint lives at
// /api/market, not /api/game, so every call uses `raw: true`.
export const nftMarket = {
  getListings: (params: { limit?: number; offset?: number; sort?: string }) =>
    apiFetch<{ listings: NFTListing[]; total: number; limit: number; offset: number }>(
      `/api/market/listings`,
      {
        raw: true,
        auth: false,
        query: {
          limit: params.limit ?? 20,
          offset: params.offset ?? 0,
          sort: params.sort ?? "created_at",
        },
      },
    ),

  getListingDetail: (listingId: string) =>
    apiFetch<NFTListing>(`/api/market/listings/${listingId}`, { raw: true, auth: false }),

  createListing: (playerId: string, assetId: number, priceUalgos: string) =>
    apiFetch<NFTListing>(`/api/market/players/${playerId}/listings`, {
      method: "POST",
      body: { asset_id: assetId, price_ualgos: priceUalgos },
      raw: true,
      auth: true,
    }),

  cancelListing: (playerId: string, listingId: string) =>
    apiFetch<{ status: string }>(`/api/market/players/${playerId}/listings/${listingId}`, {
      method: "DELETE",
      raw: true,
      auth: true,
    }),

  executeTrade: (playerId: string, listingId: string) =>
    apiFetch<{ trade_id: string; listing_id: string; status: string; price_ualgos: string }>(
      `/api/market/players/${playerId}/execute/${listingId}`,
      {
        method: "POST",
        raw: true,
        auth: true,
      },
    ),

  getPriceHistory: (assetId: number) =>
    apiFetch<NFTTrade[]>(`/api/market/history/${assetId}`, { raw: true, auth: false }),
};
