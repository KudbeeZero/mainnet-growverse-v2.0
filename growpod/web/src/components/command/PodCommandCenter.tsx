"use client";

// The single-screen pod command center. You log in, you see your pod, and you
// run EVERYTHING from here: a slot switcher picks among up to four plants in
// the pod, and selecting one repopulates the DNA rail, environment rail, grow
// console, time controls and the care bar for that plant — without ever
// navigating to another page. This is the embedded (in-dashboard) view; it
// owns the active-plant selection in local state, not a route param.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingBlock } from "@/components/ui/Spinner";
import { usePlantState } from "@/hooks/usePlantState";
import { useStrainMap } from "@/hooks/queries";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import type { Environment } from "@/lib/api";
import type { Plant, Pod } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";
import { clamp, previewDev, seedForPlant } from "@/lib/chamber/morphology";
import {
  NO_FAN_BASELINE,
  fanVisualIntensity,
  gearChips,
  lightGlowIntensity,
  soilTint,
} from "@/lib/chamber/gearVisuals";
import { hasWebGL } from "@/lib/features";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { STAGE_ORDER } from "@/lib/stageInfo";
import { plantRender } from "@/lib/plantRender";
import { podStatus } from "@/lib/podStatus";
import { FleetCounters } from "@/components/command/FleetCounters";
import { ConnectivityBadge } from "@/components/command/ConnectivityBadge";
import { StageProgressBar } from "@/components/command/StageProgressBar";
import { HeroStatChips, PodStatusTag, StageHeader } from "@/components/command/HeroParts";
import { PlantDnaRail } from "@/components/command/PlantDnaRail";
import { EnvironmentRail } from "@/components/command/EnvironmentRail";
import { GrowConsole } from "@/components/plant/GrowConsole";
import { CareDeck } from "@/components/command/CareDeck";
import {
  ChamberPanel,
  PlantProgressStrip,
  EncouragementFooter,
} from "@/components/plant/ChamberDock";
import { PlantReactionLayer } from "@/components/plant/PlantReactionLayer";
import { PlantCarousel, type CarouselPlant } from "@/components/command/PlantCarousel";
import { TimeControls } from "@/components/command/TimeControls";
import { NextActionHint } from "@/components/command/NextActionHint";
import { StageInfoCard } from "@/components/command/StageInfoCard";
import { PlantActionCTA } from "@/components/plant/PlantActionCTA";
import { PlantSeedForm } from "@/components/plant/PlantSeedForm";

const GrowChamber = dynamic(
  () => import("@/components/viz/GrowChamber").then((m) => m.GrowChamber),
  { ssr: false, loading: () => null },
);

