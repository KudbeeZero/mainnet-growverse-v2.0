"use client";

// The Care Deck — the things a grower reaches for most, lifted to the top of the
// Command Center: at-a-glance WATER + NUTRIENT levels and the care action bar
// (Water / Feed / Prune / Train / Inspect …). Was buried at the bottom before.

import { CommandActionBar } from "@/components/command/CommandActionBar";
import { VITAL_BAR, VITAL_TEXT, vitalSeverity } from "@/lib/vitals";
import { recommendedActionKey } from "@/lib/nextAction";
import type { PlantState } from "@/lib/types";

function VitalBar({ label, icon, pct }: { label: string; icon: string; pct: number }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  const sev = vitalSeverity(v);
  return (
    <div className="rounded-lg border border-[#15303f] bg-[#0b1b27] px-2.5 py-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 instrument-label text-[9px] text-cyan-200/60">
          <span aria-hidden>{icon}</span> {label}
        </span>
        <span className={`font-mono text-xs font-bold ${VITAL_TEXT[sev]}`}>{v}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-700" aria-hidden>
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${VITAL_BAR[sev]}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

export function CareDeck({ plant }: { plant: PlantState }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-cyan-400/15 bg-[#0b1b27]/40 p-2.5">
      <div className="grid grid-cols-2 gap-2">
        <VitalBar label="WATER" icon="💧" pct={plant.water_level} />
        <VitalBar label="NUTRIENTS" icon="🧪" pct={plant.nutrient_level} />
      </div>
      <CommandActionBar plant={plant} recommend={recommendedActionKey(plant)} />
    </div>
  );
}
