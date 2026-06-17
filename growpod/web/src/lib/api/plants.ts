import { apiFetch } from "./client";
import type { Plant, PlantState, PlantEvent, Harvest, AdvisorReport } from "@/lib/types";

export const plants = {
  list: (playerId: string) =>
    apiFetch<Plant[]>(`/players/${playerId}/plants`, { auth: true }),

  state: (playerId: string, plantId: string) =>
    apiFetch<PlantState>(`/players/${playerId}/plants/${plantId}/state`, {
      auth: true,
    }),

  events: (plantId: string, limit = 50) =>
    apiFetch<PlantEvent[]>(`/plants/${plantId}/events`, { query: { limit } }),

  plant: (playerId: string, seedId: string, podId: string) =>
    apiFetch<Plant>(`/players/${playerId}/plant`, {
      method: "POST",
      body: { seed_id: seedId, pod_id: podId },
    }),

  water: (playerId: string, plantId: string, amount?: number) =>
    apiFetch<Plant>(`/players/${playerId}/plants/${plantId}/water`, {
      method: "POST",
      body: { amount },
    }),

  feed: (playerId: string, plantId: string, amount?: number) =>
    apiFetch<Plant>(`/players/${playerId}/plants/${plantId}/feed`, {
      method: "POST",
      body: { amount },
    }),

  treatPests: (playerId: string, plantId: string) =>
    apiFetch<Plant>(`/players/${playerId}/plants/${plantId}/treat-pests`, {
      method: "POST",
    }),

  treatDisease: (playerId: string, plantId: string) =>
    apiFetch<Plant>(`/players/${playerId}/plants/${plantId}/treat-disease`, {
      method: "POST",
    }),

  // Yield weight & quality are computed server-side from the plant's grown
  // state; the client only chooses whether to immediately sell.
  harvest: (playerId: string, plantId: string, opts: { sell?: boolean } = {}) =>
    apiFetch<Harvest>(`/players/${playerId}/plants/${plantId}/harvest`, {
      method: "POST",
      body: { sell: opts.sell ?? true },
    }),

  mintHarvest: (playerId: string, harvestId: string) =>
    apiFetch<Harvest>(`/players/${playerId}/harvests/${harvestId}/mint`, {
      method: "POST",
    }),

  // AI "Master Grower" diagnosis for a plant (read-only).
  advisor: (playerId: string, plantId: string) =>
    apiFetch<AdvisorReport>(`/players/${playerId}/plants/${plantId}/advisor`, {
      auth: true,
    }),
};
