"use client";

// Plant-slot switcher: a pod holds up to four plants, and this is how you pick
// which one the rest of the Command Center (chamber, rails, care bar) shows.
// Previously a 3D arc "carousel" that rotated through the middle — it took a
// lot of vertical room, and with 4 plants the fanned-out ones could slide off
// the edge of a narrow viewport (owner feedback 2026-07-07: "let's come up
// with a better system than the plants that just go left and right at the
// top... it takes up a lot of room... anything it pushes all the way off to
// the right"). This is a flat, centered row of small slot buttons instead —
// same job (pick the active plant), a fraction of the space, nothing ever
// overflows off-screen since it wraps like any other flex row.

import { PlantVisual } from "@/components/plant/PlantVisual";
import { STAGE_INFO } from "@/lib/stageInfo";
import type { ConditionFlag, GrowthStage } from "@/lib/types";

export interface CarouselPlant {
  id: string;
  label: string;
  stage: GrowthStage;
  flags: ConditionFlag[];
  ended?: boolean;
}

export function PlantCarousel({
  plants,
  activeId,
  onSelect,
}: {
  plants: CarouselPlant[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (plants.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {plants.map((p, i) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            aria-pressed={active}
            aria-label={`Select ${p.label} (slot ${i + 1}, ${STAGE_INFO[p.stage].label})`}
            title={`${p.label} — ${STAGE_INFO[p.stage].label}`}
            className={`relative flex h-14 w-14 flex-none items-center justify-center rounded-xl border transition-all ${
              active
                ? "border-cyan-300/50 bg-cyan-400/10 shadow-[0_0_14px_rgba(80,200,255,0.35)]"
                : "border-cyan-400/15 bg-[#0b1b27]/60 opacity-70 hover:opacity-100"
            }`}
          >
            <PlantVisual stage={p.stage} flags={p.flags} size={34} />
            {p.ended && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#050b12]/70 text-base">
                {p.flags.some((f) => f.condition === "dead") ? "🥀" : "🌾"}
              </div>
            )}
            <span className="pointer-events-none absolute -right-1 -top-1 rounded-full border border-cyan-400/25 bg-[#08141e] px-1 text-[8px] font-bold text-cyan-200/80">
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}
