"use client";

import { useState } from "react";
import { usePlayerGear, useEquipGear } from "@/hooks/useGear";
import type { GearCategory, GearItem } from "@/lib/api/store";

const GEAR_ICONS: Record<GearCategory, string> = {
  light: "💡",
  fan: "💨",
  soil: "🌱",
};

const GEAR_LABELS: Record<GearCategory, string> = {
  light: "Lighting",
  fan: "Ventilation",
  soil: "Growing Medium",
};

export function GearPanel({ podId }: { podId: string }) {
  const { data: allGear = [], isLoading } = usePlayerGear();
  const equip = useEquipGear(podId);
  const [openCategory, setOpenCategory] = useState<GearCategory | null>(null);

  if (isLoading || allGear.length === 0) return null;

  // Only show light gear (fan/soil sim hooks pending Phase 2)
  const categories: GearCategory[] = ["light"];
  const gearByCategory = categories.reduce(
    (acc, cat) => {
      acc[cat] = allGear.filter((g) => g.category === cat);
      return acc;
    },
    {} as Record<GearCategory, GearItem[]>
  );

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-300">Equipment</h3>
      <div className="grid grid-cols-1 gap-2">
        {categories.map((cat) => {
          const gears = gearByCategory[cat];
          if (gears.length === 0) return null;

          const equipped = gears.find((g) => g.equipped_pod_id === podId);

          return (
            <div
              key={cat}
              className="rounded-lg border border-ink-700 bg-ink-900/60 p-2.5"
            >
              <button
                onClick={() => setOpenCategory(openCategory === cat ? null : cat)}
                className="w-full flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{GEAR_ICONS[cat]}</span>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-100">
                      {GEAR_LABELS[cat]}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {equipped
                        ? `${equipped.name} · ${equipped.owned > 1 ? `+${equipped.owned - 1} spare` : "1 owned"}`
                        : `${gears.length} available`}
                    </div>
                  </div>
                </div>
                <span className="text-[12px] text-gray-400">
                  {openCategory === cat ? "▼" : "▶"}
                </span>
              </button>

              {openCategory === cat && (
                <div className="mt-2 space-y-1.5 border-t border-ink-700 pt-2">
                  {gears.map((gear) => {
                    const isEquipped = gear.equipped_pod_id === podId;
                    const pending = equip.isPending && equip.variables === gear.key;
                    return (
                      <button
                        key={gear.key}
                        onClick={() => equip.mutate(gear.key)}
                        disabled={pending || isEquipped}
                        className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 border text-left transition-colors text-[11px] ${
                          isEquipped
                            ? "border-grow-400/60 bg-grow-500/20 cursor-default"
                            : pending
                              ? "border-amber-400/40 bg-amber-400/10 cursor-wait"
                              : "border-ink-600 bg-ink-800/40 hover:border-grow-400/40 hover:bg-grow-500/10 cursor-pointer"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-100">
                            {gear.name}
                          </div>
                          <div className="text-gray-500 truncate">
                            {gear.description}
                          </div>
                        </div>
                        <span className="shrink-0 rounded bg-ink-700 px-1.5 py-0.5 font-mono text-gray-400">
                          ×{gear.owned}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
