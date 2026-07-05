"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { useIdStore } from "@/lib/localStore";
import type { Plant, Harvest } from "@/lib/types";

type CareKind =
  | "water"
  | "feed"
  | "treatPests"
  | "treatDisease"
  | "prune"
  | "train"
  | "boost";

const LABELS: Record<CareKind, string> = {
  water: "Watered",
  feed: "Fed nutrients",
  treatPests: "Treated pests",
  treatDisease: "Treated disease",
  prune: "Pruned",
  train: "Trained",
  boost: "Boosted",
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
      // Also refresh the dashboard plant LIST object so any list-level view
      // (sort/filter) tracks the change, not just the per-plant card query.
      qc.invalidateQueries({ queryKey: queryKeys.plants(playerId) });
    }
  }

  const care = useMutation<Plant, ApiError, CareKind>({
    mutationFn: (kind) => {
      if (kind === "water") return api.plants.water(playerId!, plantId);
      if (kind === "feed") return api.plants.feed(playerId!, plantId);
      if (kind === "treatPests") return api.plants.treatPests(playerId!, plantId);
      if (kind === "prune") return api.plants.prune(playerId!, plantId);
      if (kind === "train") return api.plants.train(playerId!, plantId);
      if (kind === "boost") return api.plants.boost(playerId!, plantId);
      return api.plants.treatDisease(playerId!, plantId);
    },
    onSuccess: (_data, kind) => {
      toast.success(LABELS[kind]);
      // Check for care-streak milestones (5d, 10d, 15d, 20d, 25d, etc.)
      if (_data.care_streak && _data.care_streak % 5 === 0 && _data.care_streak >= 5) {
        const milestoneEmojis: Record<number, string> = {
          5: "🔥",
          10: "⭐",
          15: "🏆",
          20: "👑",
        };
        const emoji = milestoneEmojis[_data.care_streak] || "✨";
        setTimeout(
          () => toast.success(`${emoji} ${_data.care_streak}-day care streak!`),
          800,
        );
      }
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
      // Quality milestone celebration with emoji rings
      if (q >= 50) {
        const qualityEmoji = q >= 90 ? "🏆" : q >= 70 ? "⭐" : q >= 50 ? "✨" : "💚";
        setTimeout(
          () => toast.success(`${qualityEmoji} Quality milestone! ${q}/100`),
          800,
        );
      }
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

/**
 * Purchasable (simulated) growth boost. Spends in-game GROW to fast-forward the
 * plant a few hours AND revive a struggling one. `onBoosted` fires on success so
 * the caller can play the ⚡ electric animation. (Real-money checkout attaches
 * later server-side — see SimulationService.apply_growth_boost.)
 */
export function useGrowthBoost(plantId: string, onBoosted?: () => void) {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation<Plant, ApiError, void>({
    mutationFn: () => api.plants.growthBoost(playerId!, plantId),
    onSuccess: () => {
      toast.success("⚡ Growth boosted — fast-forwarded & revived!");
      qc.invalidateQueries({ queryKey: queryKeys.plant(plantId) });
      qc.invalidateQueries({ queryKey: queryKeys.events(plantId) });
      if (playerId) {
        qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
        qc.invalidateQueries({ queryKey: queryKeys.player(playerId) });
        // Keep the dashboard plant list in lockstep with the boosted card.
        qc.invalidateQueries({ queryKey: queryKeys.plants(playerId) });
      }
      onBoosted?.();
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useCleanupPlant() {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const removePlant = useIdStore((s) => s.removePlant);

  return useMutation<void, ApiError, string>({
    mutationFn: (plantId) => api.plants.cleanup(playerId!, plantId),
    onSuccess: (_v, plantId) => {
      toast.success("Pod cleaned up · ready for a new seed 🌱");
      // Refresh any detail/chamber view open on this exact plant, not just the list.
      qc.invalidateQueries({ queryKey: queryKeys.plant(plantId) });
      if (playerId) {
        removePlant(playerId, plantId);
        qc.invalidateQueries({ queryKey: queryKeys.plants(playerId) });
        qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
        qc.invalidateQueries({ queryKey: queryKeys.player(playerId) });
      }
    },
    onError: (e) => toast.error(e.message),
  });
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
