"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { ConditionFlag } from "@/lib/types";
import { buildLiveFindings } from "@/lib/liveScouts";
import { AgentBubble } from "./AgentBubble";
import { SpecialistModal } from "./SpecialistModal";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import type { ScoutFinding } from "./introScript";

const STAGGER_MS = 500;

/**
 * Phase 2A: AI scouts over a REAL plant on the dashboard. Conditions come from
 * the plant's live `condition_flags` (free with usePlantState); the scout note
 * is enriched with the real advisor report's matching suggestion. Read-only —
 * the specialist request stays a mock confirm (no GROW debit; that is Phase 2B).
 *
 * Mount inside a `position: relative` container that wraps the plant visual.
 */
export function LiveScoutOverlay({
  playerId,
  plantId,
  flags,
}: {
  playerId: string;
  plantId: string;
  flags: ConditionFlag[];
}) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState<ScoutFinding | null>(null);

  const hasIssues = flags.some(
    (f) => f.condition !== "healthy" && f.condition !== "dead",
  );

  // Only consult the advisor when there's an actionable issue — a healthy plant
  // never triggers a (potentially metered) advisor call. Shares the advisor
  // cache key with AdvisorPanel, so a manual "Ask the grower" reuses this too.
  const advisor = useQuery({
    queryKey: queryKeys.advisor(plantId),
    queryFn: () => api.advisor.get(playerId, plantId),
    enabled: !!playerId && hasIssues,
    staleTime: 60_000,
  });

  const findings = buildLiveFindings(flags, advisor.data);

  // Stagger the scouts in one after another (skipped under reduced motion).
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced) {
      setShown(findings.length);
      return;
    }
    setShown(0);
    const timers = findings.map((_, i) =>
      setTimeout(() => setShown((n) => Math.max(n, i + 1)), i * STAGGER_MS),
    );
    return () => timers.forEach(clearTimeout);
    // Re-run when the set of findings changes (condition ids), not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, findings.map((f) => f.id).join(",")]);

  if (!findings.length) return null;

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-20" aria-hidden={false}>
        {findings.slice(0, shown).map((f) => (
          <AgentBubble key={f.id} finding={f} reduced={reduced} onRequest={setActive} />
        ))}
      </div>
      <SpecialistModal
        finding={active}
        open={active !== null}
        onClose={() => setActive(null)}
      />
    </>
  );
}
