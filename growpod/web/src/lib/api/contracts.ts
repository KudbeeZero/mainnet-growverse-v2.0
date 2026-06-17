import { apiFetch } from "./client";
import type { Contract } from "@/lib/types";

export const contracts = {
  list: (playerId: string, status?: "open" | "fulfilled") =>
    apiFetch<Contract[]>(`/players/${playerId}/contracts`, {
      auth: true,
      query: { status },
    }),

  // Contract draw uses a server-generated RNG seed (no client seed-shopping).
  offer: (playerId: string) =>
    apiFetch<Contract>(`/players/${playerId}/contracts/offer`, {
      method: "POST",
    }),

  fulfill: (playerId: string, contractId: string) =>
    apiFetch<Record<string, unknown>>(
      `/players/${playerId}/contracts/${contractId}/fulfill`,
      { method: "POST" },
    ),
};
