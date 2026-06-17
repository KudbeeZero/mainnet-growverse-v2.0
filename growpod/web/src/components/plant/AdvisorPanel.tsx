"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { SeverityPill, UrgencyPill } from "@/components/ui/Pills";
import { useApiMutation } from "@/hooks/useApiMutation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { titleCase } from "@/lib/format";

/**
 * The AI "Master Grower" — read-only diagnosis on demand, plus the guarded
 * agentic auto-care path (budget + action cap; every action posts to the
 * ledger). The advisor query is lazy: nothing is fetched until the grower asks.
 */
export function AdvisorPanel({ plantId }: { plantId: string }) {
  const { playerId } = useSession();
  const [asked, setAsked] = useState(false);
  const [budget, setBudget] = useState(50);

  const advisor = useQuery({
    queryKey: queryKeys.advisor(plantId),
    queryFn: () => api.advisor.get(playerId!, plantId),
    enabled: asked && !!playerId,
    staleTime: 30_000,
  });

  const autoCare = useApiMutation(
    () => api.advisor.autoCare(playerId!, plantId, { budget, max_actions: 5 }),
    {
      invalidate: [queryKeys.plant(plantId), queryKeys.events(plantId), queryKeys.wallet(playerId ?? "")],
      successMessage: (r) => `Auto-care ran — spent ${r.spent} GC across ${r.actions_taken.length} actions`,
    },
  );

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>🤖</span>
          <h3 className="text-sm font-semibold text-gray-100">AI Master Grower</h3>
          {advisor.data?.provider && (
            <Badge className="border-ink-600 bg-ink-700 text-[10px] text-gray-400">
              {advisor.data.provider}
            </Badge>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => { setAsked(true); advisor.refetch(); }}>
          {advisor.data ? "Re-diagnose" : "Ask the grower"}
        </Button>
      </div>

      {!asked && (
        <p className="text-sm text-gray-500">
          Get a calibrated diagnosis and an ordered, grounded list of next actions for this plant.
        </p>
      )}

      {asked && advisor.isLoading && <LoadingBlock label="Reading the plant…" />}
      {asked && advisor.isError && (
        <p className="text-sm text-red-300">
          {(advisor.error as Error)?.message ?? "Advisor unavailable"}
        </p>
      )}

      {advisor.data && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <SeverityPill severity={String(advisor.data.severity)} />
            <span className="text-sm text-gray-200">{advisor.data.summary}</span>
          </div>
          <p className="text-sm text-gray-400">{advisor.data.diagnosis}</p>
          {advisor.data.suggestions.length > 0 && (
            <ul className="space-y-1.5">
              {advisor.data.suggestions.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2 text-sm"
                >
                  <UrgencyPill urgency={s.urgency} />
                  <div>
                    <span className="font-medium text-gray-200">{titleCase(s.action)}</span>
                    <span className="ml-1 text-gray-400">— {s.reason}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 pt-3">
            <span className="instrument-label">Auto-care budget</span>
            <input
              type="number"
              min={1}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-24 rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-sm text-gray-100"
            />
            <Button
              size="sm"
              loading={autoCare.isPending}
              onClick={() => autoCare.mutate()}
            >
              ⚡ Let the AI care for it
            </Button>
            <span className="text-[11px] text-gray-500">
              Spends from your wallet, capped at the budget + 5 actions.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
