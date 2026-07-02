"use client";

// DEV-ONLY Plant Visual Review Board — purely additive, never reachable in prod
// (the route's page.tsx 404s outside `NODE_ENV === "development"`).
//
// Purpose: a reusable review surface for the canonical <GrowChamber> renderer so
// the owner can inspect a plant across growth stage, nominal day, indica/sativa
// morphology, chamber/macro view, climate, and the condition/stress states that
// ACTUALLY change the canvas — instead of capturing one-off screenshot packets.
//
// Honesty rule: this panel only exposes controls that genuinely drive the
// renderer. Inputs that exist in app/server state but do NOT change the drawn
// plant (nutrients, humidity, overall health, AI-scout labels) are listed in the
// "Not wired to renderer" notes, not faked as live controls.
//
// It reads nothing from the server and writes nothing — pure local preview. Like
// the morphology panel, we remount <GrowChamber> via a `key` on the structural
// inputs so every change visibly re-renders (the component only rebuilds geometry
// on its internal buildKey; we must not modify the renderer).

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ConditionFlag, ConditionKind, GrowthStage, Severity } from "@/lib/types";
import {
  morphologyFor,
  effectiveDev,
  budColorFor,
  type Morphology,
  type ClimateInput,
} from "@/lib/chamber/morphology";
import { silhouetteFor } from "@/lib/chamber/strainVisuals";
import { budDnaFor } from "@/lib/chamber/budDna";
import type { ChamberView } from "@/lib/chamber/chamberCore";
import type { PlantLayerVisibility, PlantDensity } from "@/components/viz/PlantGL";

const GrowChamber = dynamic(
  () => import("@/components/viz/GrowChamber").then((m) => m.GrowChamber),
  { ssr: false, loading: () => null },
);

const PlantGL = dynamic(
  () => import("@/components/viz/PlantGL").then((m) => m.PlantGL),
  { ssr: false, loading: () => null },
);

const STAGES: GrowthStage[] = [
  "seed",
  "germination",
  "seedling",
  "vegetative",
  "flowering",
  "late_flower",
  "harvest",
];

const VIEWS: ChamberView[] = ["chamber", "plant3d", "macro"];

const SEVERITIES: Severity[] = ["mild", "moderate", "severe"];

// Condition flags that produce a REAL whole-plant (chamber-view) visual change —
// droop/wilt body animation and/or a canvas overlay (bugs/mildew/rot/water-sheen).
// Source: lib/conditionVisuals.ts (bodyAnim != "sway" or overlay != "none").
const WIRED_CONDITIONS: ConditionKind[] = [
  "underwatered",
  "wilting",
  "overwatered",
  "root_rot",
  "pest_infestation",
  "mildew",
];

// Climate sliders → ClimateInput; all four genuinely drive the renderer
// (sway/windburn/fan-speed/CO2 glow in chamber view; temp shifts the bud palette
// in macro view).
interface ClimateField {
  key: keyof ClimateInput;
  label: string;
  min: number;
  max: number;
  step: number;
}
const CLIMATE_FIELDS: ClimateField[] = [
  { key: "fan", label: "fan", min: 0, max: 100, step: 1 },
  { key: "temp", label: "temp °C", min: 10, max: 40, step: 0.5 },
  { key: "hum", label: "humidity %", min: 10, max: 95, step: 1 },
  { key: "co2", label: "CO₂ ppm", min: 400, max: 1500, step: 10 },
];

// 3D layer-inspection toggles (plant3d view) — the 7-layer construction model
// plus two debug overlays. Order mirrors the build order stem → … → frost.
const LAYER_TOGGLES: { key: keyof PlantLayerVisibility; label: string }[] = [
  { key: "woody", label: "stem+branch" },
  { key: "fanLeaves", label: "fan leaves" },
  { key: "budCore", label: "bud core" },
  { key: "calyxes", label: "bracts/calyxes" },
  { key: "sugarLeaves", label: "sugar leaves" },
  { key: "pistils", label: "pistils" },
  { key: "frost", label: "trichomes" },
  { key: "skeleton", label: "⊹ skeleton" },
  { key: "nodes", label: "⊹ nodes" },
];

const DENSITY_FIELDS: { key: keyof PlantDensity; label: string }[] = [
  { key: "cola", label: "cola density" },
  { key: "pistil", label: "pistil density" },
  { key: "frost", label: "trichome density" },
  { key: "leaf", label: "sugar-leaf density" },
];

