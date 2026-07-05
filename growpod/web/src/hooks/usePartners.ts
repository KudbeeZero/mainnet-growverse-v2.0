"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { store } from "@/lib/api/store";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";

export function useAvailablePartners() {
  return useQuery({
    queryKey: queryKeys.storePartners(),
    queryFn: () => store.partners(),
    staleTime: 60_000,
  });
}

export function usePurchasePartner() {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (partnerId: string) => store.purchasePartner(playerId!, partnerId),
    onSuccess: (data) => {
      const itemType = data.product_type === "consumable" ? "consumable" : "seed";
      toast.success(`✅ Partner product purchased! Added to inventory`);
      if (playerId) {
        if (data.product_type === "consumable") {
          qc.invalidateQueries({ queryKey: queryKeys.consumables(playerId) });
        } else {
          qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId) });
        }
      }
    },
    onError: (e: any) => toast.error(e.message || "Purchase failed"),
  });
}
