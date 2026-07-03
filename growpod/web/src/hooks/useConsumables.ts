"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import type { Plant } from "@/lib/types";
import type { ConsumableItem } from "@/lib/api/store";

/** The player's consumables catalog + owned counts (GET /players/:id/shop). */
export function useConsumables() {
  const { playerId } = useSession();
  return useQuery<ConsumableItem[]>({
    queryKey: queryKeys.consumables(playerId ?? ""),
    queryFn: () => api.store.consumables(playerId!),
    enabled: !!playerId,
    staleTime: 30_000,
  });
}

/**
 * Apply an owned consumable to a plant. Spends the owned inventory stack (no
 * currency — it was bought already) and buffs the plant, so we refresh the
 * plant state, its events, and the consumables list (owned count drops).
 */
export function useApplyConsumable(plantId: string) {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation<Plant, ApiError, { itemKey: string; name: string }>({
    mutationFn: ({ itemKey }) => api.plants.applyConsumable(playerId!, plantId, itemKey),
    onSuccess: (_plant, { name }) => {
      toast.success(`Applied ${name}`);
      qc.invalidateQueries({ queryKey: queryKeys.plant(plantId) });
      qc.invalidateQueries({ queryKey: queryKeys.events(plantId) });
      if (playerId) {
        qc.invalidateQueries({ queryKey: queryKeys.consumables(playerId) });
        qc.invalidateQueries({ queryKey: queryKeys.plants(playerId) });
      }
    },
    onError: (e) => toast.push(e.message || "Couldn't apply that consumable", "error"),
  });
}
