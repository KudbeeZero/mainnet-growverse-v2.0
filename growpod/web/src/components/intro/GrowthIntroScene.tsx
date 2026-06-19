"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ConditionFlag, GrowthStage } from "@/lib/types";
import {
  morphologyFor,
  previewDev,
  seedForPlant,
} from "@/lib/chamber/morphology";
import { silhouetteFor, budColorForStrain } from "@/lib/chamber/strainVisuals";
import { budDnaFor } from "@/lib/chamber/budDna";
import { AgentBubble } from "./AgentBubble";
import { SpecialistModal } from "./SpecialistModal";
import {
  AGENT_FINDINGS,
  SCENE_DURATION_MS,
  STAGE_TIMELINE,
  type AgentFinding,
} from "./introScript";

const TICK_MS = 120;

// The canonical GrowVerse plant renderer (Canvas 2D). Client-only — it owns a
// canvas + RAF loop and reads `window`. Same dynamic import the dashboard uses.
const GrowChamber = dynamic(
  () => import("@/components/viz/GrowChamber").then((m) => m.GrowChamber),
  { ssr: false, loading: () => null },
);

// Nominal grow-day per lifecycle stage, so the real renderer develops the plant
// (veg → flowering geometry, bud fill) as the cinematic timeline advances.
const STAGE_DAY: Record<GrowthStage, number> = {
  seed: 1,
  germination: 4,
  seedling: 12,
  vegetative: 30,
  flowering: 56,
  late_flower: 66,
  harvest: 72,
};

/** Read the user's reduced-motion preference (SSR-safe). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Last stage whose start time has elapsed. */
function stageAt(elapsed: number): GrowthStage {
  let stage: GrowthStage = STAGE_TIMELINE[0].stage;
  for (const step of STAGE_TIMELINE) {
    if (elapsed >= step.atMs) stage = step.stage;
  }
  return stage;
}

/**
 * Cinematic intro: a real GrowVerse plant (rendered by the canonical
 * `GrowChamber`) develops through its stages while AI scout cards pop up one
 * after another, recognize conditions on it, "think", and offer to summon a
 * specialist (mock confirm in Phase 1). Self-contained and deterministic; no
 * backend calls. Honors prefers-reduced-motion (GrowChamber draws a single
 * static frame; the scene jumps to the resolved stage).
 */
export function GrowthIntroScene() {
  const reduced = usePrefersReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const [runId, setRunId] = useState(0); // bump to replay (also remounts agents)
  const [active, setActive] = useState<AgentFinding | null>(null);

  // Drive the timeline. Reduced motion jumps straight to the resolved frame.
  useEffect(() => {
    if (reduced) {
      setElapsed(SCENE_DURATION_MS);
      return;
    }
    setElapsed(0);
    const start = Date.now();
    const id = setInterval(() => {
      const t = Date.now() - start;
      if (t >= SCENE_DURATION_MS) {
        setElapsed(SCENE_DURATION_MS);
        clearInterval(id);
      } else {
        setElapsed(t);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [reduced, runId]);

  const stage = stageAt(elapsed);
  const visibleFindings = AGENT_FINDINGS.filter((f) => elapsed >= f.atMs);

  // The plant visibly carries what the scouts have found (bugs, mildew, …).
  const flags = useMemo<ConditionFlag[]>(() => {
    if (!visibleFindings.length) return [{ condition: "healthy", severity: "mild" }];
    return visibleFindings.map((f) => ({ condition: f.condition, severity: "mild" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFindings.map((f) => f.id).join(",")]);

  // Stable per-plant render inputs (strain-agnostic defaults — no backend). The
  // helpers all accept an undefined strain, so this is the same fallback the
  // dashboard uses when a strain isn't loaded.
  const render = useMemo(() => {
    const indica = 0.5;
    const morphology = morphologyFor(indica);
    const silhouette = silhouetteFor(undefined, indica);
    const seed = seedForPlant("grovers-onboarding-hero");
    const budColor = budColorForStrain(undefined, morphology.hue, seed);
    const budDna = budDnaFor(undefined, budColor, undefined);
    return { morphology, silhouette, seed, budColor, budDna };
  }, []);

  const day = STAGE_DAY[stage];
  const dev = previewDev(day, 60);
  const finished = elapsed >= SCENE_DURATION_MS;

  return (
    <div className="select-none">
      {/* Real plant (hero) beside a clean scout column on desktop; stacked on
          mobile. Normal flow keeps the scout cards from ever overlapping the
          wordmark, each other, or clipping off-screen. The column reserves its
          final height so the plant doesn't jump as cards pop in. */}
      <div
        className="mx-auto flex max-w-[470px] flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-6"
        aria-label="A growing plant inspected by AI scouts"
      >
        <div className="h-[280px] w-[210px] shrink-0 overflow-hidden rounded-2xl border border-ink-700 bg-[#050b12] shadow-lg">
          <GrowChamber
            seed={render.seed}
            day={day}
            stage={stage}
            morphology={render.morphology}
            silhouette={render.silhouette}
            dev={dev}
            climate={{ fan: 45, temp: 24, hum: 50, co2: 800 }}
            conditionFlags={flags}
            view="chamber"
            budColor={render.budColor}
            budDna={render.budDna}
          />
        </div>

        <div className="flex w-full max-w-[230px] flex-col gap-2 sm:min-h-[360px] sm:justify-center">
          {visibleFindings.map((f) => (
            <AgentBubble
              key={`${runId}-${f.id}`}
              finding={f}
              reduced={reduced}
              onRequest={setActive}
            />
          ))}
        </div>
      </div>

      {/* Replay affordance once the scene settles (hidden under reduced motion). */}
      {finished && !reduced && (
        <div className="mt-3 text-center motion-reduce:hidden">
          <button
            onClick={() => setRunId((n) => n + 1)}
            className="instrument-label text-gray-500 transition-colors hover:text-gray-300"
          >
            ↻ Replay
          </button>
        </div>
      )}

      <SpecialistModal
        finding={active}
        open={active !== null}
        onClose={() => setActive(null)}
      />
    </div>
  );
}