const DEFAULT_LAYERS: PlantLayerVisibility = {
  woody: true, fanLeaves: true, budCore: true, calyxes: true,
  sugarLeaves: true, pistils: true, frost: true, skeleton: false, nodes: false,
};
const DEFAULT_DENSITY_3D: PlantDensity = { cola: 1, pistil: 1, frost: 1, leaf: 1 };

const card = "rounded-lg border border-[#1c3447] bg-[#0d1d2b] px-3 py-2";
const sectionLabel = "font-mono text-[10px] uppercase tracking-[0.14em] text-[#5e8ba3]";

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${card}`}>
      <span className="w-[96px] flex-none font-mono text-[11px] tracking-[0.04em] text-[#7fa9bf]">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-2 flex-1 cursor-pointer accent-cyan-400"
      />
      <span className="w-[52px] flex-none text-right font-mono text-xs font-bold text-white">
        {Number.isInteger(value) ? value : value.toFixed(2)}
      </span>
    </div>
  );
}

export function PlantReviewPanel() {
  // Structural inputs (force a chamber remount on change).
  const [ratio, setRatio] = useState(0.5);
  const [seed, setSeed] = useState(12345);
  const [day, setDay] = useState(50);
  const [stage, setStage] = useState<GrowthStage>("flowering");
  const [view, setView] = useState<ChamberView>("chamber");

  // Live inputs (read each frame by the renderer; no remount needed).
  const [climate, setClimate] = useState<ClimateInput>({ fan: 45, temp: 24, hum: 50, co2: 800 });
  const [conditions, setConditions] = useState<Set<ConditionKind>>(new Set());
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [copied, setCopied] = useState(false);

  // plant3d layer inspection (only affects the WebGL whole-plant renderer).
  const [layers, setLayers] = useState<PlantLayerVisibility>(DEFAULT_LAYERS);
  const [density3d, setDensity3d] = useState<PlantDensity>(DEFAULT_DENSITY_3D);

  // Morphology is driven by the indica/sativa archetype (morphologyFor); the full
  // 15-field tuner lives in the separate /dev/morphology panel.
  const morph = useMemo<Morphology>(() => morphologyFor(ratio), [ratio]);
  const silhouette = useMemo(() => silhouetteFor(undefined, ratio), [ratio]);
  const dev = useMemo(() => effectiveDev(stage, day), [stage, day]);
  const budColor = useMemo(() => budColorFor(seed, morph.hue), [seed, morph.hue]);
  const budDna = useMemo(() => budDnaFor(undefined, budColor), [budColor]);

  const conditionFlags = useMemo<ConditionFlag[]>(
    () => [...conditions].map((condition) => ({ condition, severity })),
    [conditions, severity],
  );

  // Remount only on STRUCTURAL change — climate + flags update live via the
  // renderer's per-frame LiveState, so they are intentionally excluded here.
  const chamberKey = `${ratio}|${seed}|${day}|${stage}|${view}`;

  function toggleCondition(c: ConditionKind) {
    setConditions((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
    setCopied(false);
  }

  function setClimateField(key: keyof ClimateInput, value: number) {
    setClimate((c) => ({ ...c, [key]: value }));
    setCopied(false);
  }

  function reset() {
    setRatio(0.5);
    setSeed(12345);
    setDay(50);
    setStage("flowering");
    setView("chamber");
    setClimate({ fan: 45, temp: 24, hum: 50, co2: 800 });
    setConditions(new Set());
    setSeverity("moderate");
    setLayers(DEFAULT_LAYERS);
    setDensity3d(DEFAULT_DENSITY_3D);
    setCopied(false);
  }

  async function copyReviewState() {
    const state = {
      indica_ratio: ratio,
      seed,
      day,
      stage,
      view,
      climate,
      conditionFlags,
      morphology: morph,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#050b12] text-[#cfeeff] lg:flex-row">
      {/* LEFT — live chamber */}
      <div className="relative min-h-[50vh] flex-1 lg:min-h-screen">
        {view === "plant3d" ? (
          <PlantGL
            indicaRatio={ratio}
            seed={seed}
            day={day}
            stage={stage}
            dev={dev}
            layers={layers}
            density={density3d}
          />
        ) : (
          <GrowChamber
            key={chamberKey}
            seed={seed}
            day={day}
            stage={stage}
            morphology={morph}
            silhouette={silhouette}
            dev={dev}
            budColor={budColor}
            budDna={budDna}
            climate={climate}
            conditionFlags={conditionFlags}
            view={view}
          />
        )}
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-cyan-400/40 bg-[#08141e]/70 px-2.5 py-1.5 font-mono text-[11px] tracking-wide backdrop-blur">
          PLANT VISUAL REVIEW · dev only · {stage} · day {day} · {view}
        </div>
      </div>

      {/* RIGHT — controls */}
      <div className="w-full flex-none space-y-3 overflow-y-auto border-t border-[#1c3447] p-4 lg:max-h-screen lg:w-[440px] lg:border-l lg:border-t-0">
        <div>
          <h1 className="font-mono text-sm font-bold tracking-[0.12em] text-cyan-200">
            PLANT VISUAL REVIEW BOARD
          </h1>
          <p className="mt-1 text-[11px] leading-relaxed text-[#7fa9bf]">
            Inspect the real <span className="text-cyan-200">&lt;GrowChamber&gt;</span> renderer
            across stage, day, morphology, view, climate, and condition states. Dev-only —
            players never see this. Reads nothing from the server.
          </p>
        </div>

        {/* Render context */}
        <div className="space-y-2">
          <p className={sectionLabel}>Render context</p>
          <Slider label="day" value={day} min={0} max={120} step={1} onChange={(v) => { setDay(v); setCopied(false); }} />
          <div className={`flex items-center gap-2.5 ${card}`}>
            <span className="w-[96px] flex-none font-mono text-[11px] text-[#7fa9bf]">stage</span>
            <select
              value={stage}
              onChange={(e) => { setStage(e.target.value as GrowthStage); setCopied(false); }}
              className="flex-1 rounded border border-[#1c3447] bg-[#08141e] px-2 py-1 font-mono text-xs text-white"
            >
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className={`flex items-center gap-2.5 ${card}`}>
            <span className="w-[96px] flex-none font-mono text-[11px] text-[#7fa9bf]">view</span>
            <div className="flex flex-1 gap-1">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setView(v); setCopied(false); }}
                  className={`flex-1 rounded px-2 py-1 font-mono text-[11px] ${view === v ? "bg-cyan-400/20 text-cyan-100 border border-cyan-400/40" : "bg-[#08141e] text-[#7fa9bf] border border-[#1c3447]"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className={`flex items-center gap-2.5 ${card}`}>
            <span className="w-[96px] flex-none font-mono text-[11px] text-[#7fa9bf]">seed</span>
            <input
              type="number"
              value={seed}
              onChange={(e) => { setSeed(Number(e.target.value) || 0); setCopied(false); }}
              aria-label="seed"
              className="flex-1 rounded border border-[#1c3447] bg-[#08141e] px-2 py-1 font-mono text-xs text-white"
            />
          </div>
        </div>

        {/* Morphology */}
        <div className="space-y-2">
          <p className={sectionLabel}>Morphology (indica ↔ sativa archetype)</p>
          <Slider label="indica_ratio" value={ratio} min={0} max={1} step={0.01} onChange={(v) => { setRatio(v); setCopied(false); }} />
          <p className="px-1 text-[10px] leading-relaxed text-[#5e8ba3]">
            Full per-field morphology tuning lives in <span className="text-[#7fa9bf]">/dev/morphology</span>.
          </p>
        </div>

        {/* 3D layer inspection — only affects the plant3d WebGL renderer */}
        {view === "plant3d" && (
          <div className="space-y-2">
            <p className={sectionLabel}>3D layers · construction model (plant3d only)</p>
            <div className="flex flex-wrap gap-1.5">
              {LAYER_TOGGLES.map(({ key, label }) => {
                const on = layers[key];
                const debug = key === "skeleton" || key === "nodes";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setLayers((p) => ({ ...p, [key]: !p[key] })); setCopied(false); }}
                    className={`rounded px-2 py-1 font-mono text-[11px] ${
                      on
                        ? debug
                          ? "bg-fuchsia-400/20 text-fuchsia-100 border border-fuchsia-400/40"
                          : "bg-cyan-400/20 text-cyan-100 border border-cyan-400/40"
                        : "bg-[#08141e] text-[#7fa9bf] border border-[#1c3447]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setLayers((p) => {
                  const all = Object.keys(p).reduce((a, k) => ({ ...a, [k]: k !== "skeleton" && k !== "nodes" }), {} as PlantLayerVisibility);
                  return all;
                }); setCopied(false); }}
                className="flex-1 rounded border border-[#1c3447] bg-[#08141e] px-2 py-1 font-mono text-[10px] text-[#7fa9bf] hover:bg-[#13283a]"
              >
                only plant
              </button>
              <button
                type="button"
                onClick={() => { setLayers(DEFAULT_LAYERS); setCopied(false); }}
                className="flex-1 rounded border border-[#1c3447] bg-[#08141e] px-2 py-1 font-mono text-[10px] text-[#7fa9bf] hover:bg-[#13283a]"
              >
                reset layers
              </button>
            </div>
            {DENSITY_FIELDS.map(({ key, label }) => (
              <Slider
                key={key}
                label={label}
                value={density3d[key]}
                min={0}
                max={3}
                step={0.1}
                onChange={(v) => { setDensity3d((p) => ({ ...p, [key]: v })); setCopied(false); }}
              />
            ))}
          </div>
        )}

        {/* Climate — wired */}
        <div className="space-y-2">
          <p className={sectionLabel}>Climate · wired ✓</p>
          {CLIMATE_FIELDS.map((f) => (
            <Slider
              key={f.key}
              label={f.label}
              value={climate[f.key]}
              min={f.min}
              max={f.max}
              step={f.step}
              onChange={(v) => setClimateField(f.key, v)}
            />
          ))}
        </div>

        {/* Condition / stress — wired */}
        <div className="space-y-2">
          <p className={sectionLabel}>Condition / stress · wired ✓ (whole-plant)</p>
          <div className="flex flex-wrap gap-1.5">
            {WIRED_CONDITIONS.map((c) => {
              const on = conditions.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCondition(c)}
                  className={`rounded px-2 py-1 font-mono text-[11px] ${on ? "bg-amber-400/20 text-amber-100 border border-amber-400/40" : "bg-[#08141e] text-[#7fa9bf] border border-[#1c3447]"}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <div className={`flex items-center gap-2.5 ${card}`}>
            <span className="w-[96px] flex-none font-mono text-[11px] text-[#7fa9bf]">severity</span>
            <div className="flex flex-1 gap-1">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSeverity(s); setCopied(false); }}
                  className={`flex-1 rounded px-2 py-1 font-mono text-[11px] ${severity === s ? "bg-amber-400/20 text-amber-100 border border-amber-400/40" : "bg-[#08141e] text-[#7fa9bf] border border-[#1c3447]"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <p className="px-1 text-[10px] leading-relaxed text-[#5e8ba3]">
            None selected = healthy baseline. Multiple flags allowed; the renderer picks the
            dominant body animation and layers overlays.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={copyReviewState}
            className="flex-1 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 font-mono text-xs font-bold tracking-[0.08em] text-cyan-200 hover:bg-cyan-400/20"
          >
            {copied ? "COPIED ✓" : "COPY REVIEW STATE"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex-1 rounded-lg border border-[#1c3447] bg-[#0d1d2b] px-3 py-2 font-mono text-xs font-bold tracking-[0.08em] text-[#7fa9bf] hover:bg-[#13283a]"
          >
            RESET
          </button>
        </div>

        {/* Honest wiring notes */}
        <div className="space-y-1.5 rounded-lg border border-[#1c3447] bg-[#08141e] p-3">
          <p className={sectionLabel}>Wired vs not-wired (honest)</p>
          <p className="text-[10px] leading-relaxed text-[#7fa9bf]">
            <span className="text-grow-300">Wired (this panel):</span> growth stage, nominal day,
            morphology archetype, chamber/macro view, climate (fan/temp/humidity/CO₂), and the
            condition flags above (droop / wilt / bug / mildew / rot / water-sheen overlays).
          </p>
          <p className="text-[10px] leading-relaxed text-[#7fa9bf]">
            <span className="text-amber-300">Wired in renderer, not exposed in v1:</span> water
            level &amp; light intensity (macro bud view, via applyEnvironmentToBudDNA);
            reduced-motion (the renderer auto-honors <span className="font-mono">prefers-reduced-motion</span>;
            it is not a component prop).
          </p>
          <p className="text-[10px] leading-relaxed text-[#7fa9bf]">
            <span className="text-red-300">Not wired to renderer (app-state / DOM only):</span>{" "}
            nutrients (nutrient_deficient / nutrient_burn set a body tint the canvas ignores),
            humidity-driven mold (no visual yet), overall health / is_alive (DOM health-meter +
            death overlay only), and AI-scout labels (advisor text only; no scout overlay
            component exists).
          </p>
        </div>
      </div>
    </div>
  );
}
