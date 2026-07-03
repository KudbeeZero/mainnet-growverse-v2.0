"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { ChamberActionBar, BoostsInline } from "@/components/plant/ChamberDock";
import { PlantReactionLayer } from "@/components/plant/PlantReactionLayer";
import { useGrowthBoost } from "@/hooks/useCareActions";
import { usePlantState } from "@/hooks/usePlantState";
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
import { titleCase } from "@/lib/format";
import { nudge } from "@/lib/slider";
import { getBoostMultiplier, BOOST_APPLIED_EVENT, type BoostApplyDetail } from "@/lib/arcade/boostEngine";
import { useRewindStore } from "@/lib/arcade/timeRewind";

// Grow Chamber = Tier 1, the canonical whole-plant gameplay renderer. It never
// mounts the heavy WebGL bud/lab engines directly — those live behind the
// dedicated "View Bud" screen (bud3d/BudGL) and Lab (plant3d/PlantGL).
const GrowChamber = dynamic(
  () => import("@/components/viz/GrowChamber").then((m) => m.GrowChamber),
  { ssr: false, loading: () => null },
);

// Arcade Mode HUD (rewind + chain row only) — lazy so it's tree-shaken from
// every non-chamber route. Boost-apply UI lives in BoostsInline (ChamberDock)
// so it isn't duplicated here.
const ArcadeHUD = dynamic(
  () => import("@/components/arcade/ArcadeHUD").then((m) => m.ArcadeHUD),
  { ssr: false, loading: () => null },
);

// Chain row (wallet + mint). Lazy + only mounted when ALGO is enabled, so algosdk
// stays out of the chamber bundle otherwise.
const ChainRow = dynamic(
  () => import("@/components/arcade/ChainRow").then((m) => m.ChainRow),
  { ssr: false, loading: () => null },
);

// Plain env read (no chain import) so the chamber bundle doesn't pull in algosdk
// unless the chain layer is actually enabled.
const ALGO_ENABLED = process.env.NEXT_PUBLIC_ALGO_ENABLE === "true";

// How fast a boost visually advances the bud's "look" (nominal grow-days per
// second, per unit of multiplier above 1×). Purely cosmetic — no server/DB change.
const BOOST_DAY_RATE = 0.6;

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

// Slider device ranges (wider than the optimal bands) + the no-penalty optimal
// window from balance.yaml, shown as a hint. FAN is cosmetic (no backend field).
// Fine steps for real "dial it in" precision (the backend stores floats). The
// ± nudge buttons next to each slider step by exactly one of these.
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
      className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-[#1c3447] bg-[#0a1722] font-mono text-sm leading-none text-[#7fa9bf] hover:border-cyan-400/50 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function HudChip({ k, v, unit, alert }: { k: string; v: string | number; unit?: string; alert?: boolean }) {
  return (
    <div
      className={`flex flex-none flex-col items-center rounded-lg border px-2 py-0.5 font-mono backdrop-blur ${
        alert ? "border-orange-500/60 bg-orange-500/10" : "border-cyan-400/25 bg-[#08141e]/60"
      }`}
    >
      <span className={`text-[12px] font-bold leading-tight ${alert ? "text-orange-300" : "text-white"}`}>
        {v}
        {unit && <span className="text-[9px] text-cyan-200/60">{unit}</span>}
      </span>
      <span className="text-[7px] tracking-[0.14em] text-cyan-200/60">{k}</span>
    </div>
  );
}

