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

  // `soilKey` is a `shop.gear` soil catalog key (e.g. "coco_coir") the player
  // already owns — chosen once, for this plant's whole life (see
  // GameService.plant_seed / simulation/engine._soil_effects).
  plant: (playerId: string, seedId: string, podId: string, soilKey?: string) =>
    apiFetch<Plant>(`/players/${playerId}/plant`, {
      method: "POST",
      body: { seed_id: seedId, pod_id: podId, soil_key: soilKey },
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

  // Free "care tool" actions — no GROW cost (gentle once-per-stage / cooldown
  // effects enforced server-side).
  prune: (playerId: string, plantId: string) =>
    apiFetch<Plant>(`/players/${playerId}/plants/${plantId}/prune`, {
      method: "POST",
    }),

  train: (playerId: string, plantId: string) =>
    apiFetch<Plant>(`/players/${playerId}/plants/${plantId}/train`, {
      method: "POST",
    }),

  boost: (playerId: string, plantId: string) =>
    apiFetch<Plant>(`/players/${playerId}/plants/${plantId}/boost`, {
      method: "POST",
    }),

  // Use one OWNED shop consumable on this plant (POST .../apply). Spends the
  // owned inventory stack (no currency/ledger — it's already been bought) and
  // applies its effect to the plant's simulated levels.
  applyConsumable: (playerId: string, plantId: string, itemKey: string) =>
    apiFetch<Plant>(`/players/${playerId}/plants/${plantId}/apply`, {
      method: "POST",
      body: { item_key: itemKey },
    }),

  // Purchasable (simulated) growth boost — spends in-game GROW to fast-forward
  // the lifecycle a few hours AND revive a struggling plant. Real-money checkout
  // attaches later server-side; this calls the same effect with GROW now.
  growthBoost: (playerId: string, plantId: string) =>
    apiFetch<Plant>(`/players/${playerId}/plants/${plantId}/growth-boost`, {
      method: "POST",
    }),

  // ACCELERATE TIME — fast-forward the plant's grow clock by `hours` (a free
  // time control; the deterministic engine recomputes the trajectory). Powers
  // the command center's +1h / +6h / +1d buttons.
  advance: (playerId: string, plantId: string, hours: number) =>
    apiFetch<Plant>(`/players/${playerId}/plants/${plantId}/advance`, {
      method: "POST",
      body: { hours },
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

  // Pay 25 GROW to remove a harvested/dead plant and free the pod slot.
  cleanup: (playerId: string, plantId: string) =>
    apiFetch<void>(`/players/${playerId}/plants/${plantId}`, {
      method: "DELETE",
    }),
};
