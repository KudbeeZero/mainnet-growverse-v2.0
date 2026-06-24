"use client";

// The single-screen pod command center. You log in, you see your pod, and you
// run EVERYTHING from here: the center is a carousel of up to four plant
// cylinders, and selecting one repopulates the DNA rail, environment rail, grow
// console, time controls and the seven-action care bar for that plant — without
// ever navigating to another page. This is the embedded (in-dashboard) view; it
// owns the active-plant selection in local state, not a route param.

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingBlock } from "@/components/ui/Spinner";
import { usePlantState } from "@/hooks/usePlantState";
import { useTurbo } from "@/hooks/useTurbo";
import { useStrainMap } from "@/hooks/queries";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { describeApiError, shouldRetryApiError } from "@/lib/apiError";
import type { Environment } from "@/lib/api";
import type { Plant, Pod } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";
import { clamp, previewDev, seedForPlant } from "@/lib/chamber/morphology";
import { maxPreviewDay, resolvePreview } from "@/lib/chamber/growthPreview";
import { STAGE_ORDER } from "@/lib/stageInfo";
import { plantRender } from "@/lib/plantRender";
import { podStatus } from "@/lib/podStatus";
import { timeControlsGate } from "@/lib/timeControls";
import { FleetCounters } from "@/components/command/FleetCounters";
import { ConnectivityBadge } from "@/components/command/ConnectivityBadge";
import { StageProgressBar } from "@/components/command/StageProgressBar";
import { HeroStatChips, PodStatusTag, StageHeader } from "@/components/command/HeroParts";
import { PlantDnaRail } from "@/components/command/PlantDnaRail";
import { EnvironmentRail } from "@/components/command/EnvironmentRail";
import { GrowConsole } from "@/components/plant/GrowConsole";
import { TimeControls } from "@/components/command/TimeControls";
import { CommandActionBar } from "@/components/command/CommandActionBar";
import { PlantCarousel, type CarouselPlant } from "@/components/command/PlantCarousel";
import { GrowthScrubber } from "@/components/command/GrowthScrubber";
import { PlantSeedForm } from "@/components/plant/PlantSeedForm";

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

/** Pick the plant that should lead when the pod opens: first living plant,
 *  else the first plant (so a fully-harvested pod still shows something). */
function defaultPlantId(plants: Plant[]): string | undefined {
  const live = plants.find((p) => p.is_alive && !p.harvested);
  return (live ?? plants[0])?.id;
}

