"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { UrgencyPill } from "@/components/ui/Pills";
import { PlantVisual } from "@/components/plant/PlantVisual";
import { StatBars } from "@/components/plant/StatBars";
import { useApiMutation } from "@/hooks/useApiMutation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { titleCase } from "@/lib/format";
import type { FtueStep } from "@/lib/types";

// The actionable steps, in order (the terminal "completed" is not a button).
const STEP_FLOW: FtueStep[] = ["welcome", "plant", "water", "environment", "grow", "harvest"];

const ACTION_LABEL: Record<FtueStep, string> = {
  welcome: "Let's grow 🌱",
  plant: "🌱 Plant my seed",
  water: "💧 Water it",
  environment: "🌡️ Dial in the climate",
  grow: "⏩ Grow it out",
  harvest: "✂️ Harvest & sell",
  completed: "Enter the game →",
};

function FtueInner() {
  const { playerId } = useSession();
  const router = useRouter();

  const statusQ = useQuery({
    queryKey: queryKeys.ftueStatus(playerId!),
    queryFn: () => api.ftue.status(playerId!),
    enabled: !!playerId,
  });
  const step = statusQ.data?.step;
  const plantId = statusQ.data?.plant_id ?? null;

  const coachingQ = useQuery({
    queryKey: queryKeys.ftueCoaching(playerId!, step ?? ""),
    queryFn: () => api.ftue.coaching(playerId!, step!),
    enabled: !!playerId && !!step,
    staleTime: Infinity, // scripted — a step's coaching never changes
  });

  const plantQ = useQuery({
    queryKey: queryKeys.plant(plantId ?? ""),
    queryFn: () => api.plants.state(playerId!, plantId!),
    enabled: !!playerId && !!plantId,
  });

  const advance = useApiMutation(() => api.ftue.advance(playerId!, step!), {
    invalidate: [
      queryKeys.ftueStatus(playerId!),
      queryKeys.plants(playerId!),
      queryKeys.wallet(playerId!),
      ...(plantId ? [queryKeys.plant(plantId)] : []),
    ],
  });

  if (statusQ.isLoading || !step) return <LoadingBlock label="Loading your first grow…" />;

  const done = step === "completed";
  const idx = STEP_FLOW.indexOf(step);
  const report = coachingQ.data;
  const plant = plantQ.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow={done ? "TUTORIAL COMPLETE" : `MASTER GROWER · STEP ${idx + 1} OF ${STEP_FLOW.length}`}
        title={done ? "Your first harvest is in 🏆" : "Your First Grow"}
        subtitle="Your Master Grower walks you through the whole loop — plant, care, grow, harvest, sell."
      />

      {/* Progress rail */}
      <div className="flex gap-1.5" aria-hidden>
        {STEP_FLOW.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${i <= idx || done ? "bg-grow-500" : "bg-ink-700"}`}
          />
        ))}
      </div>

      {/* The Master Grower's scripted coaching for this step */}
      <Card>
        <CardHeader title="🌿 Master Grower" subtitle={report?.summary} />
        {report ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-gray-300">{report.diagnosis}</p>
            {report.suggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-md border border-ink-600 bg-ink-900 p-3"
              >
                <UrgencyPill urgency={s.urgency} />
                <div>
                  <div className="text-sm font-medium text-gray-100">{titleCase(s.action)}</div>
                  <div className="text-xs text-gray-400">{s.reason}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <LoadingBlock label="Your coach is thinking…" />
        )}
      </Card>

      {/* The tutorial plant, once it's in the ground */}
      {plant && (
        <Card>
          <CardHeader title="Your plant" subtitle={titleCase(plant.growth_stage)} />
          <div className="flex items-center gap-4">
            <PlantVisual stage={plant.growth_stage} flags={plant.condition_flags ?? []} size={150} />
            <div className="flex-1">
              <StatBars plant={plant} />
            </div>
          </div>
        </Card>
      )}

      {/* The single guided action */}
      <div className="flex items-center justify-between">
        {done ? (
          <Button size="md" onClick={() => router.push("/dashboard")}>
            {ACTION_LABEL.completed}
          </Button>
        ) : (
          <Button size="md" loading={advance.isPending} onClick={() => advance.mutate()}>
            {ACTION_LABEL[step]}
          </Button>
        )}
        {!done && (
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            Skip tutorial
          </button>
        )}
      </div>
    </div>
  );
}

export default function FtuePage() {
  return (
    <RequireAuth>
      <FtueInner />
    </RequireAuth>
  );
}
