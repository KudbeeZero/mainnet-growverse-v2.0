"use client";

// DEV-ONLY Morphology Debug Panel — purely additive, never reachable in prod
// (the route's page.tsx 404s outside `NODE_ENV === "development"`).
//
// Two columns: LEFT renders the real <GrowChamber> against the morphology the
// developer is editing; RIGHT is a slider panel over every field of the
// `Morphology` interface plus seed/day/stage render context. It reads nothing
// from the server and writes nothing — pure local geometry preview.
//
// IMPORTANT (why the chamber has a `key`): GrowChamber only rebuilds its
// geometry when its internal buildKey changes, and that key folds in just a few
// morphology fields (pattern/hue/heightMul/clusterLen) — editing e.g. `stretch`
// or `bracts` would otherwise leave the captured geometry untouched. We must not
// modify GrowChamber, so we force a clean remount by keying it on a signature of
// the whole edited object; every field then visibly re-renders the plant.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ConditionFlag, GrowthStage } from "@/lib/types";
import {
  morphologyFor,
  effectiveDev,
  budColorFor,
  type Morphology,
  type BudPattern,
} from "@/lib/chamber/morphology";
import { silhouetteFor } from "@/lib/chamber/strainVisuals";
import { budDnaFor } from "@/lib/chamber/budDna";

const GrowChamber = dynamic(
  () => import("@/components/viz/GrowChamber").then((m) => m.GrowChamber),
  { ssr: false, loading: () => null },
);

type NumField = keyof Omit<Morphology, "pattern">;

interface FieldDef {
  key: NumField;
  min: number;
  max: number;
  step: number;
  /** Round to an integer on change (leafletMax / bracts are counts). */
  int?: boolean;
}

// Ranges are centred on the INDICA/SATIVA archetype values in morphology.ts so
// each slider's mid-travel lands near a real strain and the extremes stay sane.
const FIELDS: FieldDef[] = [
  { key: "hue", min: 0, max: 360, step: 1 },
  { key: "sat", min: 0, max: 100, step: 1 },
  { key: "lit", min: 0, max: 100, step: 1 },
  { key: "leafW", min: 0.2, max: 2, step: 0.01 },
  { key: "leafletMax", min: 1, max: 13, step: 1, int: true },
  { key: "heightMul", min: 0.4, max: 2, step: 0.01 },
  { key: "internode", min: 0, max: 0.3, step: 0.005 },
  { key: "branchMul", min: 0.3, max: 2, step: 0.01 },
  { key: "stretch", min: 0.5, max: 2, step: 0.01 },
  { key: "bracts", min: 1, max: 20, step: 1, int: true },
  { key: "clusterLen", min: 0.3, max: 2.5, step: 0.01 },
  { key: "clusterFat", min: 0.3, max: 2, step: 0.01 },
  { key: "flowerFrom", min: 0, max: 1, step: 0.01 },
  { key: "nodeBudFrac", min: 0, max: 1, step: 0.01 },
  { key: "foxtail", min: 0, max: 1, step: 0.01 },
];

const PATTERNS: BudPattern[] = ["spiral", "nodal", "hybrid"];
const STAGES: GrowthStage[] = [
  "seed",
  "germination",
  "seedling",
  "vegetative",
  "flowering",
  "harvest",
];

// Render-context defaults the chamber requires but the panel doesn't tune.
const CLIMATE = { fan: 45, temp: 24, hum: 50, co2: 800 };
const NO_FLAGS: ConditionFlag[] = [];

const card = "rounded-lg border border-[#1c3447] bg-[#0d1d2b] px-3 py-2";

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
      <span className="w-[88px] flex-none font-mono text-[11px] tracking-[0.04em] text-[#7fa9bf]">
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
        {Number.isInteger(value) ? value : value.toFixed(3)}
      </span>
    </div>
  );
}

