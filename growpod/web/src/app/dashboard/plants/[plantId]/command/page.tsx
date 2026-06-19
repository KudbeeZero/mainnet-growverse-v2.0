"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { usePlantState } from "@/hooks/usePlantState";
import { usePods, useStrainMap } from "@/hooks/queries";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import type { Environment } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { clamp, cycleDays, previewDev, seedForPlant, stageForDay } from "@/lib/chamber/morphology";
import { STAGE_ORDER } from "@/lib/stageInfo";
import { plantRender } from "@/lib/plantRender";
import { podStatus } from "@/lib/podStatus";
import { CommandTopBar } from "@/components/command/CommandTopBar";
import { FleetCounters } from "@/components/command/FleetCounters";
import { StageProgressBar } from "@/components/command/StageProgressBar";
import { HeroStatChips, PodStatusTag, StageHeader } from "@/components/command/HeroParts";
import { PlantDnaRail } from "@/components/command/PlantDnaRail";
import { EnvironmentRail } from "@/components/command/EnvironmentRail";
import { GrowConsole } from "@/components/plant/GrowConsole";
import { TimeControls } from "@/components/command/TimeControls";
import { CommandActionBar } from "@/components/command/CommandActionBar";
import { CommandFooter } from "@/components/command/CommandFooter";

const GrowChamber = dynamic(
  () => import("@/components/viz/GrowChamber").then((m) => m.GrowChamber),
  { ssr: false, loading: () => null },
);

const DEFAULT_CLIMATE: Environment = {
  temperature: 24,
  humidity: 50,
  co2_level: 800,
  light_intensity: 600,
  ph_level: 6.5,
};

const COMMIT_DEBOUNCE_MS = 700;

