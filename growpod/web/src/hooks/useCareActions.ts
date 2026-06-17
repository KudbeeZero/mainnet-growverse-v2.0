"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { useIdStore } from "@/lib/localStore";
import type { Plant, Harvest } from "@/lib/types";

type CareKind = "water" | "feed" | "treatPests" | "treatDisease";

const LABELS: Record<CareKind, string> = {
  water: "Watered",
  feed: "Fed nutrients",
  treatPests: "Treated pests",
  treatDisease: "Treated disease",
};

export function useCareActions(plantId: string) {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();

  function invalidate() {
    qc.invalidateQueries({ queryKey: queryKeys.plant(plantId) });
    qc.invalidateQueries({ queryKey: queryKeys.events(plantId) });
    if (playerId) {
      qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
      qc.invalidateQueries({ queryKey: queryKeys.player(playerId) });
    }
  }

  const care = useMutation<Plant, ApiError, CareKind>({
    mutationFn: (kind) => {
      if (kind === "water") return api.plants.water(playerId!, plantId);
      if (kind === "feed") return api.plants.feed(playerId!, plantId);
      if (kind === "treatPests") return api.plants.treatPests(playerId!, plantId);
      return api.plants.treatDisease(playerId!, plantId);
    },
    onSuccess: (_data, kind) => {
      toast.success(LABELS[kind]);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const harvest = useMutation<Harvest, ApiError, { sell: boolean }>({
    mutationFn: ({ sell }) => api.plants.harvest(playerId!, plantId, { sell }),
    onSuccess: (h) => {
      const q = Math.round(h.quality ?? 0);
      toast.success(
        h.sold
          ? `✅ Harvested! Quality ${q}/100 · +${h.sale_value} GC`
          : `✅ Harvested! Quality ${q}/100 — sell it in your profile`,
      );
      invalidate();
      if (playerId) {
        qc.invalidateQueries({ queryKey: queryKeys.plants(playerId) });
        qc.invalidateQueries({ queryKey: queryKeys.ledger(playerId) });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  return { care, harvest };
}

export function usePlantImport() {
  const { playerId } = useSession();
  const addPlant = useIdStore((s) => s.addPlant);
  const toast = useToast();
  const qc = useQueryClient();

  return useMutation<void, ApiError, string>({
    mutationFn: async (plantId) => {
      await api.plants.state(playerId!, plantId); // validate it exists & is ours
    },
    onSuccess: (_v, plantId) => {
      addPlant(playerId!, plantId);
      qc.invalidateQueries({ queryKey: queryKeys.plants(playerId!) });
      toast.success("Plant imported");
    },
    onError: (e) => toast.error(e.message),
  });
}
