"use client";

// The center carousel: up to four plant "cylinders" you rotate through. The
// selected cylinder is featured (its full chamber render lives above this strip);
// picking another rotates it to the front and repopulates every rail + the action
// bar for that plant — all without leaving the screen. Four per row is the current
// cap (one pod = up to four plants).

import { PlantVisual } from "@/components/plant/PlantVisual";
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
  if (plants.length === 0) return null;

  const activeIdx = Math.max(0, plants.findIndex((p) => p.id === activeId));
  const multi = plants.length > 1;
  const rotate = (dir: 1 | -1) => {
    const next = (activeIdx + dir + plants.length) % plants.length;
    onSelect(plants[next].id);
  };

  const arrow =
    "flex h-9 w-9 flex-none items-center justify-center rounded-full border border-cyan-400/25 bg-[#0b1b27]/70 text-lg text-cyan-200 transition-colors hover:bg-cyan-400/15";

  return (
    <div className="flex items-center justify-center gap-2">
      {multi && (
        <button type="button" onClick={() => rotate(-1)} aria-label="Previous plant" className={arrow}>
          ‹
        </button>
      )}

      <div className="flex items-end justify-center gap-3">
        {plants.map((p) => {
          const active = p.id === activeId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              aria-pressed={active}
              aria-label={`Select ${p.label}`}
              className={`group flex flex-col items-center gap-1 transition-transform ${
                active ? "scale-105" : "opacity-70 hover:opacity-100"
              }`}
            >
              {/* glass cylinder */}
              <div
                className={`relative overflow-hidden rounded-[40%/12%] rounded-b-2xl border transition-all ${
                  active
                    ? "h-[112px] w-[84px] border-cyan-300/50 shadow-[0_0_22px_rgba(80,200,255,0.35)]"
                    : "h-[88px] w-[64px] border-cyan-400/20"
                }`}
                style={{
                  background:
                    "linear-gradient(180deg, rgba(140,210,255,0.18) 0%, rgba(20,40,55,0.55) 55%, rgba(10,22,32,0.8) 100%)",
                }}
              >
                {/* glass highlight */}
                <span className="pointer-events-none absolute left-1.5 top-1 h-[70%] w-2 rounded-full bg-white/25 blur-[1px]" />
                <div className="flex h-full items-end justify-center pb-1">
                  <PlantVisual stage={p.stage} flags={p.flags} size={active ? 56 : 40} />
                </div>
                {p.ended && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#050b12]/70 text-xl">
                    {p.flags.some((f) => f.condition === "dead") ? "🥀" : "🌾"}
                  </div>
                )}
              </div>
              <span
                className={`max-w-[88px] truncate text-[10px] font-semibold ${
                  active ? "text-cyan-100" : "text-cyan-300/60"
                }`}
              >
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      {multi && (
        <button type="button" onClick={() => rotate(1)} aria-label="Next plant" className={arrow}>
          ›
        </button>
      )}
    </div>
  );
}
