"use client";

// "Where this grow is at" — the per-stage grower guidance the strain/seed view
// has, brought onto the Command Center. Shows the current stage's icon + label,
// a progress bar through the stage, and the plain-language "what's happening /
// what to do" blurb.

import { STAGE_INFO } from "@/lib/stageInfo";
import type { GrowthStage } from "@/lib/types";

export function StageInfoCard({
  stage,
  progressPct,
}: {
  stage: GrowthStage;
  progressPct: number | null;
}) {
  const info = STAGE_INFO[stage];
  if (!info) return null;
  const pct = progressPct == null ? null : Math.max(0, Math.min(100, Math.round(progressPct)));
  const showBar = pct != null;

  return (
    <div className="rounded-xl border border-cyan-400/15 bg-[#0b1b27]/50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-cyan-100">
          <span aria-hidden>{info.icon}</span> {info.label}
        </span>
        <span className="font-mono text-[10px] text-cyan-200/55">
          {showBar ? `${pct}% through stage` : ""}
        </span>
      </div>
      {showBar && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink-700" aria-hidden>
          <div
            className="h-full rounded-full bg-grow-500 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p className="mt-1.5 text-[10px] leading-snug text-cyan-200/60">{info.blurb}</p>
    </div>
  );
}
