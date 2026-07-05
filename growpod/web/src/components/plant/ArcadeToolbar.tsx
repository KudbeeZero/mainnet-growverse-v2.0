"use client";

import { useState } from "react";
import { GearPanel } from "./GearPanel";
import { ConsumablesPanel } from "./ConsumablesPanel";
import { BundlePanel } from "./BundlePanel";
import { PartnerPanel } from "./PartnerPanel";
import type { Plant } from "@/lib/types";

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
      {/* Compact toolbar buttons */}
      <div className="flex gap-1.5 justify-between">
        <button
          onClick={() => setOpenPanel(openPanel === "gear" ? null : "gear")}
          className="flex-1 min-h-[32px] rounded-md border border-cyan-400/30 bg-cyan-400/5 hover:bg-cyan-400/10 text-[11px] font-semibold text-cyan-300 transition-colors px-2 py-1.5"
          title="Equipment"
        >
          ⚙️ Gear
        </button>
        <button
          onClick={() => setOpenPanel(openPanel === "consumables" ? null : "consumables")}
          className="flex-1 min-h-[32px] rounded-md border border-grow-400/30 bg-grow-400/5 hover:bg-grow-400/10 text-[11px] font-semibold text-grow-300 transition-colors px-2 py-1.5"
          title="Consumables"
        >
          💧 Items
        </button>
        <button
          onClick={() => setOpenPanel(openPanel === "bundles" ? null : "bundles")}
          className="flex-1 min-h-[32px] rounded-md border border-purple-400/30 bg-purple-400/5 hover:bg-purple-400/10 text-[11px] font-semibold text-purple-300 transition-colors px-2 py-1.5"
          title="Bundles"
        >
          📦 Bundles
        </button>
        <button
          onClick={() => setOpenPanel(openPanel === "partners" ? null : "partners")}
          className="flex-1 min-h-[32px] rounded-md border border-pink-400/30 bg-pink-400/5 hover:bg-pink-400/10 text-[11px] font-semibold text-pink-300 transition-colors px-2 py-1.5"
          title="Partners"
        >
          🤝 Partners
        </button>
      </div>

      {/* Panel display area - one at a time */}
      {openPanel && (
        <div className="mt-2 rounded-lg border border-[#1c3447] bg-[#0d1d2b] p-2">
          {openPanel === "gear" && <GearPanel podId={plant.pod_id} />}
          {openPanel === "consumables" && <ConsumablesPanel plant={plant} />}
          {openPanel === "bundles" && <BundlePanel />}
          {openPanel === "partners" && <PartnerPanel />}
        </div>
      )}
    </>
  );
}
