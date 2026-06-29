"use client";

// Arcade Mode — NutrientPop FX overlay.
//
// A CSS-only particle/FX layer that sits absolutely over the BudGL canvas. It draws
// boost bursts, stage-unlock rings and an ambient trichome shimmer. NO canvas, NO
// Three.js geometry, NO draw-call impact — just self-cleaning <div>s. All FX are
// skipped under prefers-reduced-motion. Screen shake lives in BudGL (it owns the
// canvas wrapper); this overlay handles everything else.

import { useEffect, useRef, useState } from "react";
import {
  BOOST_APPLIED_EVENT,
  BOOST_COLORS,
  type BoostApplyDetail,
  type BoostType,
} from "@/lib/arcade/boostEngine";

// Stage-unlock ring color by the stage being entered.
function stageColor(stage: string): string {
  if (stage === "germination" || stage === "seedling") return "#a3e635"; // lime
  if (stage === "vegetative") return "#22c55e"; // green
  if (stage === "flowering" || stage === "late_flower") return "#c084fc"; // purple
  if (stage === "harvest") return "#f59e0b"; // amber
  return "#38bdf8"; // cyan default
}

const SHAPES = ["circle", "droplet", "crystal", "leaf"] as const;
type Shape = (typeof SHAPES)[number];

function shapeStyle(shape: Shape): React.CSSProperties {
  switch (shape) {
    case "circle":
      return { borderRadius: "9999px" };
    case "droplet":
      return { borderRadius: "50% 50% 50% 0" };
    case "crystal":
      return { borderRadius: "2px", transform: "rotate(45deg)" };
    case "leaf":
      return { borderRadius: "0 60% 0 60%" };
  }
}

interface Particle {
  id: number;
  angle: number; // deg
  dist: number; // px
  dur: number; // ms
  size: number; // px
  color: string;
  shape: Shape;
}

interface Burst {
  id: number;
  particles: Particle[];
}

interface Ring {
  id: number;
  color: string;
}

let _seq = 0;
const nextId = () => ++_seq;

function makeBurst(type: BoostType): Burst {
  const [c1, c2] = BOOST_COLORS[type];
  const particles: Particle[] = Array.from({ length: 24 }, () => ({
    id: nextId(),
    angle: Math.random() * 360,
    dist: 40 + Math.random() * 80,
    dur: 600 + Math.random() * 300,
    size: 6 + Math.random() * 4,
    color: Math.random() < 0.5 ? c1 : c2,
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
  }));
  return { id: nextId(), particles };
}

export function NutrientPop({
  stage,
  reducedMotion = false,
}: {
  /** Current growth stage — a change spawns a stage-unlock ring burst. */
  stage?: string;
  reducedMotion?: boolean;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [rings, setRings] = useState<Ring[]>([]);
  const prevStage = useRef<string | undefined>(stage);

  // Boost bursts — listen for the global boost event.
  useEffect(() => {
    if (reducedMotion) return;
    function onBoost(e: Event) {
      const detail = (e as CustomEvent<BoostApplyDetail>).detail;
      if (!detail) return;
      const burst = makeBurst(detail.type);
      setBursts((b) => [...b, burst]);
      // Self-clean after the longest particle finishes (+ buffer).
      window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== burst.id)), 1000);
    }
    window.addEventListener(BOOST_APPLIED_EVENT, onBoost);
    return () => window.removeEventListener(BOOST_APPLIED_EVENT, onBoost);
  }, [reducedMotion]);

  // Stage-unlock ring burst on stage transition.
  useEffect(() => {
    if (reducedMotion) {
      prevStage.current = stage;
      return;
    }
    if (stage && prevStage.current && stage !== prevStage.current) {
      const ring: Ring = { id: nextId(), color: stageColor(stage) };
      setRings((r) => [...r, ring]);
      window.setTimeout(() => setRings((r) => r.filter((x) => x.id !== ring.id)), 1100);
    }
    prevStage.current = stage;
  }, [stage, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {/* Ambient trichome shimmer sweep. */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="gpe-arcade-shimmer absolute inset-y-0 -left-1/3 w-1/3"
          style={{
            background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.5), transparent)",
          }}
        />
      </div>

      {/* Boost particle bursts, centred on the bud. */}
      {bursts.map((burst) => (
        <div key={burst.id} className="absolute left-1/2 top-1/2 h-0 w-0">
          {burst.particles.map((p) => (
            <span
              key={p.id}
              className="gpe-arcade-particle absolute block"
              style={
                {
                  width: p.size,
                  height: p.size,
                  marginLeft: -p.size / 2,
                  marginTop: -p.size / 2,
                  background: p.color,
                  boxShadow: `0 0 6px ${p.color}`,
                  "--angle": `${p.angle}deg`,
                  "--dist": `${p.dist}px`,
                  "--dur": `${p.dur}ms`,
                  ...shapeStyle(p.shape),
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ))}

      {/* Stage-unlock concentric rings. */}
      {rings.map((ring) => (
        <div key={ring.id} className="absolute left-1/2 top-1/2 h-0 w-0">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="gpe-arcade-ring absolute block rounded-full border-2"
              style={{
                width: 80,
                height: 80,
                marginLeft: -40,
                marginTop: -40,
                borderColor: ring.color,
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
