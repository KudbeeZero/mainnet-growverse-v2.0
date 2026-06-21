"use client";

// The ONE plant screen. Reached by drilling Pods → Pod → Plant. Everything for a
// single plant lives here behind four tabs — Care · Climate · Timeline · Macro —
// so there is no longer a separate Grow Chamber / Command Center to get lost in.
// (Those routes still exist by URL but nothing links to them.) The live plant
// canvas sits on top; the tabs drive it.

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StatBars } from "@/components/plant/StatBars";
import { ConditionBadges } from "@/components/plant/ConditionBadges";
import { CareButtons } from "@/components/plant/CareButtons";
import { EventLog } from "@/components/plant/EventLog";
import { PlantMetrics } from "@/components/plant/PlantMetrics";
import { StageTimeline } from "@/components/plant/StageTimeline";
import { AdvisorPanel } from "@/components/plant/AdvisorPanel";
import { PlantActionCTA } from "@/components/plant/PlantActionCTA";
import { TrichomeReadout } from "@/components/plant/TrichomeReadout";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { nextPlantAction } from "@/lib/plantAction";
import type { ChamberView } from "@/components/viz/GrowChamber";
import { useGrowthBoost } from "@/hooks/useCareActions";
import { usePlantState } from "@/hooks/usePlantState";
import { useTurbo } from "@/hooks/useTurbo";
import { useQaMilestones } from "@/hooks/useQaMilestones";
import { useStrainMap, usePods } from "@/hooks/queries";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import type { Environment } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import {
  ageDays,
  morphologyFor,
  daysToHarvest,
  climateModel,
  clamp,
  seedForPlant,
  stageForDay,
  previewDev,
  nominalGrowDay,
  cycleDays,
} from "@/lib/chamber/morphology";
import { budColorForStrain, silhouetteFor } from "@/lib/chamber/strainVisuals";
import { budDnaFor, applyEnvironmentToBudDNA } from "@/lib/chamber/budDna";
import { budParamsFromTrichomes } from "@/lib/chamber/bud3d/serverBud";
import { titleCase, dateTime } from "@/lib/format";
import { nudge } from "@/lib/slider";
import { isBud3DEnabled } from "@/lib/features";

const GrowChamber = dynamic(
  () => import("@/components/viz/GrowChamber").then((m) => m.GrowChamber),
  { ssr: false, loading: () => null },
);
const BudGL = dynamic(
  () => import("@/components/viz/BudGL").then((m) => m.BudGL),
  { ssr: false, loading: () => null },
);

type Tab = "care" | "climate" | "timeline" | "macro";

// Local climate state: the five persisted fields + a visual-only FAN.
interface ChamberClimate extends Environment {
  fan: number;
}
const DEFAULT_CLIMATE: ChamberClimate = {
  fan: 45,
  temperature: 24,
  humidity: 50,
  co2_level: 800,
  light_intensity: 600,
  ph_level: 6.5,
};

// Slider device ranges + the no-penalty optimal window from balance.yaml (shown
// as a hint). FAN is cosmetic (no backend field). The ± nudge steps by one step.
const SLIDERS = [
  { key: "fan", label: "FAN", min: 0, max: 100, step: 1, unit: "%", optimal: [18, 78], local: true },
  { key: "temperature", label: "TEMP", min: 10, max: 40, step: 0.1, unit: "°C", optimal: [20, 28] },
  { key: "humidity", label: "HUMIDITY", min: 10, max: 95, step: 0.5, unit: "%", optimal: [40, 60] },
  { key: "co2_level", label: "CO₂", min: 400, max: 1500, step: 5, unit: "", optimal: [800, 1500] },
  { key: "light_intensity", label: "LIGHT", min: 0, max: 1000, step: 5, unit: "", optimal: [300, 900] },
  { key: "ph_level", label: "pH", min: 4, max: 9, step: 0.05, unit: "", optimal: [6, 7] },
] as const;

const COMMIT_DEBOUNCE_MS = 700;

function NudgeBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-ink-600 bg-ink-900 font-mono text-sm leading-none text-gray-300 hover:border-cyan-400/50 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function PlantScreen({ plantId }: { plantId: string }) {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: plant, isLoading, isError, error, refetch } = usePlantState(playerId!, plantId);
  const { map } = useStrainMap();
  const { data: pods } = usePods();
  const reducedMotion = usePrefersReducedMotion();

  const [bud3dOverride, setBud3dOverride] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("bud3d") === "1") {
      setBud3dOverride(true);
    }
  }, []);
  const bud3d = isBud3DEnabled() || bud3dOverride;

  const [tab, setTab] = useState<Tab>("care");
  const [view, setView] = useState<ChamberView>("chamber");
  const [climate, setClimate] = useState<ChamberClimate>(DEFAULT_CLIMATE);
  // Growth-preview scrubber: null = track the real (server) age; a number = preview.
  const [previewDay, setPreviewDay] = useState<number | null>(null);
  const { enabled: devSpeed, multiplier: turboX, isToggling, toggle: toggleTurbo } =
    useTurbo(playerId);

  // QA-only: toast on real state changes between polls so testing feels alive.
  useQaMilestones(plant, playerId);

  const pod = pods?.find((p) => p.id === plant?.pod_id);

  // Seed the sliders from the pod's real environment, once, when it loads.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !pod) return;
    seededRef.current = true;
    setClimate((cc) => ({
      fan: cc.fan,
      temperature: pod.temperature ?? cc.temperature,
      humidity: pod.humidity ?? cc.humidity,
      co2_level: pod.co2_level ?? cc.co2_level,
      light_intensity: pod.light_intensity ?? cc.light_intensity,
      ph_level: pod.ph_level ?? cc.ph_level,
    }));
  }, [pod]);

  const setEnv = useMutation<unknown, ApiError, Environment>({
    mutationFn: (env) => api.pods.setEnvironment(playerId!, plant!.pod_id, env),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pods(playerId!) });
      qc.invalidateQueries({ queryKey: ["plant"] });
      if (playerId) qc.invalidateQueries({ queryKey: queryKeys.plants(playerId) });
    },
    onError: (e) => toast.error(e.message),
  });

  const commitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleCommit(next: ChamberClimate) {
    if (commitRef.current) clearTimeout(commitRef.current);
    commitRef.current = setTimeout(() => {
      setEnv.mutate({
        temperature: next.temperature,
        humidity: next.humidity,
        co2_level: next.co2_level,
        light_intensity: next.light_intensity,
        ph_level: next.ph_level,
      });
    }, COMMIT_DEBOUNCE_MS);
  }
  useEffect(() => () => {
    if (commitRef.current) clearTimeout(commitRef.current);
  }, []);

  function onSlide(key: keyof ChamberClimate, value: number) {
    setClimate((cc) => {
      const next = { ...cc, [key]: value };
      if (key !== "fan") scheduleCommit(next); // FAN is local/visual only
      return next;
    });
  }

  // Growth boost — fast-forward + revive for in-game GROW.
  const [boostFlash, setBoostFlash] = useState(false);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const growthBoost = useGrowthBoost(plantId, () => {
    if (reducedMotion) return;
    setBoostFlash(true);
    if (flashRef.current) clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setBoostFlash(false), 1100);
  });
  useEffect(() => () => {
    if (flashRef.current) clearTimeout(flashRef.current);
  }, []);

  const plantSettled = Boolean(plant && (!plant.is_alive || plant.harvested));
  const events = useQuery({
    queryKey: queryKeys.events(plantId),
    queryFn: () => api.plants.events(plantId, 50),
    refetchInterval: plantSettled ? false : 10_000,
    enabled: tab === "timeline",
  });

  if (isLoading) return <LoadingBlock label="Loading plant…" />;
  if (isError || !plant)
    return (
      <div className="space-y-3">
        <ErrorState error={error} onRetry={() => refetch()} />
        <Link href="/dashboard" className="text-sm text-grow-300">
          ← Back to pods
        </Link>
      </div>
    );

  const strain = map.get(plant.strain_id);
  const indicaRatio = strain?.indica_ratio ?? 0.5;
  const morphology = morphologyFor(indicaRatio);
  const silhouette = silhouetteFor(strain?.slug ?? strain?.name, indicaRatio);
  const flMid = strain ? (strain.flowering_days[0] + strain.flowering_days[1]) / 2 : 60;
  const budColor = budColorForStrain(strain?.slug ?? strain?.name, morphology.hue, seedForPlant(plant.strain_id));
  const budDna = applyEnvironmentToBudDNA(budDnaFor(strain?.slug ?? strain?.name, budColor, strain?.bud_dna), {
    temp: pod?.temperature ?? 24,
    light: pod?.light_intensity ?? 600,
    humidity: pod?.humidity ?? 50,
    water: plant.water_level,
  });
  const liveNominalDay = plant.forecast
    ? nominalGrowDay(plant.growth_stage, plant.forecast.stage_progress_pct, flMid)
    : ageDays(plant.planted_at);
  const previewing = previewDay !== null;
  const day = previewing ? previewDay : liveNominalDay;
  const renderStage = previewing ? stageForDay(day, flMid) : plant.growth_stage;
  const dev = previewing ? previewDev(day, flMid) : previewDev(liveNominalDay, flMid);
  const serverBud = budParamsFromTrichomes(plant.trichomes, previewing);
  const maxPreviewDay = Math.round(cycleDays(flMid) + 8);
  const harvestDays = plant.forecast
    ? plant.forecast.is_harvest_ready
      ? 0
      : Math.max(1, Math.ceil(plant.forecast.hours_to_harvest / 24))
    : strain
      ? Math.round(daysToHarvest(plant.growth_stage, strain.flowering_days, plant.health))
      : null;
  const daysSmooth =
    devSpeed && plant.forecast?.hours_to_harvest !== undefined
      ? (plant.forecast.hours_to_harvest / 24).toFixed(2)
      : null;

  const cm = climateModel({ fan: climate.fan, temp: climate.temperature, hum: climate.humidity, co2: climate.co2_level });
  const health = clamp(plant.health, 0, 100);
  const ended = !plant.is_alive || plant.harvested;
  const sharedPod = (pod?.capacity ?? 1) > 1;
  const hasNextAction = nextPlantAction(plant, pod ?? null).kind !== "none";

  const TABS: { id: Tab; label: string }[] = [
    { id: "care", label: "Care" },
    { id: "climate", label: "Climate" },
    { id: "timeline", label: "Timeline" },
    { id: "macro", label: "Macro" },
  ];

  return (
    <div className="space-y-4 pb-28 lg:pb-0">
      <Breadcrumb
        items={[
          { label: "Pods", href: "/dashboard" },
          ...(pod ? [{ label: pod.name, href: `/dashboard/pods/${pod.id}` }] : []),
          { label: strain?.name ?? "Plant" },
        ]}
      />

      {/* Live plant canvas — shared across tabs; the tabs drive it. */}
      <Card className="overflow-hidden p-0">
        <div className="relative h-72 w-full bg-[#050b12] sm:h-80">
          {bud3d && view === "macro" ? (
            <BudGL
              dna={budDna}
              seed={seedForPlant(plantId)}
              budDev={dev.budDev}
              ripe={serverBud?.ripe ?? dev.ripe}
              brown={dev.brown}
              trich={serverBud?.trich ?? dev.trich}
              purple={budColor.anthocyanin ?? 0}
              reducedMotion={reducedMotion}
            />
          ) : (
            <GrowChamber
              seed={seedForPlant(plantId)}
              day={day}
              stage={renderStage}
              morphology={morphology}
              silhouette={silhouette}
              dev={dev}
              budColor={budColor}
              budDna={budDna}
              climate={{ fan: climate.fan, temp: climate.temperature, hum: climate.humidity, co2: climate.co2_level }}
              conditionFlags={plant.condition_flags}
              view={view}
            />
          )}

          <div className="pointer-events-none absolute left-2.5 top-2.5 rounded-lg border border-cyan-400/40 bg-[#08141e]/70 px-2.5 py-1.5 font-mono text-[11px] tracking-wide text-cyan-100 backdrop-blur">
            {strain?.name ?? "Plant"} · {titleCase(renderStage)}
            {previewing && <span className="text-grow-300"> · preview</span>}
          </div>
          <div className="pointer-events-none absolute right-2.5 top-2.5 rounded-lg border border-cyan-400/30 bg-[#08141e]/70 px-2.5 py-1.5 text-right font-mono text-[11px] text-cyan-100 backdrop-blur">
            <span className="text-cyan-200/70">TO HARVEST </span>
            <span className="font-bold text-white">{daysSmooth ?? harvestDays ?? "—"}d</span>
          </div>

          {boostFlash && (
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
              <div className="gpe-electric-flash absolute inset-0" />
              <span className="gpe-electric-bolt absolute left-1/2 top-1/2 text-7xl drop-shadow-[0_0_18px_rgba(125,211,255,0.9)]">
                ⚡
              </span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-2.5 bottom-2 h-[5px] overflow-hidden rounded-full bg-[#11212e]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${health}%`,
                background: "linear-gradient(90deg,#e88a5c,#62d99a)",
                opacity: health < 60 ? 1 : 0.7,
              }}
            />
          </div>

          {view === "macro" && plant.trichomes?.active && (
            <div className="absolute bottom-3 left-2.5 w-[200px] max-w-[60%]">
              <TrichomeReadout t={plant.trichomes} />
            </div>
          )}

          {(renderStage === "flowering" || renderStage === "late_flower" || renderStage === "harvest") &&
            !ended &&
            view !== "macro" && (
              <button
                onClick={() => { setView("macro"); setTab("macro"); }}
                className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-cyan-400/50 bg-[#08141e]/85 px-4 py-2 text-xs font-bold text-cyan-200 backdrop-blur hover:border-cyan-300 hover:bg-[#16364c]"
              >
                🔬 View Buds
              </button>
            )}

          {ended && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#050b12]/85 text-center">
              {plant.harvested ? (
                <>
                  <div className="text-5xl">🌾</div>
                  <p className="text-xl font-extrabold text-grow-200">Harvest complete!</p>
                  <Link href="/dashboard" className="mt-1 rounded-lg border border-grow-600 bg-grow-700/40 px-4 py-2 text-sm font-semibold text-grow-100 hover:bg-grow-700/60">
                    Grow another →
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-gray-100">This plant has died</p>
                  <Link href="/dashboard" className="text-sm text-grow-300 hover:underline">
                    ← Back to pods
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Tab bar */}
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg border px-1 text-sm font-bold tracking-wide transition-colors ${
              tab === t.id
                ? "border-grow-500 bg-grow-700/30 text-grow-100"
                : "border-ink-600 bg-ink-900 text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CARE */}
      {tab === "care" && (
        <div className="space-y-4">
          <PlantActionCTA plant={plant} pod={pod ?? null} />
          <Card className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-300">Care</h3>
              <CareButtons plant={plant} />
              {!ended && plant.growth_stage !== "harvest" && (
                <button
                  onClick={() => growthBoost.mutate()}
                  disabled={growthBoost.isPending}
                  data-testid="growth-boost"
                  className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/50 bg-gradient-to-r from-cyan-500/15 to-grow-500/15 px-3 text-xs font-bold tracking-[0.06em] text-cyan-100 hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {growthBoost.isPending ? "Boosting…" : "⚡ Boost Growth · 60 🌿"}
                </button>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-300">Vitals</h3>
              <StatBars plant={plant} />
            </div>
            <ConditionBadges flags={plant.condition_flags} />
            {plant.metrics && (
              <div>
                <h3 className="instrument-label mb-2">Scientist readouts</h3>
                <PlantMetrics plant={plant} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <span>Planted: {dateTime(plant.planted_at)}</span>
              <span>Alive: {plant.is_alive ? "yes" : "no"}</span>
              {strain && (
                <Link href={`/lab/strains/${strain.id}`} className="col-span-2 text-grow-300 hover:underline">
                  {strain.name} — {indicaRatio >= 0.66 ? "indica-dominant" : indicaRatio <= 0.34 ? "sativa-dominant" : "balanced hybrid"} →
                </Link>
              )}
            </div>
          </Card>
          <div data-onboarding="plant-suggestions">
            <AdvisorPanel plantId={plant.id} />
          </div>
        </div>
      )}

      {/* CLIMATE */}
      {tab === "climate" && (
        <Card className="space-y-1.5">
          {SLIDERS.map((s) => {
            const val = climate[s.key as keyof ChamberClimate];
            const outOfBand = val < s.optimal[0] || val > s.optimal[1];
            return (
              <div key={s.key} className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-2">
                <span className="w-[66px] flex-none font-mono text-[11px] tracking-[0.06em] text-gray-400">
                  {s.label}
                  {"local" in s && s.local && <span className="ml-1 text-[9px] text-gray-600">(local)</span>}
                </span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={val}
                  onChange={(e) => onSlide(s.key as keyof ChamberClimate, Number(e.target.value))}
                  disabled={ended}
                  aria-label={s.label}
                  className="h-2 flex-1 cursor-pointer accent-cyan-400"
                />
                <NudgeBtn label={`Decrease ${s.label}`} disabled={ended} onClick={() => onSlide(s.key as keyof ChamberClimate, nudge(val, -1, s.step, s.min, s.max))}>−</NudgeBtn>
                <NudgeBtn label={`Increase ${s.label}`} disabled={ended} onClick={() => onSlide(s.key as keyof ChamberClimate, nudge(val, 1, s.step, s.min, s.max))}>+</NudgeBtn>
                <span className={`w-[52px] flex-none text-right font-mono text-xs font-bold ${outOfBand ? "text-orange-300" : "text-white"}`}>
                  {val}
                  {s.unit && <span className="text-[10px] text-gray-400">{s.unit}</span>}
                </span>
              </div>
            );
          })}
          <p className="px-1 text-[11px] leading-relaxed text-gray-400">
            {cm.fanNote}
            {cm.co2Boost > 0.05 ? " · CO₂ boosting growth." : ""}
            {sharedPod ? " · Affects all plants in this pod." : ""}
            {setEnv.isPending ? " · saving…" : ""}
          </p>
        </Card>
      )}

      {/* TIMELINE */}
      {tab === "timeline" && (
        <div className="space-y-4">
          <Card className="space-y-3">
            {plant.forecast && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Growth timeline</h3>
                <StageTimeline forecast={plant.forecast} harvested={plant.harvested} isAlive={plant.is_alive} />
              </div>
            )}
            <div className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-2">
              <span className="w-[66px] flex-none font-mono text-[11px] tracking-[0.06em] text-gray-400">GROW DAY</span>
              <input
                type="range"
                min={0}
                max={maxPreviewDay}
                step={0.5}
                value={Math.min(day, maxPreviewDay)}
                onChange={(e) => setPreviewDay(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer accent-grow-400"
                aria-label="Preview growth day"
              />
              <span className="w-[52px] flex-none text-right font-mono text-[11px] font-bold text-white">d{Math.round(day)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] leading-relaxed text-gray-400">
                {previewing
                  ? `Previewing ${titleCase(renderStage)} — not this plant's real age.`
                  : `Tracking live growth · ${titleCase(renderStage)}, day ${Math.round(day)}.`}
              </span>
              {previewing && (
                <button onClick={() => setPreviewDay(null)} className="flex-none rounded-md border border-grow-600 bg-grow-700/30 px-2 py-1 text-[10px] font-bold text-grow-100">
                  Back to live
                </button>
              )}
            </div>
            <button
              onClick={() => !isToggling && toggleTurbo(!devSpeed)}
              disabled={isToggling}
              className={`flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border text-xs font-bold tracking-wide transition-all disabled:opacity-60 ${
                devSpeed
                  ? "border-green-400 bg-green-500/20 text-green-300"
                  : "border-ink-600 bg-ink-900 text-gray-400 hover:border-green-700 hover:text-green-400"
              }`}
            >
              <span>⚡ Turbo {turboX}× · {devSpeed ? "ON" : "OFF"}</span>
              {devSpeed && daysSmooth !== null && <span className="font-mono text-green-200">· {daysSmooth}d</span>}
            </button>
            <p className="px-1 text-[11px] leading-relaxed text-gray-500">
              Scrub the slider to preview seed → harvest. Turbo speeds up every pod on your account so you can watch it grow live.
            </p>
          </Card>
          <Card>
            <h3 className="mb-2 text-sm font-semibold text-gray-300">Event log</h3>
            {events.isLoading ? <LoadingBlock /> : <EventLog events={events.data ?? plant.recent_events} />}
          </Card>
        </div>
      )}

      {/* MACRO */}
      {tab === "macro" && (
        <Card className="space-y-2">
          <div className="flex gap-1.5">
            {(["chamber", "macro"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg border px-1 text-xs font-semibold transition-colors ${
                  view === v ? "border-grow-500 bg-grow-700/30 text-grow-100" : "border-ink-600 bg-ink-900 text-gray-400 hover:text-gray-200"
                }`}
              >
                {v === "chamber" ? "Whole plant" : "Bud macro"}
              </button>
            ))}
          </div>
          <p className="px-1 text-[11px] leading-relaxed text-gray-500">
            Switch to <strong>Bud macro</strong> to zoom into the cola — buds swell, pistils colour and trichome frost builds as it ripens. The view above updates live.
          </p>
        </Card>
      )}

      {/* Mobile: the next action, always within thumb reach while scrolling. */}
      {hasNextAction && (
        <StickyActionBar>
          <PlantActionCTA plant={plant} pod={pod ?? null} />
        </StickyActionBar>
      )}
    </div>
  );
}

export default function PlantPage({ params }: { params: Promise<{ plantId: string }> }) {
  const { plantId } = use(params);
  return (
    <RequireAuth>
      <PlantScreen plantId={plantId} />
    </RequireAuth>
  );
}
