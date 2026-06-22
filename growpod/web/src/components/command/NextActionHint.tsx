"use client";

// The single most useful thing to do for this plant right now — a glanceable
// chip at the top of the Command Center. Pure read of plant state (no backend);
// when nothing needs doing it reads calm and green.

import { nextAction, type ActionKind } from "@/lib/nextAction";
import type { PlantState } from "@/lib/types";

const ICON: Record<ActionKind, string> = {
  water: "💧",
  feed: "🧪",
  ease_water: "🌬️",
  flush: "🚿",
  inspect: "🔍",
  harvest: "🌾",
};

export function NextActionHint({ plant }: { plant: PlantState }) {
  const action = nextAction(plant);

  if (!action) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-grow-500/25 bg-grow-900/20 px-3 py-2">
        <span className="text-base" aria-hidden>✅</span>
        <span className="text-[11px] font-semibold text-grow-200">
          Looking healthy — nothing needs doing right now.
        </span>
      </div>
    );
  }

  const tone =
    action.urgency === "high"
      ? "border-red-500/40 bg-red-500/10 text-red-200"
      : action.urgency === "med"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
        : "border-cyan-400/30 bg-cyan-400/[0.07] text-cyan-100";

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${tone}`}>
      <span className="text-base" aria-hidden>{ICON[action.kind]}</span>
      <span className="instrument-label text-[9px] opacity-70">DO NEXT</span>
      <span className="text-[12px] font-bold">{action.label}</span>
      <span className="truncate text-[11px] opacity-80">— {action.reason}</span>
    </div>
  );
}
