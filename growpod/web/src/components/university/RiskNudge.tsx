"use client";

// Phase 6e — a small, encouraging banner derived from the learner's risk_level
// (+ streak). NON-economic: never references GROW/wallet. Silent until the
// learner model is available.

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/lib/session";
import { riskNudge } from "@/lib/university/learnerPath";

export function RiskNudge() {
  const { playerId } = useSession();
  const q = useQuery({
    queryKey: queryKeys.learner(playerId ?? ""),
    queryFn: () => api.university.learner(playerId!),
    enabled: !!playerId,
    staleTime: 30_000,
  });

  if (!playerId || q.isLoading || q.isError || !q.data) return null;
  const nudge = riskNudge(q.data);
  if (!nudge) return null;

  const warn = nudge.tone === "warning";
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        warn
          ? "border-amber-700/60 bg-amber-950/40 text-amber-100"
          : "border-grow-700/60 bg-grow-950/50 text-grow-100"
      }`}
    >
      <div className="text-sm font-semibold">
        {warn ? "⏰ " : "🔥 "}
        {nudge.title}
      </div>
      <div className={`mt-0.5 text-sm ${warn ? "text-amber-200/90" : "text-grow-200/90"}`}>
        {nudge.body}
      </div>
    </div>
  );
}
