"use client";

import { use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { plantRender } from "@/lib/plantRender";
import { previewDev, seedForPlant } from "@/lib/chamber/morphology";
import { StatBars } from "@/components/plant/StatBars";
import { ConditionBadges } from "@/components/plant/ConditionBadges";
import { CareButtons } from "@/components/plant/CareButtons";
import { ConsumablesPanel } from "@/components/plant/ConsumablesPanel";
import { EventLog } from "@/components/plant/EventLog";
import { PlantMetrics } from "@/components/plant/PlantMetrics";
import { StageTimeline } from "@/components/plant/StageTimeline";
import { AdvisorPanel } from "@/components/plant/AdvisorPanel";
import { PlantActionCTA } from "@/components/plant/PlantActionCTA";
import { PlantReactionLayer } from "@/components/plant/PlantReactionLayer";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { nextPlantAction } from "@/lib/plantAction";
import { usePlantState } from "@/hooks/usePlantState";
import { useQaMilestones } from "@/hooks/useQaMilestones";
import { useStrainMap, usePods } from "@/hooks/queries";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { titleCase, num, dateTime } from "@/lib/format";

// Real per-strain plant render (canvas), same component the Command Center /
// Grow Chamber / plant cards use — replaces the old crude placeholder SVG.
// ssr:false (canvas) with no loading flash, matching the other call sites.
const GrowChamber = dynamic(
  () => import("@/components/viz/GrowChamber").then((m) => m.GrowChamber),
  { ssr: false, loading: () => null },
);

function PlantDetail({ plantId }: { plantId: string }) {
  const { playerId } = useSession();
  const { data: plant, isLoading, isError, error, refetch } = usePlantState(playerId!, plantId);
  const { map } = useStrainMap();
  const { data: pods } = usePods();
  // The dedicated events query is the source of truth for the full log; the
  // embedded plant.recent_events is only a first-paint fallback (below). Stop
  // polling once the plant can no longer produce events — a harvested/dead plant
  // is static, so a 10s poll would just be dead weight (mirrors usePlantState).
  const plantSettled = Boolean(plant && (!plant.is_alive || plant.harvested));
  const events = useQuery({
    queryKey: queryKeys.events(plantId),
    queryFn: () => api.plants.events(plantId, 50),
    refetchInterval: plantSettled ? false : 10_000,
  });
  // QA-only: toast on real state changes between polls so testing feels alive.
  useQaMilestones(plant, playerId);

  if (isLoading) return <LoadingBlock label="Loading plant…" />;
  if (isError || !plant)
    return (
      <div className="space-y-3">
        <ErrorState error={error} onRetry={() => refetch()} />
        <Link href="/dashboard" className="text-sm text-grow-300">
          ← Back to dashboard
        </Link>
      </div>
    );

  const strain = map.get(plant.strain_id);
  const pod = pods?.find((p) => p.id === plant.pod_id) ?? null;
  // Derive the canonical chamber-render inputs (morphology / bud DNA / nominal
  // grow day) so this view shows the SAME real plant as the chamber/command/card.
  const render = plantRender(plant, strain, pod ?? undefined);
  const dev = previewDev(render.liveNominalDay, render.flMid);
  // Reuse FP-3's canonical resolver to decide whether a sticky CTA is warranted —
  // when the plant is thriving (kind "none") we keep the thumb zone clear.
  const hasNextAction = nextPlantAction(plant, pod).kind !== "none";

  return (
    // Mobile bottom padding clears the sticky action bar (which floats above the
    // tab bar); removed at lg where the bar is hidden.
    <div className="space-y-4 pb-28 lg:pb-0">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-grow-300 hover:underline">
          ← Back to dashboard
        </Link>
        <div className="flex gap-2">
          <Link
            href="/dashboard"
            className="rounded-md border border-cyan-500/60 bg-cyan-600/30 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-600/50"
          >
            🛰 Command Center
          </Link>
          <Link
            href={`/dashboard/plants/${plantId}/chamber`}
            className="rounded-md border border-grow-500 bg-grow-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-grow-500"
          >
            🌿 Open Grow Chamber
          </Link>
        </div>
      </div>

      {/* Primary CTA — the one thing to do next, always obvious.
          Desktop: inline banner above the fold. Mobile: a sticky thumb-zone bar
          (below) keeps it reachable while scrolling, so the inline copy is
          desktop-only to avoid showing the same CTA twice. */}
      <div className="hidden lg:block">
        <PlantActionCTA plant={plant} pod={pod} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title={
              strain ? (
                <Link href={`/lab/strains/${strain.id}`} className="hover:text-grow-300">
                  {strain.name}
                </Link>
              ) : (
                "Plant"
              )
            }
            subtitle={`${titleCase(plant.growth_stage)} · ${num(plant.height, 1)} cm`}
          />
          <div className="relative h-56 w-full overflow-hidden rounded-lg bg-[#050b12]">
            <GrowChamber
              seed={seedForPlant(plantId)}
              day={render.liveNominalDay}
              stage={plant.growth_stage}
              morphology={render.morphology}
              silhouette={render.silhouette}
              dev={dev}
              budColor={render.budColor}
              budDna={render.budDna}
              climate={{
                fan: 45,
                temp: pod?.temperature ?? 24,
                hum: pod?.humidity ?? 50,
                co2: pod?.co2_level ?? 800,
              }}
              conditionFlags={plant.condition_flags}
              view="chamber"
            />
            {/* Care taps below make the plant itself react; arriving here via
                🔍 Inspect opens with a scanner sweep (auto). */}
            <PlantReactionLayer auto="inspect" />
          </div>
          <div className="mt-3">
            <ConditionBadges flags={plant.condition_flags} />
          </div>
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          {plant.forecast && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-300">Growth timeline</h3>
              <StageTimeline
                forecast={plant.forecast}
                harvested={plant.harvested}
                isAlive={plant.is_alive}
              />
            </div>
          )}
          {plant.metrics && (
            <div>
              <h3 className="instrument-label mb-2">Scientist readouts</h3>
              <PlantMetrics plant={plant} />
            </div>
          )}
          {/* Terminal plant (harvested/dead): live vitals + care taps read as a
              lie once nothing is actually growing — the AI advisor below still
              says so ("nothing to do"), but there was no button to act on that
              until PlantActionCTA above learned the "cleanup" kind. Swap the
              stat bars + care grid for a plain summary instead of hiding the
              real endgame numbers entirely. */}
          {plant.harvested || !plant.is_alive ? (
            <div className="rounded-lg border border-ink-700 bg-ink-900/40 p-3 text-sm text-gray-400">
              {plant.harvested
                ? "Harvested — this grow is complete. Use the Clean & recycle action above to free this pod for a new seed."
                : "This plant didn't survive. Use the Clean & recycle action above to free this pod for a new seed."}
            </div>
          ) : (
            <>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Vitals</h3>
                <StatBars plant={plant} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Care</h3>
                <CareButtons plant={plant} />
              </div>
              {/* Owned consumables — "use item", the missing half of the store
                  loop. Renders nothing when the player owns none. */}
              <ConsumablesPanel plant={plant} />
            </>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
            <span>Planted: {dateTime(plant.planted_at)}</span>
            <span>Alive: {plant.is_alive ? "yes" : "no"}</span>
            <span>Pod: {plant.pod_id.slice(0, 8)}…</span>
            <span>Plant ID: {plant.id.slice(0, 8)}…</span>
          </div>
        </Card>
      </div>

      <div data-onboarding="plant-suggestions">
        <AdvisorPanel plantId={plant.id} />
      </div>

      <Card id="journal" className="scroll-mt-4">
        <CardHeader title="Event log" subtitle="Stage changes, stress onsets and care actions" />
        {events.isLoading ? (
          <LoadingBlock />
        ) : (
          <EventLog events={events.data ?? plant.recent_events} />
        )}
      </Card>

      {/* Mobile: the next action, always within thumb reach while scrolling. */}
      {hasNextAction && (
        <StickyActionBar>
          <PlantActionCTA plant={plant} pod={pod} />
        </StickyActionBar>
      )}
    </div>
  );
}

export default function PlantPage({ params }: { params: Promise<{ plantId: string }> }) {
  const { plantId } = use(params);
  return (
    <RequireAuth>
      <PlantDetail plantId={plantId} />
    </RequireAuth>
  );
}
