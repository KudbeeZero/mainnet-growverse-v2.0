"use client";

// Phase 5 — non-economic engagement widgets: a KXP + study-streak card (with the
// proactive nudge) and the KXP "Scholars" league. None of this is currency —
// KXP is a learning counter, separate from game XP and GROW.

import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

/** KXP total, study streak, freeze tokens, and the current coach nudge. */
export function StudyProgressCard() {
  const { playerId } = useSession();
  const q = useQuery({
    queryKey: ["universityProgress", playerId],
    queryFn: () => api.university.progress(playerId!),
    enabled: !!playerId,
    staleTime: 60_000,
  });

  if (!playerId || q.isLoading || q.isError || !q.data) return null;
  const p = q.data;

  return (
    <Card className="space-y-3">
      <CardHeader title="Study progress" subtitle="Knowledge-XP and your study streak." />

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-ink-800 p-3">
          <div className="text-2xl font-bold text-grow-200">{p.kxp}</div>
          <div className="instrument-label mt-0.5">KXP</div>
        </div>
        <div className="rounded-lg bg-ink-800 p-3">
          <div className="text-2xl font-bold text-amber-300">
            🔥 {p.streak_count}
          </div>
          <div className="instrument-label mt-0.5">DAY STREAK</div>
        </div>
        <div className="rounded-lg bg-ink-800 p-3">
          <div className="text-2xl font-bold text-accent-300">❄️ {p.freeze_tokens}</div>
          <div className="instrument-label mt-0.5">FREEZES</div>
        </div>
      </div>

      {p.next_nudge && (
        <p className="rounded-lg border border-grow-700/60 bg-grow-950/50 px-3 py-2 text-sm text-grow-100">
          💡 {p.next_nudge}
        </p>
      )}
    </Card>
  );
}

/** The KXP league — top scholars by Knowledge-XP. */
export function ScholarsLeagueCard() {
  const { playerId } = useSession();
  const q = useQuery({
    queryKey: ["scholarsLeague"],
    queryFn: () => api.university.scholars(10),
    staleTime: 60_000,
  });

  if (q.isLoading || q.isError || !q.data || q.data.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Scholars league" subtitle="Top learners by Knowledge-XP." />
      <ol className="space-y-1">
        {q.data.map((s, i) => (
          <li
            key={s.id}
            className={`flex items-center justify-between rounded px-2 py-1 text-sm ${
              s.id === playerId ? "bg-grow-900/50 text-grow-100" : "text-gray-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="w-5 tabular-nums text-gray-500">{i + 1}.</span>
              <span>{s.username}</span>
            </span>
            <span className="flex items-center gap-3 tabular-nums">
              <span className="text-amber-300">🔥 {s.streak_count}</span>
              <span className="font-semibold text-grow-200">{s.kxp} KXP</span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