// The frosted 3D bud close-up (same pipeline as the strain hero / chamber macro),
// popped from the pod via the "View bud" toggle. Client-only (three.js).
const BudGL = dynamic(
  () => import("@/components/viz/BudGL").then((m) => m.BudGL),
  { ssr: false, loading: () => <LoadingBlock label="Frosting the bud…" /> },
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

  // Up to four plants per pod (the current cap). Active selection is local —
  // switching plants never leaves the screen.
  const ring = useMemo(() => plants.slice(0, 4), [plants]);
  const [activeId, setActiveId] = useState<string | undefined>(() => defaultPlantId(ring));

  // "View bud" — pop the frosted 3D bud close-up for the selected plant (whole-
  // plant view stays the default). Only when the device actually has WebGL.
  const reducedMotion = usePrefersReducedMotion();
  const [viewBud, setViewBud] = useState(false);
  const canViewBud = hasWebGL();

  // Mobile-only: the scientist panels (DNA/Traits/Morphology, Environment
  // sliders, Grow Console) stay collapsed by default so the plant hero + care
  // loop lead the scroll — desktop keeps them as always-visible side rails
  // (see the `xl:` overrides below). Collapsed state is per-mount, not
  // persisted — it's a declutter toggle, not a settings choice.
  const [showAdvanced, setShowAdvanced] = useState(false);

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
  const day = render?.liveNominalDay ?? 0;
  const renderStage = plant?.growth_stage ?? "seed";
  // Live development params for the bud close-up (same source the 2D chamber uses).
  const budDev = render ? previewDev(day, render.flMid) : null;
  const stageIndex =
    plant?.forecast?.stage_index ?? (plant ? STAGE_ORDER.indexOf(plant.growth_stage) : 0);
  const status = plant ? podStatus(pod, plant) : null;
  const health = plant ? clamp(plant.health, 0, 100) : 0;
  const ended = plant ? !plant.is_alive || plant.harvested : false;

  // Equipped-gear chamber visuals (ROADMAP_90D week 4, S4). A reduced-motion
  // user's canvas never gets MORE sway just because a strong fan is equipped —
  // it stays at the ambient baseline regardless of gear.
  const fanVisual = reducedMotion ? NO_FAN_BASELINE : fanVisualIntensity(pod.equipped_gear);
  const glowAlpha = lightGlowIntensity(pod.light_intensity);
  const gearChipList = gearChips(pod.equipped_gear);
  const podSoilTint = soilTint(pod.equipped_gear);

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
        <StageHeader name={strain?.name ?? "Plant"} stage={renderStage} day={day} />
        <div className="w-full max-w-lg">
          <StageProgressBar index={stageIndex} />
        </div>
        {/* Equipped-gear chips (icon + name) — what the store actually applied
            to this pod, from the gv-o02 serializer (S4). */}
        {gearChipList.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {gearChipList.map((chip) => (
              <span
                key={chip.key}
                title={chip.label}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/[0.05] px-2 py-0.5 text-[10px] text-cyan-100"
              >
                <span aria-hidden>{chip.icon}</span>
                <span className="max-w-[8rem] truncate">{chip.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* main 3-rail grid (collapses to a single scrolling column below xl).
          Rails widen on larger screens so the layout fills a desktop monitor
          instead of sitting in a narrow centered column. On mobile, every
          direct child of the center column carries an `order-N xl:order-none`
          pair: the CSS `order` reflows the VISUAL stack for phones (plant
          hero first, scientist detail last) while resetting to plain source
          order at `xl` — desktop's approved layout is untouched. */}
      <div className="grid gap-3 xl:grid-cols-[320px_1fr_340px] 2xl:grid-cols-[380px_1fr_420px] 2xl:gap-4">
        {/* center: carousel + chamber + time controls. Chamber leads on BOTH
            mobile (order-1) and desktop (xl:order-first) — the pod's actual
            plant view is the reason the page exists, so its top edge lines up
            with the side rails' top edge instead of sitting below the
            carousel thumbnail + "plant a seed" bar (owner feedback
            2026-07-07: the plant view "didn't look right" sitting lower than
            the side rails on desktop). `order-first` (order:-9999) only pulls
            the chamber ahead — every sibling below keeps its existing
            `xl:order-none` (order:0), so their relative order to EACH OTHER
            is unchanged; only the chamber jumps to the front. */}
        <div className="flex min-h-0 flex-col gap-2 xl:col-start-2 xl:row-start-1">
          <div className="order-3 xl:order-none">
            <PlantCarousel plants={carousel} activeId={activeId} onSelect={setActiveId} />
          </div>

          {openSlots > 0 && (
            <div className="order-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-cyan-400/15 bg-[#0b1b27]/50 px-3 py-2 xl:order-none">
              <span className="instrument-label text-[9px]">
                + PLANT A SEED · {openSlots} slot{openSlots > 1 ? "s" : ""} open
              </span>
              <PlantSeedForm podId={pod.id} />
            </div>
          )}

          {/* Plant hero — first thing on mobile (order-1) and noticeably
              larger there (55vh) so it reads as the game, not a buried
              thumbnail; desktop pulls it to the very front (xl:order-first)
              so it leads there too, at its original (smaller) size. */}
          <div className="relative order-1 min-h-[55vh] flex-1 overflow-hidden rounded-2xl border border-cyan-400/15 xl:order-first xl:min-h-[42vh]">
            {isLoading || !plant || !render ? (
              <LoadingBlock label="Loading plant…" />
            ) : (
              <>
                {viewBud && canViewBud && budDev ? (
                  <BudGL
                    dna={render.budDna}
                    seed={seedForPlant(plant.id)}
                    budDev={budDev.budDev}
                    ripe={budDev.ripe}
                    brown={budDev.brown}
                    trich={budDev.trich}
                    purple={render.budColor.anthocyanin ?? 0}
                    reducedMotion={reducedMotion}
                  />
                ) : (
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
                      fan: fanVisual,
                      temp: climate.temperature,
                      hum: climate.humidity,
                      co2: climate.co2_level,
                    }}
                    conditionFlags={plant.condition_flags}
                    view="chamber"
                  />
                )}
                {/* the plant's visible response to care taps (water/feed/prune/
                    train…) — same overlay the chamber stage mounts */}
                <PlantReactionLayer />
                {/* Grow Chamber = the ARCADE layer (boosts, growth boost, rewind).
                    Everything needed to PLAY stays on this page; the chamber is
                    the optional fun extra. */}
                {!ended && (
                  <Link
                    href={`/dashboard/plants/${plant.id}/chamber`}
                    className="absolute left-1/2 top-2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-300/40 bg-ink-900/80 px-3 py-1 text-xs font-semibold text-amber-100 backdrop-blur-sm hover:border-amber-200/70"
                  >
                    🕹 Arcade
                  </Link>
                )}
                {canViewBud && (
                  <button
                    type="button"
                    onClick={() => setViewBud((v) => !v)}
                    aria-pressed={viewBud}
                    className="absolute right-2 top-2 z-20 rounded-full border border-cyan-400/30 bg-ink-900/80 px-3 py-1 text-xs text-cyan-100 backdrop-blur-sm hover:border-cyan-300/60"
                  >
                    {viewBud ? "🌿 Whole plant" : "🔬 View bud"}
                  </button>
                )}
                {/* glass grow-tube framing — grow-light glow up top (intensity
                    driven by the equipped light's real PPFD, S4 — was a fixed
                    cosmetic constant), a glass reflection down the left, and a
                    soft cyan inner glow so the center reads as a lit chamber */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    boxShadow: `inset 0 0 70px rgba(80,200,255,${(0.05 + glowAlpha * 0.15).toFixed(3)}), inset 0 0 0 1px rgba(140,210,255,0.10)`,
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-2xl"
                  style={{
                    background: `linear-gradient(to bottom, rgba(103,232,249,${(0.12 + glowAlpha * 0.28).toFixed(3)}), transparent)`,
                  }}
                />
                {/* Soil substrate tint at the pot base — reflects the equipped
                    soil (S4), default dark substrate with none equipped. */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-2xl"
                  style={{
                    background: `radial-gradient(ellipse at center bottom, ${podSoilTint}55, transparent 70%)`,
                  }}
                />
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
                {ended && (
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

          {/* Compact core-status chips right under the hero on mobile (desktop
              keeps its own copy in the header band — see the `hidden xl:block`
              pair above, unchanged). */}
          {plant && (
            <div className="order-2 xl:hidden">
              <HeroStatChips forecast={plant.forecast} rarity={strain?.rarity} />
            </div>
          )}

          <div className="order-5 xl:order-none">
            <TimeControls forecast={plant?.forecast} />
          </div>

          {/* Right under the hero: where this stage is at + what's happening,
              then the most-reached-for tools (do-next hint, levels, care bar).
              Once the plant is harvested/dead (`ended`) none of this applies —
              there is nothing left to water/feed/prune, and showing full vitals
              + a live care bar on a finished plant is exactly the "there's
              nothing else I can do, but it still looks alive" complaint. Swap
              the whole block for the one real remaining action: pay to clean
              the pod and free it for a new seed. */}
          {plant && !ended && (
            <div className="order-7 xl:order-none">
              <StageInfoCard
                stage={renderStage}
                progressPct={plant.forecast?.stage_progress_pct ?? null}
              />
            </div>
          )}
          {plant && !ended && (
            <div className="order-8 xl:order-none">
              <NextActionHint plant={plant} />
            </div>
          )}
          {plant && !ended && (
            <div className="order-9 xl:order-none">
              <CareDeck plant={plant} />
            </div>
          )}
          {plant && ended && (
            <div className="order-9 space-y-2 rounded-xl border border-cyan-400/15 bg-[#0b1b27]/50 p-3 xl:order-none">
              <p className="text-center text-sm text-gray-300">
                {plant.harvested
                  ? "🌾 Harvested — this pod needs cleaning before your next grow."
                  : "🥀 This plant didn't make it — this pod needs cleaning before your next grow."}
              </p>
              <PlantActionCTA plant={plant} pod={pod} />
            </div>
          )}

          {/* The full care loop closes HERE (owner: "anybody should be able to
              play the ENTIRE game from the main game page"): Today's Plan +
              Plant Insights + the Harvest CTA — the same tested dock panels the
              chamber used to carry (ChamberDock), imported, not forked. */}
          {plant && !ended && (
            <div className="order-10 xl:order-none">
              <ChamberPanel plant={plant} strain={strain} />
            </div>
          )}
          {plant && !ended && plant.forecast && (
            <div className="order-11 xl:order-none">
              <PlantProgressStrip forecast={plant.forecast} />
            </div>
          )}
          {plant && !ended && (
            <div className="order-11 xl:order-none">
              <EncouragementFooter health={health} />
            </div>
          )}

          {/* Mobile-only: everything below is scientist/report detail (DNA,
              traits, morphology, environment sliders, grow console) — real
              content, not deleted, just collapsed by default so it doesn't
              force-stack into the default scroll (owner: plant + care loop
              lead, not a report page). Desktop never sees this toggle — the
              rails below are always-visible side columns there. */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="order-12 flex min-h-[44px] items-center justify-between rounded-xl border border-cyan-400/15 bg-[#0b1b27]/50 px-3 py-2 text-xs font-semibold text-cyan-200/80 xl:hidden"
          >
            <span>⚙ Advanced · Scientist view</span>
            <span className="text-cyan-300">{showAdvanced ? "▲ Hide" : "▼ Show"}</span>
          </button>
        </div>

        {/* left rail: Plant DNA / Traits / Morphology — always visible on
            desktop; behind the mobile "Advanced" toggle above. */}
        <div
          className={`${showAdvanced ? "block" : "hidden"} min-h-0 xl:block xl:col-start-1 xl:row-start-1`}
        >
          <PlantDnaRail strain={strain} plantId={activeId} stage={renderStage} />
        </div>

        {/* right rail: environment controls + read-only grow console — same
            mobile-collapse treatment as the left rail. */}
        <div
          className={`${showAdvanced ? "flex" : "hidden"} min-h-0 flex-col gap-3 xl:flex xl:col-start-3 xl:row-start-1`}
        >
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
    </div>
  );
}
