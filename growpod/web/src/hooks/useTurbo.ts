"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TurboState } from "@/lib/api";

/**
 * Global per-ACCOUNT "10× test" speed faucet.
 *
 * Unlike the old client-side dev-clock loop (which 404'd in production), this is
 * server-authoritative: flipping it sets a banked, forward-only multiplier on
 * the player so EVERY pod advances together, and it survives in prod. The hook
 * exposes the server's truth (`enabled`) and a toggle that, on success, pulls
 * fresh accelerated plant/pod state so the change is reflected immediately.
 */
export function useTurbo(playerId: string | null) {
  const qc = useQueryClient();

  const state = useQuery<TurboState>({
    queryKey: ["turbo", playerId],
    queryFn: () => api.turbo.get(playerId!),
    enabled: !!playerId,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api.turbo.set(playerId!, enabled),
    onSuccess: (data) => {
      qc.setQueryData(["turbo", playerId], data);
      // Every pod just jumped to the new clock on the server — refetch the
      // plant/pod views so the account reflects it without waiting for a poll.
      qc.invalidateQueries({ queryKey: ["plant"] });
      qc.invalidateQueries({ queryKey: ["plants"] });
      qc.invalidateQueries({ queryKey: ["pods"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return {
    enabled: state.data?.enabled ?? false,
    multiplier: state.data?.multiplier ?? 10,
    isToggling: toggle.isPending,
    toggle: (next: boolean) => toggle.mutate(next),
  };
}
