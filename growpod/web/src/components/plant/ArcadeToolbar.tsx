"use client";

import { useState } from "react";
import { GearPanel } from "./GearPanel";
import { ConsumablesPanel } from "./ConsumablesPanel";
import { BundlePanel } from "./BundlePanel";
import { PartnerPanel } from "./PartnerPanel";
import type { Plant } from "@/lib/types";

// Store/equipment shelf only. The boost surfaces (BoostsInline + the ⚡ growth
// boost) moved to the chamber's GROW tab — the single boost-apply surface —
// so this toolbar can't duplicate them.
interface ArcadeToolbarProps {
  plant: Plant;
  ended: boolean;
}

type OpenPanel = "gear" | "consumables" | "bundles" | "partners" | null;

export function ArcadeToolbar({ plant, ended }: ArcadeToolbarProps) {
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);

  if (ended) return null;

  return (
    <>
      {/* Compact professional toolbar */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={() => setOpenPanel(openPanel === "gear" ? null : "gear")}
            style={{ ["--gpe-glow" as string]: "56 189 248" } as React.CSSProperties}
            className={`gpe-glow flex flex-col items-center justify-center min-h-[40px] rounded-lg border text-[10px] font-bold transition-all px-2 py-2 focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
              openPanel === "gear"
                ? "gpe-active border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                : "border-cyan-400/20 bg-cyan-400/5 text-cyan-300/80 hover:bg-cyan-400/10"
            }`}
            title="Equipment & Gear"
          >
            <span className="text-lg">⚙️</span>
            <span className="truncate">Gear</span>
          </button>
          <button
            onClick={() => setOpenPanel(openPanel === "consumables" ? null : "consumables")}
            style={{ ["--gpe-glow" as string]: "118 192 36" } as React.CSSProperties}
            className={`gpe-glow flex flex-col items-center justify-center min-h-[40px] rounded-lg border text-[10px] font-bold transition-all px-2 py-2 focus-visible:ring-2 focus-visible:ring-grow-400/50 ${
              openPanel === "consumables"
                ? "gpe-active border-grow-400/50 bg-grow-400/15 text-grow-200"
                : "border-grow-400/20 bg-grow-400/5 text-grow-300/80 hover:bg-grow-400/10"
            }`}
            title="Consumables & Items"
          >
            <span className="text-lg">💧</span>
            <span className="truncate">Items</span>
          </button>
          <button
            onClick={() => setOpenPanel(openPanel === "bundles" ? null : "bundles")}
            style={{ ["--gpe-glow" as string]: "192 132 252" } as React.CSSProperties}
            className={`gpe-glow flex flex-col items-center justify-center min-h-[40px] rounded-lg border text-[10px] font-bold transition-all px-2 py-2 focus-visible:ring-2 focus-visible:ring-purple-400/50 ${
              openPanel === "bundles"
                ? "gpe-active border-purple-400/50 bg-purple-400/15 text-purple-200"
                : "border-purple-400/20 bg-purple-400/5 text-purple-300/80 hover:bg-purple-400/10"
            }`}
            title="Bundle Packages"
          >
            <span className="text-lg">📦</span>
            <span className="truncate">Bundles</span>
          </button>
          <button
            onClick={() => setOpenPanel(openPanel === "partners" ? null : "partners")}
            style={{ ["--gpe-glow" as string]: "244 114 182" } as React.CSSProperties}
            className={`gpe-glow flex flex-col items-center justify-center min-h-[40px] rounded-lg border text-[10px] font-bold transition-all px-2 py-2 focus-visible:ring-2 focus-visible:ring-pink-400/50 ${
              openPanel === "partners"
                ? "gpe-active border-pink-400/50 bg-pink-400/15 text-pink-200"
                : "border-pink-400/20 bg-pink-400/5 text-pink-300/80 hover:bg-pink-400/10"
            }`}
            title="Partner Drops"
          >
            <span className="text-lg">🤝</span>
            <span className="truncate">Partners</span>
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