function CommandScreen({ plantId }: { plantId: string }) {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: plant, isLoading, isError, error, refetch } = usePlantState(playerId!, plantId);
  const { map } = useStrainMap();
  const { data: pods } = usePods();

  const [climate, setClimate] = useState<Environment>(DEFAULT_CLIMATE);
  const [previewDay, setPreviewDay] = useState<number | null>(null);

  const pod = pods?.find((p) => p.id === plant?.pod_id);

  // Seed the climate controls from the pod's real environment, once.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !pod) return;
    seededRef.current = true;
    setClimate((c) => ({
      temperature: pod.temperature ?? c.temperature,
      humidity: pod.humidity ?? c.humidity,
      co2_level: pod.co2_level ?? c.co2_level,
      light_intensity: pod.light_intensity ?? c.light_intensity,
      ph_level: pod.ph_level ?? c.ph_level,
    }));
  }, [pod]);

  const setEnv = useMutation<unknown, ApiError, Environment>({
    mutationFn: (env) => api.pods.setEnvironment(playerId!, plant!.pod_id, env),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pods(playerId!) });
      qc.invalidateQueries({ queryKey: queryKeys.plant(plantId) });
    },
    onError: (e) => toast.error(e.message),
  });

  // Debounced commit: coalesce a slider drag into one persisted write.
  const commitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleCommit(next: Environment) {
    if (commitRef.current) clearTimeout(commitRef.current);
    commitRef.current = setTimeout(() => setEnv.mutate(next), COMMIT_DEBOUNCE_MS);
  }
  useEffect(
    () => () => {
      if (commitRef.current) clearTimeout(commitRef.current);
    },
    [],
  );

  function onSlide(field: keyof Environment, value: number) {
    setClimate((c) => {
      const next = { ...c, [field]: value };
      scheduleCommit(next);
      return next;
    });
  }

  if (isLoading) return <LoadingBlock label="Booting command center…" />;
  if (isError || !plant)
    return (
      <div className="space-y-3 p-6">
        <ErrorState error={error} onRetry={() => refetch()} />
        <Link href="/dashboard" className="text-sm text-grow-300">
          ← Back to dashboard
        </Link>
      </div>
    );

  const strain = map.get(plant.strain_id);
  const render = plantRender(plant, strain, pod);

  const previewing = previewDay !== null;
  const day = previewing ? previewDay : render.liveNominalDay;
  const renderStage = previewing ? stageForDay(day, render.flMid) : plant.growth_stage;
  const dev = previewing
    ? previewDev(day, render.flMid)
    : previewDev(render.liveNominalDay, render.flMid);
  const maxPreviewDay = Math.round(cycleDays(render.flMid) + 8);

  const stageIndex = plant.forecast?.stage_index ?? STAGE_ORDER.indexOf(plant.growth_stage);
  const status = podStatus(pod, plant);
  const health = clamp(plant.health, 0, 100);
  const ended = !plant.is_alive || plant.harvested;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#050b12] text-[#cfeeff]">
      <CommandTopBar
        plantId={plantId}
        playerId={playerId!}
        pod={pod}
        pods={pods}
        day={render.liveNominalDay}
      />

      {/* header band: counters (left) · stage header (center) · stat chips (right) */}
      <div className="flex-none px-4 py-2">
        <div className="flex items-start justify-between gap-3">
          <FleetCounters />
          <div className="hidden xl:block">
            <HeroStatChips forecast={plant.forecast} rarity={strain?.rarity} />
          </div>
        </div>
        <div className="mt-1 flex flex-col items-center gap-1.5">
          <StageHeader
            name={strain?.name ?? "Plant"}
            stage={renderStage}
            day={day}
            previewing={previewing}
          />
          <div className="w-full max-w-lg">
            <StageProgressBar index={stageIndex} />
          </div>
        </div>
      </div>

      {/* main 3-rail grid (collapses to a single scrolling column below xl) */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        <div className="grid gap-3 xl:h-full xl:grid-cols-[300px_1fr_320px]">
          {/* center: chamber + time controls (first in DOM so it leads on mobile) */}
          <div className="flex min-h-0 flex-col gap-2 xl:col-start-2 xl:row-start-1">
            <div className="relative min-h-[46vh] flex-1 overflow-hidden rounded-2xl border border-cyan-400/15">
              <GrowChamber
                seed={seedForPlant(plantId)}
                day={day}
                stage={renderStage}
                morphology={render.morphology}
                silhouette={render.silhouette}
                dev={dev}
                budColor={render.budColor}
                budDna={render.budDna}
                climate={{
                  fan: 45,
                  temp: climate.temperature,
                  hum: climate.humidity,
                  co2: climate.co2_level,
                }}
                conditionFlags={plant.condition_flags}
                view="chamber"
              />
              <div className="absolute left-3 top-3">
                <PodStatusTag status={status} />
              </div>
              <div className="absolute right-3 top-3 xl:hidden">
                <HeroStatChips forecast={plant.forecast} rarity={strain?.rarity} />
              </div>
              {/* health meter */}
              <div className="pointer-events-none absolute inset-x-3 bottom-2 h-[5px] overflow-hidden rounded-full bg-[#11212e]">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${health}%`,
                    background: "linear-gradient(90deg,#e88a5c,#62d99a)",
                    opacity: health < 60 ? 1 : 0.7,
                  }}
                />
              </div>
              {ended && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#050b12]/85 text-center">
                  <div className="text-4xl">{plant.harvested ? "🌾" : "🥀"}</div>
                  <p className="text-lg font-bold text-grow-200">
                    {plant.harvested ? "Harvest complete!" : "This plant has died"}
                  </p>
                  <Link href="/dashboard" className="text-sm text-grow-300 hover:underline">
                    ← Back to dashboard
                  </Link>
                </div>
              )}
            </div>
            <TimeControls
              forecast={plant.forecast}
              previewing={previewing}
              previewDay={previewDay ?? render.liveNominalDay}
              liveNominalDay={render.liveNominalDay}
              maxPreviewDay={maxPreviewDay}
              onPreview={(d) => setPreviewDay(d)}
              onLive={() => setPreviewDay(null)}
            />
          </div>

          {/* left rail */}
          <div className="min-h-0 xl:col-start-1 xl:row-start-1 xl:overflow-y-auto">
            <PlantDnaRail strain={strain} plantId={plantId} stage={renderStage} />
          </div>

          {/* right rail: environment controls + read-only grow console */}
          <div className="flex min-h-0 flex-col gap-3 xl:col-start-3 xl:row-start-1 xl:overflow-y-auto">
            <EnvironmentRail
              climate={climate}
              plant={plant}
              pod={pod}
              disabled={ended}
              onSlide={onSlide}
            />
            <GrowConsole plant={plant} pod={pod} />
          </div>
        </div>
      </div>

      <div className="flex-none px-4 py-2">
        <CommandActionBar plant={plant} />
      </div>

      <CommandFooter plant={plant} pod={pod} />
    </div>
  );
}

export default function CommandPage({ params }: { params: Promise<{ plantId: string }> }) {
  const { plantId } = use(params);
  return (
    <RequireAuth>
      <CommandScreen plantId={plantId} />
    </RequireAuth>
  );
}
