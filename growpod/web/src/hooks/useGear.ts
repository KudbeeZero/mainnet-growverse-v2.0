"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { store } from "@/lib/api/store";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import type { GearItem } from "@/lib/api/store";

export function usePlayerGear() {
  const { playerId } = useSession();
  return useQuery<GearItem[]>({
    queryKey: queryKeys.gear(playerId ?? ""),
    queryFn: () => store.gear(playerId!),
    enabled: !!playerId,
    staleTime: 30_000,
  });
}

export function useEquipGear(podId: string) {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation<unknown, Error, string>({
    mutationFn: (gearKey) => store.equipLight(playerId!, podId, gearKey),
    onSuccess: () => {
      toast.success("Equipment equipped");
      if (playerId) {
        qc.invalidateQueries({ queryKey: queryKeys.gear(playerId) });
        qc.invalidateQueries({ queryKey: queryKeys.plants(playerId) });
      }
    },
    onError: (e) => toast.error(e.message || "Equipment failed"),
  });
}
