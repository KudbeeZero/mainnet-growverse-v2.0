"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { UrgencyPill } from "@/components/ui/Pills";
import { PlantVisual } from "@/components/plant/PlantVisual";
import { StatBars } from "@/components/plant/StatBars";
import { useCareFeedback } from "@/components/plant/CareFeedback";
import { useApiMutation } from "@/hooks/useApiMutation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useOnboardingStore } from "@/lib/onboarding/onboardingStore";
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

// One punchy line the Master Grower says as you land each step — a quick hit of
// personality + momentum so the tutorial feels like a coach hyping you up, not a
// form to click through (owner: "not very exciting").
const STEP_HYPE: Record<FtueStep, string> = {
  welcome: "Welcome, grower. I'm your Master Grower — I'll get you to your first harvest in about a minute.",
  plant: "Drop your first seed. This is where every legend starts.",
  water: "She's thirsty — give her a drink and watch her perk up.",
  environment: "Dial the climate in and the whole grow speeds up. Pro move.",
  grow: "Now we let her run. Watch those buds stack up.",
  harvest: "Buds are frosted and ready. Cut it, cash it — you just closed the loop.",
  completed: "That's the whole game. Go run it back on your own terms.",
};

function FtueInner() {
  const { playerId } = useSession();
  const router = useRouter();
  const markCompleted = useOnboardingStore((s) => s.markCompleted);

  // Leaving the first-grow tutorial — whether you finished it or skipped it —
  // also marks the dashboard guided tour complete, so the two onboarding layers
  // never stack (the #1 "18 prompts every time" complaint). One click → done.
  const leaveFtue = () => {
    if (playerId) markCompleted(playerId);
    router.push("/dashboard");
  };

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

  const { fire, layer } = useCareFeedback();

  const advance = useApiMutation(() => api.ftue.advance(playerId!, step!), {
    invalidate: [
      queryKeys.ftueStatus(playerId!),
      queryKeys.plants(playerId!),
      queryKeys.wallet(playerId!),
      ...(plantId ? [queryKeys.plant(plantId)] : []),
    ],
  });

  // Fire the same delight burst the real care buttons use the instant a step is
  // tapped — the tutorial should feel as rewarding as the game it's teaching.
  const advanceStep = () => {
    fire("boost");
    advance.mutate();
  };

  if (statusQ.isError) {
    return (
      <div className="mx-auto max-w-md py-10">
        <ErrorState error={statusQ.error} onRetry={() => statusQ.refetch()} />
      </div>
    );
  }
  if (statusQ.isLoading || !step) return <LoadingBlock label="Loading your first grow…" />;

  const done = step === "completed";
  const idx = STEP_FLOW.indexOf(step);
  const report = coachingQ.data;
  const plant = plantQ.data;

  return (
    <div className="relative mx-auto max-w-2xl space-y-5">
      {/* Delight burst layer (absolutely positioned, matches the game's care taps) */}
      {layer}

      <PageHeader
        eyebrow={done ? "TUTORIAL COMPLETE" : `YOUR FIRST GROW · STEP ${idx + 1} OF ${STEP_FLOW.length}`}
        title={done ? "Your first harvest is in 🏆" : "Your First Grow"}
        subtitle="One minute, start to harvest — your Master Grower has you the whole way."
      />

      {/* Progress rail — the current step glows so momentum is obvious. */}
      <div className="flex gap-1.5" aria-hidden>
        {STEP_FLOW.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < idx || done ? "bg-grow-600" : i === idx ? "bg-grow-400 shadow-glow-grow" : "bg-ink-700"
            }`}
          />
        ))}
      </div>

      {/* The Master Grower, as a character — avatar + speech bubble, so the
          tutorial reads as a coach talking to you, not a form. */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-grow-500/50 bg-grow-950/60 text-2xl shadow-glow-grow">
          🤖
        </div>
        <div className="relative flex-1 rounded-2xl rounded-tl-sm border border-grow-500/30 bg-[#0b1b12]/70 p-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-grow-300">
            Master Grower
          </div>
          <p className="text-sm font-medium leading-relaxed text-gray-100">{STEP_HYPE[step]}</p>
          {report && (
            <>
              {report.diagnosis && (
                <p className="mt-2 text-xs leading-relaxed text-gray-400">{report.diagnosis}</p>
              )}
              {report.suggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {report.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-lg border border-ink-700 bg-ink-900/70 p-2.5">
                      <UrgencyPill urgency={s.urgency} />
                      <div>
                        <div className="text-xs font-medium text-gray-100">{titleCase(s.action)}</div>
                        <div className="text-[11px] text-gray-400">{s.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

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

      {/* The single guided action — big, primary, one obvious thing to do. */}
      <div className="flex items-center justify-between gap-3">
        {done ? (
          <Button size="md" onClick={leaveFtue}>
            {ACTION_LABEL.completed}
          </Button>
        ) : (
          <Button size="md" loading={advance.isPending} onClick={advanceStep}>
            {ACTION_LABEL[step]}
          </Button>
        )}
        {!done && (
          <button
            type="button"
            onClick={leaveFtue}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-300"
          >
            Skip →
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
