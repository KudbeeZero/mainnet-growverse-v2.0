import { apiFetch } from "./client";
import type { NFTListing } from "@/lib/types";

interface NFTTrade {
  trade_id: string;
  listing_id: string;
  status: "pending" | "confirmed" | "failed";
  price_ualgos: string;
  created_at: string;
}

export const market = {
  getListings: (params: { limit?: number; offset?: number; sort?: string }) =>
    apiFetch<{ listings: NFTListing[]; total: number; limit: number; offset: number }>(
      `/api/market/listings`,
      {
        query: {
          limit: params.limit ?? 20,
          offset: params.offset ?? 0,
          sort: params.sort ?? "created_at",
        },
      },
    ),

  getListingDetail: (listingId: string) =>
    apiFetch<NFTListing>(`/api/market/listings/${listingId}`),

  createListing: (playerId: string, assetId: number, priceUalgos: string) =>
    apiFetch<{ listing_id: string; asset_id: number; price_ualgos: string; status: string }>(
      `/api/market/listings`,
      {
        method: "POST",
        body: { asset_id: assetId, price_ualgos: priceUalgos },
        auth: true,
        headers: { "X-Player-ID": playerId },
      },
    ),

  cancelListing: (playerId: string, listingId: string) =>
    apiFetch<{ status: string }>(`/api/market/listings/${listingId}`, {
      method: "DELETE",
      auth: true,
      headers: { "X-Player-ID": playerId },
    }),

  executeTrade: (playerId: string, listingId: string) =>
    apiFetch<{ trade_id: string; listing_id: string; status: string; price_ualgos: string }>(
      `/api/market/execute/${listingId}`,
      {
        method: "POST",
        auth: true,
        headers: { "X-Player-ID": playerId },
      },
    ),

  getPriceHistory: (assetId: number) =>
    apiFetch<NFTTrade[]>(`/api/market/history/${assetId}`),
};
