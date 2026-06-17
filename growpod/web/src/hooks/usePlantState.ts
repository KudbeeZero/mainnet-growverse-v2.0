"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { PlantState } from "@/lib/types";

const POLL_MS = 7_000;

/**
 * Polls a plant's /state endpoint. Because the backend advances the simulation
 * lazily on read, polling is what drives the visible changes. Polling stops once
 * the plant is dead or harvested.
 */
export function usePlantState(playerId: string, plantId: string, enabled = true) {
  return useQuery<PlantState>({
    queryKey: queryKeys.plant(plantId),
    queryFn: () => api.plants.state(playerId, plantId),
    enabled: enabled && Boolean(playerId && plantId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (!data.is_alive || data.harvested)) return false;
      return POLL_MS;
    },
    refetchIntervalInBackground: false,
  });
}
