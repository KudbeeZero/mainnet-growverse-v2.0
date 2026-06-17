import { apiFetch } from "./client";
import type { Listing } from "@/lib/types";

export const market = {
  list: () => apiFetch<Listing[]>("/market"),

  createListing: (playerId: string, seedId: string, quantity: number, unitPrice: number) =>
    apiFetch<Listing>(`/players/${playerId}/market/list`, {
      method: "POST",
      body: { seed_id: seedId, quantity, unit_price: unitPrice },
    }),

  createAuction: (
    playerId: string,
    seedId: string,
    quantity: number,
    minBid: number,
    durationHours = 24,
  ) =>
    apiFetch<Listing>(`/players/${playerId}/market/auction`, {
      method: "POST",
      body: { seed_id: seedId, quantity, min_bid: minBid, duration_hours: durationHours },
    }),

  bid: (playerId: string, listingId: string, amount: number) =>
    apiFetch<Listing>(`/players/${playerId}/market/${listingId}/bid`, {
      method: "POST",
      body: { amount },
    }),

  settle: (playerId: string, listingId: string) =>
    apiFetch<Listing>(`/players/${playerId}/market/${listingId}/settle`, {
      method: "POST",
    }),

  buy: (playerId: string, listingId: string) =>
    apiFetch<Listing>(`/players/${playerId}/market/${listingId}/buy`, {
      method: "POST",
    }),
};