function ChamberScreen({ plantId }: { plantId: string }) {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: plant, isLoading, isError, error, refetch } = usePlantState(playerId!, plantId);
  const { map } = useStrainMap();
  const { data: pods } = usePods();

  const reducedMotion = usePrefersReducedMotion();
  const [tab, setTab] = useState<"arcade" | "climate" | "time">("arcade");
  const [climate, setClimate] = useState<ChamberClimate>(DEFAULT_CLIMATE);
  // Growth-preview scrubber: null = track the real (server) age; a number =
  // preview that day on the cycle. Preview never mutates server state.
  const [previewDay, setPreviewDay] = useState<number | null>(null);
  // Purchasable (simulated) growth boost — spends in-game GROW to jump the plant
  // forward + revive it; on success we flash the ⚡ electric surge over the stage.
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
  // Post-harvest "Save snapshot" — download the plant canvas as a PNG keepsake.
  // Grabs the GrowChamber canvas from the stage; no server round-trip.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const saveSnapshot = () => {
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `growverse-${plantId.slice(0, 8)}-harvest.png`;
    a.click();
  };

  // --- Arcade Mode (client-only visual layer) ---
  // Transient, in-memory "visual grow" offset that an active boost advances. It
  // moves the bud's LOOK forward only — never the server/DB/economy state.
  const [boostOffset, setBoostOffset] = useState(0);
  const rewindOverride = useRewindStore((s) => s.override);
  const rewindActive = useRewindStore((s) => s.rewindActive);
  const captureSnapshot = useRewindStore((s) => s.captureSnapshot);
  // Latest bud scalars, kept in a ref so the snapshot timer reads current values
  // without re-subscribing each frame.
  const scalarsRef = useRef({ budDev: 0, ripe: 0, brown: 0, trich: 0, purple: 0, day: 0, stage: "seed" });

  // Boost driver: while a boost is active, accrue visual grow-days.
  useEffect(() => {
    let raf = 0;
    let last = typeof performance !== "undefined" ? performance.now() : 0;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const m = getBoostMultiplier();
      if (m > 1) setBoostOffset((o) => o + (m - 1) * dt * BOOST_DAY_RATE);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Capture a rewind snapshot every few seconds from the live (non-preview) look.
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = scalarsRef.current;
      captureSnapshot({ ...s });
    }, 6000);
    return () => window.clearInterval(id);
  }, [captureSnapshot]);

  // --- Best-effort on-chain grow-event log (only when ALGO is enabled) ---
  // Latest plant identity for the boost listener (kept in a ref to avoid re-subscribing).
  const chainPlantRef = useRef<{ id: string; strain: string } | null>(null);
  // Boost → BOOST_APPLIED event log. Dynamic import keeps algosdk lazy.
  useEffect(() => {
    if (!ALGO_ENABLED) return;
    let cleanup = () => {};
    void import("@/lib/chain/algorand/growEvents").then(({ logBoostEvent }) => {
      const onBoost = (e: Event) => {
        const d = (e as CustomEvent<BoostApplyDetail>).detail;
        const p = chainPlantRef.current;
        if (!d || !p || d.duration === 0) return; // skip the mint-celebration burst
        logBoostEvent(p.id, p.strain, d.type, d.multiplier, d.duration);
      };
      window.addEventListener(BOOST_APPLIED_EVENT, onBoost);
      cleanup = () => window.removeEventListener(BOOST_APPLIED_EVENT, onBoost);
    });
    return () => cleanup();
  }, []);
  // Stage transition → STAGE_TRANSITION event log.
  const prevChainStage = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!ALGO_ENABLED || !plant) return;
    const stage = plant.growth_stage;
    const prev = prevChainStage.current;
    prevChainStage.current = stage;
    if (prev && prev !== stage) {
      void import("@/lib/chain/algorand/growEvents").then(({ logStageTransition }) =>
        logStageTransition(plant.id, plant.strain_id, prev, stage, 0),
      );
    }
  }, [plant?.growth_stage, plant?.id, plant?.strain_id, plant]);

  const pod = pods?.find((p) => p.id === plant?.pod_id);

  // Seed the sliders from the pod's real environment, once, when it loads.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !pod) return;
    seededRef.current = true;
    setClimate((c) => ({
      fan: c.fan,
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
      // Climate is pod-wide → refresh EVERY plant in the pod (broad ["plant"]
      // prefix, like useTurbo) plus the dashboard list, not just this plant, so
      // sibling plants reflect the new environment immediately.
      qc.invalidateQueries({ queryKey: ["plant"] });
      if (playerId) qc.invalidateQueries({ queryKey: queryKeys.plants(playerId) });
    },
    onError: (e) => toast.error(e.message),
  });

  // Debounced commit: coalesce a slider drag into one persisted write.
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
    setClimate((c) => {
      const next = { ...c, [key]: value };
      // FAN is local/visual only — never persisted.
      if (key !== "fan") scheduleCommit(next);
      return next;
    });
  }

  if (isLoading) return <LoadingBlock label="Entering chamber…" />;
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
  const indicaRatio = strain?.indica_ratio ?? 0.5;
  const morphology = morphologyFor(indicaRatio);
  const silhouette = silhouetteFor(strain?.slug ?? strain?.name, indicaRatio);
  const flMid = strain ? (strain.flowering_days[0] + strain.flowering_days[1]) / 2 : 60;
  // Per-strain calyx/pistil colour: authored for curated strains (G13, PDP,
  // Animal Mints…), deterministic roll otherwise.
  const budColor = budColorForStrain(strain?.slug ?? strain?.name, morphology.hue, seedForPlant(plant.strain_id));
  // Genetic base DNA, then the grow conditions nudge the phenotype (cool nights →
  // purple, UV → frost, light stress → foxtails, drought → tight). Read from the
  // pod's COMMITTED environment (not the live in-drag slider) so the bud reacts to
  // the real saved conditions and doesn't rebuild on every slider pixel.
  const budDna = applyEnvironmentToBudDNA(budDnaFor(strain?.slug ?? strain?.name, budColor, strain?.bud_dna), {
    temp: pod?.temperature ?? 24,
    light: pod?.light_intensity ?? 600,
    humidity: pod?.humidity ?? 50,
    water: plant.water_level,
  });
  // Live development is driven by the AUTHORITATIVE server stage + progress, not
  // wall-clock age. Under launch time-compression a plant flowers in days, so a
  // raw age would never reach the nominal bud/frost ramps; mapping stage-progress
  // onto the nominal grow day keeps buds, frost and ripeness surfacing in lock-
  // step with the real (compressed) stage. previewDev does the progress→ramp map.
  const liveNominalDay = plant.forecast
    ? nominalGrowDay(plant.growth_stage, plant.forecast.stage_progress_pct, flMid)
    : ageDays(plant.planted_at);
  const previewing = previewDay !== null;
  const maxPreviewDay = Math.round(cycleDays(flMid) + 8);
  // Fold the Arcade boost offset into the LIVE look only (clamped); the time-preview
  // scrubber ignores it. Purely visual — server/plant state is never advanced.
  const boostedLiveDay = previewing ? liveNominalDay : Math.min(maxPreviewDay, liveNominalDay + boostOffset);
  const day = previewing ? previewDay : boostedLiveDay;
  const renderStage = previewing ? stageForDay(day, flMid) : plant.growth_stage;
  const dev = previewing ? previewDev(day, flMid) : previewDev(boostedLiveDay, flMid);
  // Server trichome telemetry → bud frost/maturity (live only); null while previewing.
  const serverBud = budParamsFromTrichomes(plant.trichomes, previewing);
  // The bud's renderable scalars — replaced by the rewind override while scrubbing
  // backward (the bud "un-grows": pistils retract, frost recedes, bud shrinks).
  const liveScalars = {
    budDev: dev.budDev,
    ripe: serverBud?.ripe ?? dev.ripe,
    brown: dev.brown,
    trich: serverBud?.trich ?? dev.trich,
    purple: budColor.anthocyanin ?? 0,
  };
  const budScalars = rewindOverride ?? liveScalars;
  // Keep the snapshot timer fed with the latest LIVE look (not the rewound override).
  scalarsRef.current = { ...liveScalars, day: boostedLiveDay, stage: renderStage };
  // Keep plant identity current for the on-chain boost listener.
  chainPlantRef.current = { id: plant.id, strain: plant.strain_id };
  // "To harvest" is the authoritative, pace-aware countdown from the server
  // forecast (so it tracks the compressed cycle); the client estimate is only a
  // pre-forecast fallback. Count whole days down, never showing 0 until ready.
  const harvestDays = plant.forecast
    ? plant.forecast.is_harvest_ready
      ? 0
      : Math.max(1, Math.ceil(plant.forecast.hours_to_harvest / 24))
    : strain
      ? Math.round(daysToHarvest(plant.growth_stage, strain.flowering_days, plant.health))
      : null;

  const c = climateModel({ fan: climate.fan, temp: climate.temperature, hum: climate.humidity, co2: climate.co2_level });
  const health = clamp(plant.health, 0, 100);
  const ended = !plant.is_alive || plant.harvested;
  const sharedPod = (pod?.capacity ?? 1) > 1;
  // Honest plant mood pill (mockup: "PLANT MOOD · Thriving"). Derived only from
  // real health + condition flags — no invented streak/vibe score. health < 40
  // always reads as struggling regardless of flags; otherwise any active
  // condition flag (or a health band of 40–69) reads as "needs care".
  const conditionFlags = plant.condition_flags ?? [];
  const mood: "thriving" | "care" | "struggling" =
    health < 40 ? "struggling" : health >= 70 && conditionFlags.length === 0 ? "thriving" : "care";
  const MOOD_COPY = {
    thriving: { icon: "🌿", label: "Thriving", cls: "border-grow-400/40 bg-grow-500/10 text-grow-200" },
    care: { icon: "🌤", label: "Needs care", cls: "border-amber-300/40 bg-amber-300/10 text-amber-200" },
    struggling: { icon: "🚨", label: "Struggling", cls: "border-red-400/40 bg-red-400/10 text-red-300" },
  } as const;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#050b12] text-[#cfeeff]">
      {/* header — clears the status-bar / notch on top and the landscape side notch */}
      <header className="flex flex-none items-center gap-3 px-4 pb-1 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href={`/dashboard/plants/${plantId}`}
          className="-m-1 flex h-9 w-9 items-center justify-center rounded-lg text-lg text-cyan-200/70 hover:bg-white/5 hover:text-cyan-100"
          aria-label="Back to plant"
        >
          ←
        </Link>
        <h1 className="text-[20px] font-extrabold tracking-[0.16em] text-[#f2f9ff]">
          GR<span className="text-grow-400">🌿</span>VERS
        </h1>
        <span className="hidden text-[9px] font-bold tracking-[0.26em] text-cyan-300 sm:inline">
          GROW CHAMBER · ARCADE
        </span>
      </header>

      {/* body — stacks portrait (stage over controls); splits to a stage + side
          rail in landscape so the plant stays tall on short/foldable screens */}
      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
      {/* stage */}
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1"
        style={rewindActive && !reducedMotion ? { filter: "hue-rotate(-20deg) saturate(0.85)" } : undefined}
      >
        {/* VHS scanline overlay during a rewind scrub. */}
        {rewindActive && !reducedMotion && (
          <div
            className="pointer-events-none absolute inset-0 z-20"
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 2px, transparent 4px)",
            }}
            aria-hidden
          />
        )}
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
          view="chamber"
        />
        {/* the plant's visible response to care taps (water/feed/prune/train…) */}
        <PlantReactionLayer />
        {/* Compact top HUD — strain + the four key stats in one strip (design
            punch list item 1). Deeper detail stays on the CLIMATE tab. */}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center gap-1.5 overflow-x-auto">
          <span className="flex-none rounded-lg border border-cyan-400/40 bg-[#08141e]/70 px-2 py-1 font-mono text-[10px] tracking-wide backdrop-blur">
            {strain?.name ?? "Plant"} · {titleCase(renderStage)} · Day {Math.round(day)}
            {previewing && <span className="text-grow-300"> · preview</span>}
          </span>
          <span className="flex-1" />
          <HudChip k="TO HARVEST" v={harvestDays ?? "—"} unit="d" />
          <HudChip k="TEMP" v={climate.temperature} unit="°C" alert={Math.abs(climate.temperature - 24) > 5} />
          <HudChip k="HUM" v={climate.humidity} unit="%" alert={Math.abs(climate.humidity - 50) > 15} />
          <HudChip k="CO₂" v={climate.co2_level} />
        </div>
        {/* ⚡ Growth-boost surge — electric flash + bolt over the stage on success. */}
        {boostFlash && (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
            <div className="gpe-electric-flash absolute inset-0" />
            <span className="gpe-electric-bolt absolute left-1/2 top-1/2 text-7xl drop-shadow-[0_0_18px_rgba(125,211,255,0.9)]">
              ⚡
            </span>
          </div>
        )}

        {/* health meter — rides just above the embedded action bar */}
        <div className="pointer-events-none absolute inset-x-2.5 bottom-[86px] h-[5px] overflow-hidden rounded-full bg-[#11212e]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${health}%`,
              background: "linear-gradient(90deg,#e88a5c,#62d99a)",
              opacity: health < 60 ? 1 : 0.7,
            }}
          />
        </div>

        {/* Plant Mood pill — bottom-left, clear of the centered "View Bud" chip
            and above the embedded action bar. Honest read of health + condition
            flags only (see `mood` above) — no invented vibe/streak score. */}
        {!ended && (
          <span
            className={`absolute bottom-[92px] left-2 flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold backdrop-blur ${MOOD_COPY[mood].cls}`}
          >
            {MOOD_COPY[mood].icon} {MOOD_COPY[mood].label}
          </span>
        )}

        {/* 🔬 View Bud — dedicated Tier-2 inspection screen (top cola only, the
            heavy WebGL bud engine). Parked while we focus on the core game loop;
            the route/component stay intact so this is a one-line re-enable later. */}
        {(renderStage === "flowering" || renderStage === "late_flower" || renderStage === "harvest") && !ended && (
          <span
            className="absolute bottom-[92px] left-1/2 -translate-x-1/2 flex cursor-not-allowed items-center gap-1 whitespace-nowrap rounded-full border border-cyan-400/20 bg-[#08141e]/70 px-3 py-1 text-[10px] font-bold text-cyan-200/50 backdrop-blur"
            title="View Bud is coming soon"
          >
            🔬 View Bud · Coming soon
          </span>
        )}

        {/* embedded action bar — glassy tiles built into the chamber base */}
        {!ended && (
          <div className="absolute inset-x-2 bottom-2 z-10">
            <ChamberActionBar plant={plant} />
          </div>
        )}

        {/* REWIND control + chain row — floating button anchored in the chamber
            scene, so it can only ever overlap the stage, never the plan/insights.
            Boost-APPLY UI lives only in the inline BoostsInline (GROW/ARCADE
            sheet below) — this no longer duplicates it. */}
        {!ended && (
          <ArcadeHUD
            reducedMotion={reducedMotion}
            chainSlot={
              ALGO_ENABLED ? (
                <ChainRow
                  plant={plant}
                  mintOptions={{ strainName: strain?.name, growDay: Math.round(day), budDev: budScalars.budDev }}
                />
              ) : undefined
            }
          />
        )}

        {ended && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#050b12]/85 text-center">
            {plant.harvested ? (
              <div className="gpe-celebrate-pop relative flex flex-col items-center gap-2 px-6">
                {/* sparkle rings ripple out behind the trophy (motion only) */}
                {!reducedMotion && (
                  <div className="pointer-events-none absolute -top-2 left-1/2 h-24 w-24 -translate-x-1/2" aria-hidden>
                    <span className="gpe-celebrate-ring absolute inset-0 rounded-full border-2 border-grow-400/70" />
                    <span
                      className="gpe-celebrate-ring absolute inset-0 rounded-full border-2 border-grow-300/50"
                      style={{ animationDelay: "0.35s" }}
                    />
                  </div>
                )}
                <div className="relative text-5xl">🌾</div>
                <p className="relative text-xl font-extrabold text-grow-200 text-glow-grow">
                  Harvest complete!
                </p>
                <p className="relative max-w-[16rem] text-xs text-cyan-200/70">
                  Your {strain?.name ?? "plant"} made it all the way. Cured, weighed and sold.
                </p>
                {/* Next actions — never leave the player wondering what's next
                    (owner spec: Harvest Review / Enter Cup / Save Snapshot /
                    Grow Another). Review = the plant's final report page
                    (vitals, timeline, full journal). */}
                <div className="relative mt-1 flex w-full max-w-[17rem] flex-col gap-2">
                  <Link
                    href="/dashboard"
                    className="rounded-lg border border-grow-600 bg-grow-700/40 px-4 py-2 text-sm font-semibold text-grow-100 hover:bg-grow-700/60"
                  >
                    🌱 Grow another →
                  </Link>
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/plants/${plantId}`}
                      className="flex-1 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-2 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20"
                    >
                      📋 Harvest review
                    </Link>
                    <Link
                      href="/cup"
                      className="flex-1 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-2 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20"
                    >
                      🏆 Enter the Cup
                    </Link>
                  </div>
                  <button
                    onClick={saveSnapshot}
                    className="rounded-lg border border-cyan-400/25 bg-transparent px-2 py-1.5 text-[11px] font-semibold text-cyan-200/80 hover:bg-cyan-400/10"
                  >
                    📸 Save snapshot
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-lg font-bold">This plant has died</p>
                <Link href="/dashboard" className="text-sm text-grow-300 hover:underline">
                  ← Back to dashboard
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* dashboard — bottom sheet in portrait, side rail in landscape */}
      <div className="max-h-[48dvh] flex-none overflow-y-auto bg-gradient-to-b from-transparent to-[#0a1622] px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2 landscape:h-full landscape:max-h-none landscape:w-[clamp(260px,38vw,360px)] landscape:border-l landscape:border-[#11212e] landscape:bg-gradient-to-l landscape:pr-[max(0.75rem,env(safe-area-inset-right))]">
        <div className="mb-2 flex gap-1.5">
          {(["arcade", "climate", "time"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg border px-1 text-xs font-bold tracking-[0.08em] transition-colors ${
                tab === t ? "border-[#3a6a86] bg-[#16364c] text-[#eaf7ff]" : "border-[#1c3447] bg-[#0d1d2b] text-[#7fa9bf]"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {tab === "arcade" && (
          <div className="space-y-2">
            {/* ARCADE = boosts, growth boost, rewind (via the boost tray). The
                dashboard-y panels (Today's Plan, Plant Insights, progress strip,
                encouragement footer) moved to the main game page (Command
                Center) — the chamber is the fun layer, never required play. */}
            {!ended && <BoostsInline />}
            {/* Purchasable growth boost — fast-forward + revive for in-game GROW.
                Cost mirrors balance.yaml simulation.actions.growth_boost.cost.
                Hidden at the harvest window: the server rejects it (nothing left
                to fast-forward), so don't tempt a no-op spend — cut it down. */}
            {!ended && plant.growth_stage !== "harvest" && (
              <button
                onClick={() => growthBoost.mutate()}
                disabled={growthBoost.isPending}
                data-testid="growth-boost"
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500/15 to-grow-500/15 px-3 text-xs font-bold tracking-[0.06em] text-cyan-100 transition-all hover:border-cyan-300 hover:from-cyan-500/25 hover:to-grow-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {growthBoost.isPending ? "Boosting…" : "⚡ Boost Growth · 60 🌿"}
              </button>
            )}
            <p className="px-1 text-[10px] leading-relaxed text-[#7fa9bf]">
              {strain
                ? `${strain.name} · ${indicaRatio >= 0.66 ? "indica-dominant" : indicaRatio <= 0.34 ? "sativa-dominant" : "balanced hybrid"} — grown live from your plant's real state.`
                : "Loading strain…"}
            </p>
          </div>
        )}

        {tab === "climate" && (
          <div className="space-y-1.5">
            {SLIDERS.map((s) => {
              const val = climate[s.key as keyof ChamberClimate];
              const outOfBand = val < s.optimal[0] || val > s.optimal[1];
              return (
                <div key={s.key} className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-[#1c3447] bg-[#0d1d2b] px-2.5 py-2">
                  <span className="w-[66px] flex-none font-mono text-[11px] tracking-[0.06em] text-[#7fa9bf]">
                    {s.label}
                    {"local" in s && s.local && <span className="ml-1 text-[9px] text-[#3a6a86]">(local)</span>}
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
                  {/* ± micro-nudge: one exact step per tap for fine dial-in. */}
                  <NudgeBtn label={`Decrease ${s.label}`} disabled={ended} onClick={() => onSlide(s.key as keyof ChamberClimate, nudge(val, -1, s.step, s.min, s.max))}>−</NudgeBtn>
                  <NudgeBtn label={`Increase ${s.label}`} disabled={ended} onClick={() => onSlide(s.key as keyof ChamberClimate, nudge(val, 1, s.step, s.min, s.max))}>+</NudgeBtn>
                  <span className={`w-[52px] flex-none text-right font-mono text-xs font-bold ${outOfBand ? "text-orange-300" : "text-white"}`}>
                    {val}
                    {s.unit && <span className="text-[10px] text-[#7fa9bf]">{s.unit}</span>}
                  </span>
                </div>
              );
            })}
            <p className="px-1 text-[10px] leading-relaxed text-[#7fa9bf]">
              {c.fanNote}
              {c.co2Boost > 0.05 ? " · CO₂ boosting growth." : ""}
              {sharedPod ? " · Affects all plants in this pod." : ""}
              {setEnv.isPending ? " · saving…" : ""}
            </p>
          </div>
        )}

        {tab === "time" && (
          <div className="space-y-2">
            <div className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-[#1c3447] bg-[#0d1d2b] px-2.5 py-2">
              <span className="w-[66px] flex-none font-mono text-[11px] tracking-[0.06em] text-[#7fa9bf]">GROW DAY</span>
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
              <span className="w-[52px] flex-none text-right font-mono text-[11px] font-bold text-white">
                d{Math.round(day)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[10px] leading-relaxed text-[#7fa9bf]">
                {previewing
                  ? `Previewing ${titleCase(renderStage)} — not this plant's real age.`
                  : `Tracking live growth · ${titleCase(renderStage)}, day ${Math.round(day)}.`}
              </span>
              {previewing && (
                <button
                  onClick={() => setPreviewDay(null)}
                  className="flex-none rounded-md border border-[#3a6a86] bg-[#16364c] px-2 py-1 text-[10px] font-bold text-[#eaf7ff]"
                >
                  Back to live
                </button>
              )}
            </div>
            <p className="px-1 text-[10px] leading-relaxed text-[#7fa9bf]">
              Scrub to watch this strain grow seed → harvest. Buds swell, pistils colour and
              trichome frost builds in as it matures.
            </p>
          </div>
        )}
      </div>
      </div>

    </div>
  );
}

export default function ChamberPage({ params }: { params: Promise<{ plantId: string }> }) {
  const { plantId } = use(params);
  return (
    <RequireAuth>
      <ChamberScreen plantId={plantId} />
    </RequireAuth>
  );
}
