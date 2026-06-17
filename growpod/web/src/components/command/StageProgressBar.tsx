"use client";

import { STAGE_INFO, STAGE_ORDER } from "@/lib/stageInfo";
import type { GrowthStage } from "@/lib/types";

/**
 * The 6-step Seed → Harvest tracker (labelled), driven by the authoritative
 * forecast stage index. Generalized from StageTimeline's internal Stepper into
 * the wide HUD look the command center wants.
 */
export function StageProgressBar({ index }: { index: number }) {
  return (
    <div className="flex items-center">
      {STAGE_ORDER.map((s: GrowthStage, i) => {
        const done = i < index;
        const current = i === index;
        const last = i === STAGE_ORDER.length - 1;
        return (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  current
                    ? "bg-grow-400 shadow-glow-grow ring-2 ring-grow-500/40"
                    : done
                      ? "bg-grow-600"
                      : "bg-ink-600"
                }`}
              />
              <span
                className={`whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.08em] ${
                  current ? "text-grow-300" : done ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {STAGE_INFO[s].label}
              </span>
            </div>
            {!last && (
              <span
                aria-hidden
                className={`mx-1 -mt-4 h-px flex-1 ${done ? "bg-grow-600/70" : "bg-ink-600/60"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
