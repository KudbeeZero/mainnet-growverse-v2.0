"use client";

// GROVERS Grow Chamber — a hand-rolled Canvas 2D render of a living cannabis
// plant inside an orbital grow pod. Ported from the standalone chamber mockup
// and bound to real plant state: morphology comes from the strain's indica_ratio,
// development is gated on the authoritative growth_stage, and condition_flags
// drive overlays/tint. Mirrors Constellation.tsx (refs + effect + ResizeObserver
// + reduced-motion + RAF cleanup) and honours the strict CSP (no eval/externals).
//
// The rendering/build/physics logic now lives in a framework-agnostic core
// (`@/lib/chamber/chamberCore`) so it can be driven both by this component and a
// headless Node script. This component is thin DOM glue: it sizes the canvas,
// owns the DPR transform + pointer/RAF/observer plumbing, and delegates drawing.
//
// Geometry-affecting inputs (seed/stage/day/morphology/view) rebuild the plant
// in the keyed effect; fast-changing climate/dev/flags are read from refs each
// frame so dragging a slider never rebuilds the geometry.

import { useEffect, useRef } from "react";
import type { ConditionFlag, GrowthStage } from "@/lib/types";
import type {
  DevParams,
  Morphology,
  BudColor,
  Silhouette,
  ClimateInput,
} from "@/lib/chamber/morphology";
import type { BudDNA } from "@/lib/chamber/budDna";
import {
  createChamberCore,
  type ChamberView,
  type LiveState,
} from "@/lib/chamber/chamberCore";

export type { ChamberView };

interface Props {
  seed: number;
  day: number;
  stage: GrowthStage;
  morphology: Morphology;
  /** Per-strain whole-plant skeleton shape (node density, spread, cola mass). */
  silhouette: Silhouette;
  dev: DevParams;
  climate: ClimateInput;
  conditionFlags: ConditionFlag[];
  view: ChamberView;
  /** Per-strain calyx/pistil colouring (green→amber ↔ anthocyanin purple). */
  budColor: BudColor;
  /** Per-strain macro bud measurements + palette (drives the Detailed Bud View). */
  budDna: BudDNA;
  className?: string;
}

export function GrowChamber({
  seed,
  day,
  stage,
  morphology,
  silhouette,
  dev,
  climate,
  conditionFlags,
  view,
  budColor,
  budDna,
  className = "",
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fast-changing inputs read each frame (no geometry rebuild on slider moves).
  const live = useRef<LiveState>({ climate, dev, flags: conditionFlags, budColor, budDna });
  live.current = { climate, dev, flags: conditionFlags, budColor, budDna };

  // Rebuild geometry only when these structural inputs change.
  // Macro geometry ignores `day` (buildMacro is seeded only by `seed`), so omit
  // it there — otherwise scrubbing the growth slider would rebuild identical
  // geometry on every integer-day step.
  const dayKey = view === "macro" ? "" : Math.round(day);
  // Macro geometry depends on the (env-modified) bud DNA; fold a coarse signature
  // in so the cola rebuilds when grow conditions shift it, but not every frame.
  const dnaKey =
    view === "macro"
      ? [
          budDna.maxBudWidth.toFixed(0),
          budDna.calyxSizeMax.toFixed(1),
          budDna.overlap.toFixed(2),
          budDna.trichomeDensity.toFixed(2),
          (budDna.foxtailBias ?? 0).toFixed(2),
          (budDna.topStretch ?? 0).toFixed(2),
          // palette colour signature so drought-darkening / cool-night purple and
          // different strains with equal palette length each trigger a rebuild.
          budDna.palette.map((p) => `${p.hue | 0}:${p.lit | 0}`).join(","),
        ].join("|")
      : "";
  // Silhouette signature (chamber skeleton shape) folds into the rebuild key so a
  // strain's node density / spread / cola mass rebuilds the plant, not every frame.
  const silKey = `${silhouette.nodeDensity.toFixed(2)}|${silhouette.vertStack.toFixed(2)}|${silhouette.branchletFrac.toFixed(2)}|${silhouette.lowerSpread.toFixed(2)}|${silhouette.upperShorten.toFixed(2)}|${silhouette.colaScale.toFixed(2)}|${silhouette.nodeLeaf.toFixed(2)}`;
  const buildKey = `${seed}|${stage}|${view}|${dayKey}|${dnaKey}|${silKey}|${morphology.pattern}|${morphology.hue.toFixed(1)}|${morphology.heightMul.toFixed(2)}|${morphology.clusterLen.toFixed(2)}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motionOK =
      typeof window === "undefined" ||
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const core = createChamberCore({ ctx, motionOK, seed, day, stage, morphology, silhouette, view, live });

    function fit() {
      const r = wrap!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = r.width;
      const H = r.height || 480;
      canvas!.width = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      canvas!.style.width = `${W}px`;
      canvas!.style.height = `${H}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      core.setSize(W, H);
    }

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    // pointer brush
    function onDown(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      core.pointerDown(e.clientX - rect.left, e.clientY - rect.top);
      try {
        canvas!.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      core.pointerMove(e.clientX - rect.left, e.clientY - rect.top, performance.now());
    }
    function onUp() {
      core.pointerUp();
    }

    let raf = 0;
    let last = 0;
    let visible = true;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      if (t - last >= 33) {
        last = t;
        core.step(dt);
        core.draw(t / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    // Pause the RAF loop while the canvas is scrolled offscreen. The strain-lab
    // hero is always mounted across tabs, so this stops it burning ~30fps redraws
    // when it isn't even visible (browsers already pause RAF on a hidden tab).
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.some((e) => e.isIntersecting);
        if (vis === visible) return;
        visible = vis;
        if (vis && motionOK && !raf) {
          last = 0;
          raf = requestAnimationFrame(loop);
        } else if (!vis && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 },
    );
    if (motionOK) {
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      io.observe(wrap);
      raf = requestAnimationFrame(loop);
    } else {
      core.draw(0);
    }

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildKey]);

  return (
    <div ref={wrapRef} className={`canvas-dark relative h-full w-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="block touch-none" />
    </div>
  );
}
