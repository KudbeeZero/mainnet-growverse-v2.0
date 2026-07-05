"use client";

import { useState } from "react";
import { BoostsInline } from "./ChamberDock";
import { GearPanel } from "./GearPanel";
import { ConsumablesPanel } from "./ConsumablesPanel";
import { BundlePanel } from "./BundlePanel";
import { PartnerPanel } from "./PartnerPanel";
import type { Plant } from "@/lib/types";
import type { UseMutationResult } from "@tanstack/react-query";

interface ArcadeToolbarProps {
  plant: Plant;
  ended: boolean;
  growthStage?: string;
  growthBoost?: UseMutationResult<unknown, unknown, void, unknown>;
}

type OpenPanel = "gear" | "consumables" | "bundles" | "partners" | null;

const BUTTON_CLASS = (isActive: boolean, color: string) => `
  flex-1 min-h-[36px] rounded-lg border transition-all text-center text-[10px] font-bold tracking-wide px-2 py-2
  ${isActive
    ? `border-${color}/60 bg-${color}/20`
    : `border-${color}/25 bg-${color}/5 hover:bg-${color}/15`
  }
  text-${color}/90 hover:text-${color}
`;

export function ArcadeToolbar({ plant, ended, growthStage, growthBoost }: ArcadeToolbarProps) {
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);

  if (ended) return null;

  return (
    <>
      {/* Active boost display */}
      <BoostsInline />

      {/* Growth boost button - optional, only if growth stage allows */}
      {growthBoost && growthStage && growthStage !== "harvest" && (
        <button
          onClick={() => growthBoost.mutate()}
          disabled={growthBoost.isPending}
          className="w-full min-h-[36px] flex items-center justify-center gap-1.5 rounded-lg border border-cyan-400/40 bg-gradient-to-r from-cyan-500/10 to-grow-500/10 hover:from-cyan-500/20 hover:to-grow-500/20 px-3 py-2 text-xs font-bold text-cyan-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {growthBoost.isPending ? "Boosting…" : "⚡ Boost Growth · 60 🌿"}
        </button>
      )}

      {/* Compact professional toolbar */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => setOpenPanel(openPanel === "gear" ? null : "gear")}
            className={`flex flex-col items-center justify-center min-h-[36px] rounded-lg border text-[9px] font-bold transition-all px-1 py-1.5 ${
              openPanel === "gear"
                ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                : "border-cyan-400/20 bg-cyan-400/5 text-cyan-300/80 hover:bg-cyan-400/10"
            }`}
            title="Equipment & Gear"
          >
            <span className="text-sm">⚙️</span>
            <span>Gear</span>
          </button>
          <button
            onClick={() => setOpenPanel(openPanel === "consumables" ? null : "consumables")}
            className={`flex flex-col items-center justify-center min-h-[36px] rounded-lg border text-[9px] font-bold transition-all px-1 py-1.5 ${
              openPanel === "consumables"
                ? "border-grow-400/50 bg-grow-400/15 text-grow-200"
                : "border-grow-400/20 bg-grow-400/5 text-grow-300/80 hover:bg-grow-400/10"
            }`}
            title="Consumables & Items"
          >
            <span className="text-sm">💧</span>
            <span>Items</span>
          </button>
          <button
            onClick={() => setOpenPanel(openPanel === "bundles" ? null : "bundles")}
            className={`flex flex-col items-center justify-center min-h-[36px] rounded-lg border text-[9px] font-bold transition-all px-1 py-1.5 ${
              openPanel === "bundles"
                ? "border-purple-400/50 bg-purple-400/15 text-purple-200"
                : "border-purple-400/20 bg-purple-400/5 text-purple-300/80 hover:bg-purple-400/10"
            }`}
            title="Bundle Packages"
          >
            <span className="text-sm">📦</span>
            <span>Bundles</span>
          </button>
          <button
            onClick={() => setOpenPanel(openPanel === "partners" ? null : "partners")}
            className={`flex flex-col items-center justify-center min-h-[36px] rounded-lg border text-[9px] font-bold transition-all px-1 py-1.5 ${
              openPanel === "partners"
                ? "border-pink-400/50 bg-pink-400/15 text-pink-200"
                : "border-pink-400/20 bg-pink-400/5 text-pink-300/80 hover:bg-pink-400/10"
            }`}
            title="Partner Drops"
          >
            <span className="text-sm">🤝</span>
            <span>Partners</span>
          </button>
        </div>

        {/* Expandable panel area */}
        {openPanel && (
          <div className="rounded-lg border border-[#1c3447] bg-[#0d1d2b] p-2.5">
            {openPanel === "gear" && <GearPanel podId={plant.pod_id} />}
            {openPanel === "consumables" && <ConsumablesPanel plant={plant} />}
            {openPanel === "bundles" && <BundlePanel />}
            {openPanel === "partners" && <PartnerPanel />}
          </div>
        )}
      </div>
    </>
  );
}
