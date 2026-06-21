"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TurboState } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { turboView } from "@/lib/turboView";

/**
 * Global per-ACCOUNT turbo speed faucet (server-tuned multiplier; ~5-min
 * seed→harvest at the current 250× so growth is actually watchable).
 *
 * Unlike the old client-side dev-clock loop (which 404'd in production), this is
 * server-authoritative: flipping it sets a banked, forward-only multiplier on
 * the player so EVERY pod advances together, and it survives in prod. The hook
 * exposes the server's truth (`enabled`) and a toggle that, on success, pulls
 * fresh accelerated plant/pod state so the change is reflected immediately.
 */
export function useTurbo(playerId: string | null) {
  const qc = useQueryClient();
  const toast = useToast();

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
    // Without this the SPEED toggle failed SILENTLY — the chip flipped back and
    // the tester had no idea why "control time" did nothing. Tell them, and
    // re-sync to the server's real turbo state so the control reflects truth.
    onError: (e: Error) => {
      toast.error(`Couldn't change speed — ${e.message}`);
      qc.invalidateQueries({ queryKey: ["turbo", playerId] });
    },
  });

  const view = turboView(state.data);

  return {
    enabled: view.enabled,
    multiplier: view.multiplier,
    isToggling: toggle.isPending,
    toggle: (next: boolean) => toggle.mutate(next),
  };
}
