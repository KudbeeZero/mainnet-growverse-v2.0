"use client";

import type { CSSProperties } from "react";
import type { ConditionFlag, GrowthStage } from "@/lib/types";
import {
  CONDITION_VISUALS,
  SEVERITY_SCALE,
  dominantFlag,
  type Overlay,
} from "@/lib/conditionVisuals";

const STAGE_SCALE: Record<GrowthStage, number> = {
  seed: 0.35,
  germination: 0.45,
  seedling: 0.6,
  vegetative: 0.85,
  flowering: 1,
  harvest: 1,
};

function BugOverlay() {
  return (
    <g className="gpe-bug" fill="#1a1a1a">
      <circle cx="40" cy="70" r="2.4" />
      <circle cx="62" cy="58" r="2.4" />
      <circle cx="52" cy="80" r="2.4" />
      <circle cx="70" cy="74" r="2.4" />
      <circle cx="34" cy="60" r="2.4" />
    </g>
  );
}

function MildewOverlay() {
  return (
    <g className="gpe-mildew" fill="#e8edf2">
      <circle cx="44" cy="62" r="5" opacity="0.7" />
      <circle cx="58" cy="54" r="6" opacity="0.6" />
      <circle cx="52" cy="72" r="7" opacity="0.5" />
      <circle cx="66" cy="66" r="4" opacity="0.6" />
    </g>
  );
}

function Overlays({ overlay }: { overlay: Overlay }) {
  if (overlay === "bugs") return <BugOverlay />;
  if (overlay === "mildew") return <MildewOverlay />;
  if (overlay === "water-sheen")
    return (
      <rect
        className="gpe-sheen"
        x="10"
        y="20"
        width="30"
        height="90"
        fill="url(#sheen)"
        opacity="0.5"
      />
    );
  if (overlay === "rot")
    return <ellipse cx="50" cy="104" rx="22" ry="6" fill="#3b2f23" opacity="0.8" />;
  return null;
}

export function PlantVisual({
  stage,
  flags,
  size = 140,
}: {
  stage: GrowthStage;
  flags: ConditionFlag[];
  size?: number;
}) {
  const dom = dominantFlag(flags);
  const visual = CONDITION_VISUALS[dom.condition];
  const stress = SEVERITY_SCALE[dom.severity];
  const scale = STAGE_SCALE[stage];
  const leafFill = visual.tint ?? "#4f9e1f";

  const bodyStyle: CSSProperties = { ["--stress" as string]: stress };

  // Overlays from ALL flags (deduped by overlay kind).
  const overlays = Array.from(
    new Set(flags.map((f) => CONDITION_VISUALS[f.condition].overlay)),
  ).filter((o) => o !== "none") as Overlay[];

  return (
    <svg
      viewBox="0 0 100 120"
      width={size}
      height={size * 1.2}
      className="select-none"
      role="img"
      aria-label={visual.label}
    >
      <defs>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9fd4ff" stopOpacity="0" />
          <stop offset="50%" stopColor="#cdeaff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#9fd4ff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* pot */}
      <path d="M32 104 L68 104 L63 118 L37 118 Z" fill="#7a4a2b" />
      <rect x="30" y="100" width="40" height="6" rx="2" fill="#8a5733" />

      {/* soil */}
      <ellipse cx="50" cy="102" rx="18" ry="3.5" fill="#3a2a1c" />

      {/* plant body (scaled by stage, animated by dominant flag) */}
      <g
        className={`gpe-body gpe-anim-${visual.bodyAnim}`}
        style={bodyStyle}
        transform={`translate(50 102) scale(${scale}) translate(-50 -102)`}
      >
        {/* stem */}
        <rect x="48.5" y="48" width="3" height="56" rx="1.5" fill="#3f7d1a" />
        {/* leaves */}
        <g fill={leafFill}>
          <ellipse cx="36" cy="64" rx="14" ry="6" transform="rotate(-28 36 64)" />
          <ellipse cx="64" cy="58" rx="14" ry="6" transform="rotate(28 64 58)" />
          <ellipse cx="34" cy="82" rx="12" ry="5" transform="rotate(-22 34 82)" />
          <ellipse cx="66" cy="78" rx="12" ry="5" transform="rotate(22 66 78)" />
          <ellipse cx="50" cy="46" rx="9" ry="14" />
        </g>
        {/* flower buds in flowering/harvest */}
        {(stage === "flowering" || stage === "harvest") && dom.condition !== "dead" && (
          <g fill="#8bc34a">
            <circle cx="50" cy="40" r="6" />
            <circle cx="42" cy="50" r="4" />
            <circle cx="58" cy="50" r="4" />
          </g>
        )}
      </g>

      {/* condition overlays (not scaled, drawn over everything) */}
      {overlays.map((o) => (
        <Overlays key={o} overlay={o} />
      ))}
    </svg>
  );
}
