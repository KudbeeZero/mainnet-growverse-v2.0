import { apiFetch } from "./client";
import type { Seed } from "@/lib/types";

export const seeds = {
  list: (playerId: string) =>
    apiFetch<Seed[]>(`/players/${playerId}/seeds`, { auth: true }),

  buy: (playerId: string, strainId: string, quantity = 1) =>
    apiFetch<Seed>(`/players/${playerId}/seeds/buy`, {
      method: "POST",
      body: { strain_id: strainId, quantity },
    }),
};
