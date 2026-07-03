"use client";

/**
 * Right edge panel content — "Insights & Management" (mockup: Plant Insights,
 * Environment, Missions, Inventory, Progress). Every number here is read from
 * real hooks/state already used elsewhere in the app — nothing invented:
 *  - Plant Insights: same derivation as `ChamberDock`'s Plant Insights card.
 *  - Environment: VPD from the server's derived metrics, Airflow from the
 *    pod's fan setpoint, Light Intensity from the pod's real environment
 *    field, Pressure from the plant's real pest/disease pressure levels.
 *  - Missions -> the real Contracts system (`useContracts`) — this codebase
 *    has no separate "missions" entity, so Contracts (open/fulfilled quest-
 *    like work orders) is the honest real analog.
 *  - Inventory -> the real consumables shop/owned counts (`useConsumables`).
 *  - Progress -> the real player level/XP (`useLevel`) plus this plant's own
 *    stage-forecast progress (`PlantProgressStrip`, reused unchanged).
 */

import Link from "next/link";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";
import { EnvironmentRail } from "@/components/command/EnvironmentRail";
import { PlantProgressStrip } from "./ChamberDock";
import { useContracts } from "@/hooks/queries";
import { useConsumables } from "@/hooks/useConsumables";
import { useLevel } from "@/hooks/queries";
import type { Environment } from "@/lib/api";
import type { PlantState, Pod, Strain } from "@/lib/types";

function InsightRow({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: "strong" | "warn" }) {
  return (
    <div className="flex min-h-[38px] items-center justify-between gap-2 border-b border-white/5 py-1 last:border-0">
      <span className="flex items-center gap-1.5 text-[11px] text-[#7fa9bf]">
        <span aria-hidden>{icon}</span> {label}
      </span>
      <span
        className={`truncate text-right text-[11px] font-bold capitalize ${
          tone === "warn" ? "text-red-300" : tone === "strong" ? "text-grow-300" : "text-gray-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function InsightsPanel({
  plant,
  strain,
  pod,
  climate,
  onSlideEnv,
  envDisabled,
  fanControl,
  extra,
}: {
  plant: PlantState;
  strain?: Strain;
  pod?: Pod;
  climate: Environment & { fan: number };
  onSlideEnv: (field: keyof Environment, value: number) => void;
  envDisabled: boolean;
  /** FAN/airflow slider — cosmetic-only, not part of `EnvironmentRail`'s
   *  persisted setpoint schema, so the chamber page supplies its own control. */
  fanControl?: React.ReactNode;
  /** Real, existing features that don't map onto the mockup's five sections
   *  (Arcade boosts, the growth-day preview scrubber) — rendered below so
   *  nothing gets dropped, without cluttering the mockup-matched layout above. */
  extra?: React.ReactNode;
}) {
  const tr = plant.trichomes;
  const topCola = !tr?.active ? "Not yet forming" : tr.head_development > 0.6 ? "Strong" : tr.head_development > 0.3 ? "Swelling" : "Forming";
  const trichomePct = tr?.active ? `${Math.round(tr.cloudy_pct)}% ${tr.dominant ?? "cloudy"}` : "Not yet";
  const aroma = strain?.terpenes?.length ? strain.terpenes.slice(0, 3).join(" · ") : "Not scanned";
  const health = Math.round(plant.health);

  const pressure = Math.max(plant.pest_level ?? 0, plant.disease_level ?? 0);
  const vpd = plant.metrics?.vpd_kpa;

  const contracts = useContracts();
  const activeContracts = contracts.data?.filter((c) => c.status === "open").length ?? 0;
  const completedContracts = contracts.data?.filter((c) => c.status === "fulfilled").length ?? 0;

  const consumables = useConsumables();
  const ownedUnits = consumables.data?.reduce((sum, i) => sum + (i.owned ?? 0), 0) ?? 0;
  const catalogSize = consumables.data?.length ?? 0;

  const level = useLevel();

  return (
    <div className="space-y-2" data-testid="insights-panel">
      {/* PLANT INSIGHTS */}
      <CollapsiblePanel title="Plant Insights" titleClassName="text-cyan-300" className="border border-[#1c3447] bg-[#0d1d2b]/80 !p-2.5">
        <InsightRow icon="🌸" label="Top Cola" value={topCola} tone={topCola === "Strong" ? "strong" : undefined} />
        <InsightRow icon="❄️" label="Trichomes" value={trichomePct} />
        <InsightRow icon="👃" label="Aroma" value={aroma} />
        <InsightRow icon="❤️" label="Health" value={`${health}%`} tone={health >= 70 ? "strong" : health < 40 ? "warn" : undefined} />
      </CollapsiblePanel>

      {/* ENVIRONMENT — glanceable readouts; expand for the real editable setpoints. */}
      <CollapsiblePanel title="Environment" titleClassName="text-cyan-300" defaultOpen={false} className="border border-[#1c3447] bg-[#0d1d2b]/80 !p-2.5">
        <InsightRow icon="💧" label="VPD" value={vpd == null ? "Not lit yet" : `${vpd.toFixed(2)} kPa`} />
        <InsightRow icon="🌬" label="Airflow" value={`${Math.round(climate.fan)}%`} />
        <InsightRow icon="💡" label="Light Intensity" value={`${Math.round(climate.light_intensity)}`} />
        <InsightRow icon="⚠️" label="Pressure" value={`${Math.round(pressure)}%`} tone={pressure > 40 ? "warn" : undefined} />
        <div className="mt-2">
          <EnvironmentRail climate={climate} plant={plant} pod={pod} disabled={envDisabled} onSlide={onSlideEnv} />
        </div>
        {fanControl}
      </CollapsiblePanel>

      {/* MISSIONS — real Contracts (this codebase's quest/work-order system). */}
      <CollapsiblePanel title="Missions" titleClassName="text-amber-200" defaultOpen={false} className="border border-[#1c3447] bg-[#0d1d2b]/80 !p-2.5">
        <p className="text-[11px] font-bold text-gray-100">
          {activeContracts} Active · {completedContracts} Completed
        </p>
        <Link href="/contracts" className="mt-1 block text-[10px] font-semibold text-cyan-300 hover:underline">
          Open contracts →
        </Link>
      </CollapsiblePanel>

      {/* INVENTORY — real consumables (owned units / catalog size). */}
      <CollapsiblePanel title="Inventory" titleClassName="text-grow-300" defaultOpen={false} className="border border-[#1c3447] bg-[#0d1d2b]/80 !p-2.5">
        <p className="text-[11px] font-bold text-gray-100">
          {ownedUnits} / {catalogSize} items
        </p>
        <Link href="/store" className="mt-1 block text-[10px] font-semibold text-cyan-300 hover:underline">
          Open store →
        </Link>
      </CollapsiblePanel>

      {/* PROGRESS — real player level/XP + this plant's real stage forecast. */}
      <CollapsiblePanel title="Progress" titleClassName="text-violet-300" defaultOpen={false} className="border border-[#1c3447] bg-[#0d1d2b]/80 !p-2.5">
        {level.data && (
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-gray-100">Level {level.data.level}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#11212e]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400"
                style={{ width: `${Math.round(level.data.progress_pct)}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-violet-300">{Math.round(level.data.progress_pct)}%</span>
          </div>
        )}
        {plant.forecast && <PlantProgressStrip forecast={plant.forecast} />}
      </CollapsiblePanel>

      {extra}
    </div>
  );
}
