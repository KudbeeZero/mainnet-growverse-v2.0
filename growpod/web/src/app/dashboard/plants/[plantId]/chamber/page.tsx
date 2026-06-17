"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { CareButtons } from "@/components/plant/CareButtons";
import { GrowChamber, type ChamberView } from "@/components/viz/GrowChamber";
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
import { titleCase } from "@/lib/format";

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
const SLIDERS = [
  { key: "fan", label: "FAN", min: 0, max: 100, step: 1, unit: "%", optimal: [18, 78], local: true },
  { key: "temperature", label: "TEMP", min: 10, max: 40, step: 0.5, unit: "°C", optimal: [20, 28] },
  { key: "humidity", label: "HUMIDITY", min: 10, max: 95, step: 1, unit: "%", optimal: [40, 60] },
  { key: "co2_level", label: "CO₂", min: 400, max: 1500, step: 10, unit: "", optimal: [800, 1500] },
  { key: "light_intensity", label: "LIGHT", min: 0, max: 1000, step: 10, unit: "", optimal: [300, 900] },
  { key: "ph_level", label: "pH", min: 4, max: 9, step: 0.1, unit: "", optimal: [6, 7] },
] as const;

const COMMIT_DEBOUNCE_MS = 700;

function ReadoutCard({ k, v, unit, alert }: { k: string; v: string | number; unit?: string; alert?: boolean }) {
  return (
    <div
      className={`flex min-w-[92px] items-center gap-2 rounded-xl border px-2.5 py-1.5 font-mono backdrop-blur sm:min-w-[104px] ${
        alert ? "border-orange-500/60 bg-orange-500/10" : "border-cyan-400/30 bg-cyan-400/[0.06]"
      }`}
    >
      <span className="text-[10px] tracking-[0.14em] text-cyan-200/70">{k}</span>
      <span className={`ml-auto text-sm font-bold ${alert ? "text-orange-300" : "text-white"}`}>
        {v}
        {unit && <span className="text-[10px] text-cyan-200/60">{unit}</span>}
      </span>
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
  const [tab, setTab] = useState<"grow" | "climate" | "time" | "view">("grow");
  const [view, setView] = useState<ChamberView>("chamber");
  const [climate, setClimate] = useState<ChamberClimate>(DEFAULT_CLIMATE);
  // Growth-preview scrubber: null = track the real (server) age; a number =
  // preview that day on the cycle. Preview never mutates server state.
  const [previewDay, setPreviewDay] = useState<number | null>(null);

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
      qc.invalidateQueries({ queryKey: queryKeys.plant(plantId) });
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
  const budDna = applyEnvironmentToBudDNA(budDnaFor(strain?.slug ?? strain?.name, budColor), {
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
  const day = previewing ? previewDay : liveNominalDay;
  const renderStage = previewing ? stageForDay(day, flMid) : plant.growth_stage;
  const dev = previewing ? previewDev(day, flMid) : previewDev(liveNominalDay, flMid);
  const maxPreviewDay = Math.round(cycleDays(flMid) + 8);
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
          GROW CHAMBER
        </span>
      </header>

      {/* body — stacks portrait (stage over controls); splits to a stage + side
          rail in landscape so the plant stays tall on short/foldable screens */}
      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
      {/* stage */}
      <div className="relative min-h-0 flex-1">
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
        <div className="pointer-events-none absolute left-2.5 top-2.5 rounded-lg border border-cyan-400/40 bg-[#08141e]/70 px-2.5 py-1.5 font-mono text-[11px] tracking-wide backdrop-blur">
          {strain?.name ?? "Plant"} · {titleCase(renderStage)}
          {previewing && <span className="text-grow-300"> · preview</span>}
        </div>
        <div className="pointer-events-none absolute right-2 top-2 flex flex-col gap-1.5">
          <ReadoutCard k="TO HARVEST" v={harvestDays ?? "—"} unit="d" />
          <ReadoutCard k="TEMP" v={climate.temperature} unit="°C" alert={Math.abs(climate.temperature - 24) > 5} />
          <ReadoutCard k="HUM" v={climate.humidity} unit="%" alert={Math.abs(climate.humidity - 50) > 15} />
          <ReadoutCard k="CO₂" v={climate.co2_level} />
        </div>
        {/* health meter */}
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
                <Link
                  href="/dashboard"
                  className="relative mt-1 rounded-lg border border-grow-600 bg-grow-700/40 px-4 py-2 text-sm font-semibold text-grow-100 hover:bg-grow-700/60"
                >
                  Grow another →
                </Link>
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
          {(["grow", "climate", "time", "view"] as const).map((t) => (
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

        {tab === "grow" && (
          <div className="space-y-2">
            <CareButtons plant={plant} />
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
              trichome frost builds in as it matures — try it in Bud Macro.
            </p>
          </div>
        )}

        {tab === "view" && (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {(["chamber", "macro"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg border px-1 text-xs font-semibold transition-colors ${
                    view === v ? "border-[#3a6a86] bg-[#16364c] text-[#eaf7ff]" : "border-[#1c3447] bg-[#0d1d2b] text-[#7fa9bf]"
                  }`}
                >
                  {v === "chamber" ? "Chamber" : "Bud Macro"}
                </button>
              ))}
            </div>
            <p className="px-1 text-[10px] leading-relaxed text-[#7fa9bf]">
              Swipe across the plant to brush the branches — hard swipes shake trichome dust loose.
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
