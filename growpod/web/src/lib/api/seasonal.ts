import { apiFetch } from "./client";
import type { SeasonalStrain } from "@/lib/types";

export const seasonal = {
  currentStrains: () =>
    apiFetch<SeasonalStrain[]>(`/seasonal/strains`),

  purchase: (playerId: string, seasonalId: string) =>
    apiFetch<Record<string, unknown>>(
      `/players/${playerId}/seasonal/strains/${seasonalId}/purchase`,
      { method: "POST" },
    ),
};
