"use client";

// DNA-driven plant growth journey — the lifecycle visualization.
//
// Renders the SAME genetics-derived plant (one fixed seed / morphology /
// silhouette / bud DNA) at every growth stage from seed through harvest, so a
// player can see how THIS plant's unique genetics express across its whole life
// — and scrub the timeline to watch it grow. The live plant highlights its
// current stage; the rest are nominal snapshots from the strain's cycle.
//
// Driven entirely by the canonical plantRender() outputs, so what you see here
// is identical to the chamber / command / card render of the same plant — the
// DNA is the single source of truth.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/Card";
import { STAGE_ORDER, STAGE_INFO } from "@/lib/stageInfo";
import {
  cycleDays,
  previewDev,
  stageForDay,
} from "@/lib/chamber/morphology";
import type { GrowthStage } from "@/lib/types";
import type { PlantRender } from "@/lib/plantRender";
import { hours } from "@/lib/format";

// Canvas-only (touches window); lazy so this heavy-ish component stays out of
// the initial plant-detail bundle until the player scrolls it into view.
const GrowChamber = dynamic(
  () => import("@/components/viz/GrowChamber").then((m) => m.GrowChamber),
  { ssr: false, loading: () => null },
);

interface Props {
  render: PlantRender;
  /** Deterministic seed for this plant (drives all DNA-unique variation). */
  seed: number;
  /** Authoritative current stage, highlighted in the journey. */
  currentStage: string;
  /** Nominal grow day of the live plant (where to position the scrubber). */
  liveNominalDay: number;
  climate: { fan: number; temp: number; hum: number; co2: number };
  reducedMotion?: boolean;
}

export function GrowthJourney({
  render,
  seed,
  currentStage,
  liveNominalDay,
  climate,
  reducedMotion = false,
}: Props) {
  const { morphology, silhouette, budColor, budDna, flMid } = render;
  const totalDays = cycleDays(flMid);

  // One representative nominal day per stage (midpoint of the stage's window).
  const stageDays = useMemo(() => {
    const points: Array<{ stage: GrowthStage; day: number }> = [];
    for (const stage of STAGE_ORDER) {
      // Find a day that maps back to this stage; search the cycle coarsely.
      let pick = 0;
      for (let d = 0; d <= totalDays; d += 1) {
        if (stageForDay(d, flMid) === stage) {
          pick = d;
          break;
        }
      }
      points.push({ stage, day: pick });
    }
    return points;
  }, [totalDays, flMid]);

  const [scrubDay, setScrubDay] = useState(liveNominalDay);
  const scrubStage = stageForDay(scrubDay, flMid);
  const scrubDev = previewDev(scrubDay, flMid);
  const scrubInfo = STAGE_INFO[scrubStage];

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">Growth journey</h3>
          <p className="text-[11px] text-gray-500">
            This plant&apos;s genetics, from seed to harvest
          </p>
        </div>
        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-cyan-200">
          DNA #{seed.toString(16).slice(0, 6)}
        </span>
      </div>

      {/* Interactive scrubber — watch THIS plant grow. */}
      <div className="mt-3 space-y-2 rounded-lg border border-ink-700 bg-[#050b12] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              {scrubInfo.icon}
            </span>
            <div>
              <div className="text-sm font-bold text-gray-100">{scrubInfo.label}</div>
              <div className="text-[10px] text-gray-500">
                Day {Math.round(scrubDay)} of {Math.round(totalDays)} · {scrubStage === currentStage ? "live now" : "preview"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScrubDay(liveNominalDay)}
            className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:border-cyan-500/50 hover:text-cyan-200"
          >
            ⏩ Jump to live
          </button>
        </div>

        <div className="relative h-44 w-full overflow-hidden rounded-lg bg-[#050b12]">
          <GrowChamber
            seed={seed}
            day={scrubDay}
            stage={scrubStage}
            morphology={morphology}
            silhouette={silhouette}
            dev={scrubDev}
            budColor={budColor}
            budDna={budDna}
            climate={climate}
            conditionFlags={[]}
            view="chamber"
          />
        </div>

        <input
          type="range"
          min={0}
          max={totalDays}
          step={1}
          value={scrubDay}
          onChange={(e) => setScrubDay(Number(e.target.value))}
          aria-label="Scrub plant growth timeline"
          className="h-2 w-full cursor-pointer accent-cyan-400"
        />
        <div className="flex justify-between text-[9px] text-gray-600">
          <span>Seed</span>
          <span>Harvest</span>
        </div>
      </div>

      {/* Stage gallery — the full DNA expression across the lifecycle. */}
      <div className="mt-3">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {stageDays.map(({ stage, day }) => {
            const info = STAGE_INFO[stage];
            const isCurrent = stage === currentStage;
            const isScrub = stage === scrubStage;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setScrubDay(day)}
                className={`group flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
                  isCurrent
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : isScrub
                      ? "border-ink-500 bg-ink-800"
                      : "border-ink-700 bg-ink-900/50 hover:border-ink-500"
                }`}
                title={`${info.label} — Day ${day}`}
              >
                <div className="relative h-16 w-full overflow-hidden rounded bg-[#050b12]">
                  <GrowChamber
                    seed={seed}
                    day={day}
                    stage={stage}
                    morphology={morphology}
                    silhouette={silhouette}
                    dev={previewDev(day, flMid)}
                    budColor={budColor}
                    budDna={budDna}
                    climate={climate}
                    conditionFlags={[]}
                    view="chamber"
                  />
                </div>
                <span className="text-[10px] leading-tight text-gray-400 group-hover:text-gray-200">
                  {info.icon} {info.label}
                </span>
                {isCurrent && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-cyan-400 ring-2 ring-[#050b12]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
        {scrubInfo.blurb}{" "}
        At full health this cycle runs {hours(totalDays * 24)}.
        {scrubStage === currentStage && " This is the plant's current stage."}
      </p>
    </Card>
  );
}