export function PodCommandCenter({ pod, plants }: { pod: Pod; plants: Plant[] }) {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const { map } = useStrainMap();
  const {
    enabled: turboOn,
    multiplier: turboX,
    isToggling: turboToggling,
    toggle: toggleTurbo,
  } = useTurbo(playerId);

  // Up to four plants per pod (the current cap). Active selection is local —
  // switching plants never leaves the screen.
  const ring = useMemo(() => plants.slice(0, 4), [plants]);
  const [activeId, setActiveId] = useState<string | undefined>(() => defaultPlantId(ring));

  // Growth-preview scrubber position (null = track the live server age). Reset
  // whenever the active plant changes so a scrubbed day never bleeds across pods.
  const [previewDay, setPreviewDay] = useState<number | null>(null);
  useEffect(() => {
    setPreviewDay(null);
  }, [activeId]);

  // Keep the selection valid as the pod's plants change (harvest, switch pod).
  useEffect(() => {
    if (!activeId || !ring.some((p) => p.id === activeId)) {
      setActiveId(defaultPlantId(ring));
    }
  }, [ring, activeId]);

  const { data: plant, isLoading } = usePlantState(playerId!, activeId ?? "", !!activeId);

  const [climate, setClimate] = useState<Environment>(DEFAULT_CLIMATE);

  // Seed the climate controls from the pod's real environment, once per pod.
  const seededPodRef = useRef<string | null>(null);
  useEffect(() => {
    if (seededPodRef.current === pod.id) return;
    seededPodRef.current = pod.id;
    setClimate((c) => ({
      temperature: pod.temperature ?? c.temperature,
      humidity: pod.humidity ?? c.humidity,
      co2_level: pod.co2_level ?? c.co2_level,
      light_intensity: pod.light_intensity ?? c.light_intensity,
      ph_level: pod.ph_level ?? c.ph_level,
    }));
  }, [pod]);

  // ACCELERATE TIME (+1h/+6h/+1d) — really fast-forwards the active plant's grow
  // clock (server-authoritative, deterministic recompute).
  const advance = useMutation<unknown, ApiError, number>({
    mutationFn: (h) => api.plants.advance(playerId!, activeId!, h),
    // Self-heal a cold/sleeping backend so the first time-jump still lands.
    retry: (count, err) => shouldRetryApiError(count, err),
    onSuccess: () => {
      if (!activeId) return;
      qc.invalidateQueries({ queryKey: queryKeys.plant(activeId) });
      qc.invalidateQueries({ queryKey: queryKeys.events(activeId) });
      if (playerId) qc.invalidateQueries({ queryKey: queryKeys.plants(playerId) });
    },
    onError: (e) => toast.error(describeApiError(e)),
  });

  const setEnv = useMutation<unknown, ApiError, Environment>({
    mutationFn: (env) => api.pods.setEnvironment(playerId!, pod.id, env),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pods(playerId!) });
      // Climate is pod-wide → refresh every plant in the pod + the dashboard list.
      qc.invalidateQueries({ queryKey: ["plant"] });
      if (playerId) qc.invalidateQueries({ queryKey: queryKeys.plants(playerId) });
    },
    onError: (e) => toast.error(describeApiError(e)),
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

  // Carousel cylinders (cheap thumbnails from the list data).
  const carousel: CarouselPlant[] = ring.map((p) => ({
    id: p.id,
    label: map.get(p.strain_id)?.name ?? "Plant",
    stage: p.growth_stage,
    flags: p.condition_flags,
    ended: !p.is_alive || p.harvested,
  }));

  // Open planting slots — one pod holds up to four plants (the current cap).
  const slotCap = Math.min(4, pod.capacity || 4);
  const openSlots = Math.max(0, slotCap - ring.length);

  // Empty pod: plant the first seed right here, no detour to the Lab.
  if (!activeId) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-cyan-400/15 bg-[#070f17] p-8 text-center">
        <div className="text-4xl">🌱</div>
        <p className="text-sm text-cyan-200/80">
          {pod.name} is empty — plant your first seed to start the grow.
        </p>
        <PlantSeedForm podId={pod.id} />
      </div>
    );
  }

  const strain = plant ? map.get(plant.strain_id) : undefined;
  const render = plant ? plantRender(plant, strain, pod) : null;
  const flMid = render?.flMid ?? 60;
  const liveDay = render?.liveNominalDay ?? 0;
  // Growth-preview scrubber: drag through the lifecycle (client-only visual);
  // null = track the real server age. Never mutates server state.
  const preview = resolvePreview(previewDay, liveDay, flMid, plant?.growth_stage ?? "seed");
  const day = preview.day;
  const renderStage = preview.stage;
  const stageIndex =
    plant?.forecast?.stage_index ?? (plant ? STAGE_ORDER.indexOf(plant.growth_stage) : 0);
  const status = plant ? podStatus(pod, plant) : null;
  const health = plant ? clamp(plant.health, 0, 100) : 0;
  const ended = plant ? !plant.is_alive || plant.harvested : false;
  const timeGate = timeControlsGate(plant, isLoading);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-cyan-400/15 bg-[#050b12] p-3 text-[#cfeeff]">
      {/* header band: counters (left) · stage header (center) · stat chips (right) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col items-start gap-1.5">
          <FleetCounters />
          <ConnectivityBadge />
        </div>
        {plant && (
          <div className="hidden xl:block">
            <HeroStatChips forecast={plant.forecast} rarity={strain?.rarity} />
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <StageHeader name={strain?.name ?? "Plant"} stage={renderStage} day={day} previewing={preview.previewing} />
        <div className="w-full max-w-lg">
          <StageProgressBar index={stageIndex} />
        </div>
      </div>

      {/* main 3-rail grid (collapses to a single scrolling column below xl) */}
      <div className="grid gap-3 xl:grid-cols-[300px_1fr_320px]">
        {/* center: carousel + chamber + time controls (first in DOM → leads on mobile) */}
        <div className="flex min-h-0 flex-col gap-2 xl:col-start-2 xl:row-start-1">
          <PlantCarousel plants={carousel} activeId={activeId} onSelect={setActiveId} />

          {openSlots > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-cyan-400/15 bg-[#0b1b27]/50 px-3 py-2">
              <span className="instrument-label text-[9px]">
                + PLANT A SEED · {openSlots} slot{openSlots > 1 ? "s" : ""} open
              </span>
              <PlantSeedForm podId={pod.id} />
            </div>
          )}

          <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-2xl border border-cyan-400/15 xl:min-h-[42vh]">
            {isLoading || !plant || !render ? (
              <LoadingBlock label="Loading plant…" />
            ) : (
              <>
                <GrowChamber
                  seed={seedForPlant(plant.id)}
                  day={day}
                  stage={renderStage}
                  morphology={render.morphology}
                  silhouette={render.silhouette}
                  dev={previewDev(day, render.flMid)}
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
                {/* glass grow-tube framing — grow-light glow up top, a glass
                    reflection down the left, and a soft cyan inner glow so the
                    center reads as a lit chamber (purely cosmetic, no clicks) */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    boxShadow:
                      "inset 0 0 70px rgba(80,200,255,0.10), inset 0 0 0 1px rgba(140,210,255,0.10)",
                  }}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-2xl bg-gradient-to-b from-cyan-200/20 to-transparent" />
                <span className="pointer-events-none absolute bottom-8 left-3 top-8 w-2.5 rounded-full bg-white/10 blur-md" />
                {status && (
                  <div className="absolute left-3 top-3">
                    <PodStatusTag status={status} />
                  </div>
                )}
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
                {ended && !preview.previewing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#050b12]/85 text-center">
                    <div className="text-4xl">{plant.harvested ? "🌾" : "🥀"}</div>
                    <p className="text-lg font-bold text-grow-200">
                      {plant.harvested ? "Harvest complete!" : "This plant has died"}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <TimeControls
            forecast={plant?.forecast}
            turboOn={turboOn}
            turboX={turboX}
            onAdvanceHours={(h) => advance.mutate(h)}
            advancing={advance.isPending}
            disabled={timeGate.disabled}
            disabledReason={timeGate.reason}
            onToggleTurbo={() => toggleTurbo(!turboOn)}
            turboToggling={turboToggling}
          />

          {/* Client-only growth preview — scrub forward/back through the whole
              lifecycle. Works with no backend (unlike server ACCELERATE TIME). */}
          {plant && render && (
            <GrowthScrubber
              day={day}
              maxDay={maxPreviewDay(flMid)}
              stageLabel={renderStage}
              previewing={preview.previewing}
              onScrub={setPreviewDay}
              onReset={() => setPreviewDay(null)}
            />
          )}

          {/* On mobile the stat chips sit in a clean row under the time strip
              (on desktop they live in the header band) — never over the plant. */}
          {plant && (
            <div className="xl:hidden">
              <HeroStatChips forecast={plant.forecast} rarity={strain?.rarity} />
            </div>
          )}
        </div>

        {/* left rail */}
        <div className="min-h-0 xl:col-start-1 xl:row-start-1">
          <PlantDnaRail strain={strain} plantId={activeId} stage={renderStage} />
        </div>

        {/* right rail: environment controls + read-only grow console */}
        <div className="flex min-h-0 flex-col gap-3 xl:col-start-3 xl:row-start-1">
          {plant && (
            <EnvironmentRail
              climate={climate}
              plant={plant}
              pod={pod}
              disabled={ended}
              onSlide={onSlide}
            />
          )}
          {plant && <GrowConsole plant={plant} pod={pod} />}
        </div>
      </div>

      {plant && <CommandActionBar plant={plant} />}
    </div>
  );
}
