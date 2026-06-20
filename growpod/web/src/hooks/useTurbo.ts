"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useDevSpeedStore } from "@/lib/devSpeedStore";

/**
 * The global per-account "10× test" speed faucet.
 *
 * `enabled` is server truth (the toggle reflects the account, not a client
 * guess). Flipping it POSTs to the backend, which accelerates EVERY one of the
 * account's pods on its own clock; we then invalidate the plant/pods/player
 * caches so the accelerated state shows immediately and keeps updating on the
 * normal poll. No client-side clock ticking — the server owns the time.
 */
export function useTurbo(playerId: string | null) {
  const qc = useQueryClient();

  const state = useQuery({
    queryKey: ["turbo", playerId],
    queryFn: () => api.turbo.get(playerId!),
    enabled: !!playerId,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  // Mirror server truth into the legacy client store so every existing consumer
  // (plant-card glow, nav badge, QA milestones) reflects the account's real
  // turbo state without each one having to call the API.
  const serverEnabled = state.data?.enabled;
  useEffect(() => {
    if (serverEnabled !== undefined) {
      useDevSpeedStore.getState().setDevSpeed(serverEnabled);
    }
  }, [serverEnabled]);

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api.turbo.set(playerId!, enabled),
    onSuccess: (data) => {
      qc.setQueryData(["turbo", playerId], data);
      useDevSpeedStore.getState().setDevSpeed(data.enabled);
      if (playerId) {
        qc.invalidateQueries({ queryKey: queryKeys.plants(playerId) });
        qc.invalidateQueries({ queryKey: queryKeys.pods(playerId) });
        qc.invalidateQueries({ queryKey: queryKeys.player(playerId) });
      }
      // Every open plant view (key ["plant", id]) — refresh to the new clock.
      qc.invalidateQueries({ queryKey: ["plant"] });
    },
  });

  return {
    enabled: state.data?.enabled ?? false,
    multiplier: state.data?.multiplier ?? 10,
    isToggling: toggle.isPending,
    setEnabled: (next: boolean) => toggle.mutate(next),
    toggle: () => toggle.mutate(!(state.data?.enabled ?? false)),
  };
}
