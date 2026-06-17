import { apiFetch } from "./client";
import type { CupCurrent, CupEntry, CupEnterResult, HallOfFameEntry } from "@/lib/types";

export const cup = {
  current: () => apiFetch<CupCurrent>(`/cup/current`),

  standings: (cupId: string) => apiFetch<CupEntry[]>(`/cup/${cupId}/standings`),

  hallOfFame: () => apiFetch<HallOfFameEntry[]>(`/cup/hall-of-fame`),

  enter: (playerId: string, harvestId: string) =>
    apiFetch<CupEnterResult>(`/players/${playerId}/cup/enter`, {
      method: "POST",
      body: { harvest_id: harvestId },
    }),
};
