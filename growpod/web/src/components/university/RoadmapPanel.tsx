"use client";

// Phase 6e — the learner's roadmap: a prominent "Next lesson" plus the per-day
// study path, with a 7/14-day horizon toggle. READ-ONLY and NON-economic — it
// renders the deterministic, prerequisite-respecting plan the backend builds.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/States";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/lib/session";
import { titleCase } from "@/lib/format";
import { nextLesson, groupStepsByDay } from "@/lib/university/learnerPath";
import type { RoadmapStep } from "@/lib/types";

function StepRow({ step, lead = false }: { step: RoadmapStep; lead?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        lead
          ? "border-grow-600 bg-grow-950/50"
          : "border-ink-600 bg-ink-800"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-medium ${lead ? "text-grow-100" : "text-gray-100"}`}>
          {step.name}
        </span>
        <span className="instrument-label">{titleCase(step.domain || "general")}</span>
      </div>
      {step.prerequisites.length > 0 && (
        <div className="mt-0.5 text-xs text-gray-500">
          Builds on {step.prerequisites.length} prior skill
          {step.prerequisites.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

export function RoadmapPanel() {
  const { playerId } = useSession();
  const [horizon, setHorizon] = useState<7 | 14>(7);

  const q = useQuery({
    queryKey: queryKeys.roadmap(playerId ?? "", horizon),
    queryFn: () => api.university.roadmap(playerId!, horizon),
    enabled: !!playerId,
    staleTime: 30_000,
  });

  const horizonToggle = (
    <div className="flex gap-1">
      {([7, 14] as const).map((h) => (
        <Button
          key={h}
          size="sm"
          variant={horizon === h ? "primary" : "secondary"}
          onClick={() => setHorizon(h)}
        >
          {h}-day
        </Button>
      ))}
    </div>
  );

  if (q.isLoading) {
    return (
      <Card>
        <LoadingBlock label="Building your learning path…" />
      </Card>
    );
  }

  // A 404 here means the centralized model has no plan yet / feature off — show a
  // tasteful empty state rather than an error (the page handles flag-off too).
  if (q.isError || !q.data) {
    const notReady = q.error instanceof ApiError && q.error.status === 404;
    return (
      <Card>
        <CardHeader title="Your learning path" />
        <EmptyState
          icon="🧭"
          title={notReady ? "No path yet" : "Couldn't load your path"}
          hint={
            notReady
              ? "Take the intake quiz above to get a personalized, day-by-day study path."
              : "Try again in a moment."
          }
        />
      </Card>
    );
  }

  const plan = q.data;
  const lead = nextLesson(plan);
  const days = groupStepsByDay(plan);
  // Defensive (matches nextLesson/groupStepsByDay above): a truthy-but-malformed
  // roadmap response (e.g. an empty array from a 200 with no plan yet) has no
  // skipped_mastered field — reading .length on undefined white-screened the
  // whole learner dashboard.
  const masteredCount = plan.skipped_mastered?.length ?? 0;

  return (
    <Card className="space-y-4">
      <CardHeader
        title="Your learning path"
        subtitle={`${plan.horizon_days}-day path · prerequisite-ordered`}
        action={horizonToggle}
      />

      {lead ? (
        <div>
          <div className="instrument-label mb-1">▶ NEXT LESSON</div>
          <StepRow step={lead} lead />
        </div>
      ) : (
        <EmptyState
          icon="🎓"
          title="You're all caught up"
          hint="You've mastered every tracked skill in this path. Keep practicing to stay sharp."
        />
      )}

      {masteredCount > 0 && (
        <p className="rounded-lg border border-grow-700/60 bg-grow-950/40 px-3 py-1.5 text-xs text-grow-200">
          ✓ {masteredCount} skill{masteredCount === 1 ? "" : "s"} already mastered — skipped from your path.
        </p>
      )}

      {days.length > 0 && (
        <div className="space-y-3">
          {days.map(({ day, steps }) => (
            <div key={day} className="space-y-1.5">
              <div className="instrument-label">DAY {day}</div>
              <div className="space-y-1.5">
                {steps.map((s) => (
                  <StepRow key={s.skill_id} step={s} lead={s.skill_id === lead?.skill_id} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {plan.rationale && <p className="text-xs text-gray-500">{plan.rationale}</p>}
    </Card>
  );
}
