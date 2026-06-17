import { apiFetch } from "./client";
import type { Harvest } from "@/lib/types";

export const harvests = {
  list: (playerId: string) =>
    apiFetch<Harvest[]>(`/players/${playerId}/harvests`, { auth: true }),

  cure: (playerId: string, harvestId: string, targetHours: number) =>
    apiFetch<Harvest>(`/players/${playerId}/harvests/${harvestId}/cure`, {
      method: "POST",
      body: { target_hours: targetHours },
    }),

  finishCure: (playerId: string, harvestId: string, sell = false) =>
    apiFetch<Harvest>(`/players/${playerId}/harvests/${harvestId}/cure/finish`, {
      method: "POST",
      body: { sell },
    }),

  sell: (playerId: string, harvestId: string) =>
    apiFetch<Harvest>(`/players/${playerId}/harvests/${harvestId}/sell`, {
      method: "POST",
    }),

  mint: (playerId: string, harvestId: string) =>
    apiFetch<Harvest>(`/players/${playerId}/harvests/${harvestId}/mint`, {
      method: "POST",
    }),
};
