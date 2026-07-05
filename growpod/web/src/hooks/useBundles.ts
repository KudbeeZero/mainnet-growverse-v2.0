"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { store } from "@/lib/api/store";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";

export function useAvailableBundles() {
  return useQuery({
    queryKey: queryKeys.storeBundles(),
    queryFn: () => store.bundles(),
    staleTime: 60_000,
  });
}

export function usePurchaseBundle() {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (bundleId: string) => store.purchaseBundle(playerId!, bundleId),
    onSuccess: (data) => {
      toast.success(`✅ Bundle purchased! ${data.items_delivered.length} items added to inventory`);
      if (playerId) {
        qc.invalidateQueries({ queryKey: queryKeys.consumables(playerId) });
        qc.invalidateQueries({ queryKey: queryKeys.bundles(playerId) });
      }
    },
    onError: (e: any) => toast.error(e.message || "Bundle purchase failed"),
  });
}