export function MorphologyPanel() {
  const [ratio, setRatio] = useState(0.5);
  const [morph, setMorph] = useState<Morphology>(() => morphologyFor(0.5));
  const [seed, setSeed] = useState(12345);
  const [day, setDay] = useState(50);
  const [stage, setStage] = useState<GrowthStage>("flowering");
  const [copied, setCopied] = useState(false);

  // Derived chamber props (sane defaults the panel doesn't expose as sliders).
  const silhouette = useMemo(() => silhouetteFor(undefined, ratio), [ratio]);
  const dev = useMemo(() => effectiveDev(stage, day), [stage, day]);
  const budColor = useMemo(() => budColorFor(seed, morph.hue), [seed, morph.hue]);
  const budDna = useMemo(() => budDnaFor(undefined, budColor), [budColor]);

  // Remount key: rebuild the plant whenever ANY tuned input changes (see header).
  const chamberKey = `${JSON.stringify(morph)}|${seed}|${day}|${stage}`;

  function setField(key: NumField, raw: number, int?: boolean) {
    setMorph((m) => ({ ...m, [key]: int ? Math.round(raw) : raw }));
    setCopied(false);
  }

  function loadArchetype(r: number) {
    setRatio(r);
    setMorph(morphologyFor(r));
    setCopied(false);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(morph, null, 2));
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
          climate={CLIMATE}
          conditionFlags={NO_FLAGS}
          view="chamber"
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-cyan-400/40 bg-[#08141e]/70 px-2.5 py-1.5 font-mono text-[11px] tracking-wide backdrop-blur">
          MORPHOLOGY DEBUG · dev only
        </div>
      </div>

      {/* RIGHT — controls */}
      <div className="w-full flex-none space-y-3 overflow-y-auto border-t border-[#1c3447] p-4 lg:max-h-screen lg:w-[420px] lg:border-l lg:border-t-0">
        <div>
          <h1 className="font-mono text-sm font-bold tracking-[0.12em] text-cyan-200">
            MORPHOLOGY DEBUG PANEL
          </h1>
          <p className="mt-1 text-[11px] leading-relaxed text-[#7fa9bf]">
            Tune the strain morphology live, then Copy JSON to paste into
            strainVisuals.ts. Dev-only — players never see this.
          </p>
        </div>

        {/* A — load archetype */}
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5e8ba3]">
            Load archetype (indica_ratio)
          </p>
          <Slider
            label="indica_ratio"
            value={ratio}
            min={0}
            max={1}
            step={0.01}
            onChange={loadArchetype}
          />
        </div>

        {/* B — every numeric morphology field */}
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5e8ba3]">
            Morphology
          </p>
          {FIELDS.map((f) => (
            <Slider
              key={f.key}
              label={f.key}
              value={morph[f.key]}
              min={f.min}
              max={f.max}
              step={f.step}
              onChange={(v) => setField(f.key, v, f.int)}
            />
          ))}
          {/* C — pattern */}
          <div className={`flex items-center gap-2.5 ${card}`}>
            <span className="w-[88px] flex-none font-mono text-[11px] tracking-[0.04em] text-[#7fa9bf]">
              pattern
            </span>
            <select
              value={morph.pattern}
              onChange={(e) => {
                setMorph((m) => ({ ...m, pattern: e.target.value as BudPattern }));
                setCopied(false);
              }}
              className="flex-1 rounded border border-[#1c3447] bg-[#08141e] px-2 py-1 font-mono text-xs text-white"
            >
              {PATTERNS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* D — render context */}
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5e8ba3]">
            Render context
          </p>
          <div className={`flex items-center gap-2.5 ${card}`}>
            <span className="w-[88px] flex-none font-mono text-[11px] tracking-[0.04em] text-[#7fa9bf]">
              seed
            </span>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 0)}
              aria-label="seed"
              className="flex-1 rounded border border-[#1c3447] bg-[#08141e] px-2 py-1 font-mono text-xs text-white"
            />
          </div>
          <Slider label="day" value={day} min={0} max={120} step={1} onChange={setDay} />
          <div className={`flex items-center gap-2.5 ${card}`}>
            <span className="w-[88px] flex-none font-mono text-[11px] tracking-[0.04em] text-[#7fa9bf]">
              stage
            </span>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as GrowthStage)}
              className="flex-1 rounded border border-[#1c3447] bg-[#08141e] px-2 py-1 font-mono text-xs text-white"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* E/F — actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={copyJson}
            className="flex-1 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 font-mono text-xs font-bold tracking-[0.08em] text-cyan-200 hover:bg-cyan-400/20"
          >
            {copied ? "COPIED ✓" : "COPY JSON"}
          </button>
          <button
            type="button"
            onClick={() => loadArchetype(ratio)}
            className="flex-1 rounded-lg border border-[#1c3447] bg-[#0d1d2b] px-3 py-2 font-mono text-xs font-bold tracking-[0.08em] text-[#7fa9bf] hover:bg-[#13283a]"
          >
            RESET TO ARCHETYPE
          </button>
        </div>

        <pre className="overflow-x-auto rounded-lg border border-[#1c3447] bg-[#08141e] p-2.5 font-mono text-[10px] leading-relaxed text-[#7fa9bf]">
          {JSON.stringify(morph, null, 2)}
        </pre>
      </div>
    </div>
  );
}
