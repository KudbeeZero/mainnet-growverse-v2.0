"use client";

import Link from "next/link";
import { useCareActions } from "@/hooks/useCareActions";
import { useCareFeedback } from "@/components/plant/CareFeedback";
import type { PlantState } from "@/lib/types";

interface ActionDef {
  key: string;
  label: string;
  icon: string;
}

const ACTIONS: ActionDef[] = [
  { key: "water", label: "Water", icon: "💧" },
  { key: "feed", label: "Feed", icon: "🧪" },
  { key: "prune", label: "Prune", icon: "✂️" },
  { key: "train", label: "Train", icon: "🪢" },
  { key: "inspect", label: "Inspect", icon: "🔍" },
  { key: "journal", label: "Journal", icon: "📓" },
  { key: "boosts", label: "Boosts", icon: "⚡" },
];

/**
 * The seven-action command bar. WATER/FEED are wired to the care mutations;
 * INSPECT/JOURNAL deep-link to the plant detail page (Advisor + Event log);
 * PRUNE/TRAIN/BOOSTS are visible but disabled until their backend lands.
 */
export function CommandActionBar({ plant }: { plant: PlantState }) {
  const { care } = useCareActions(plant.id);
  const { fire, layer } = useCareFeedback();
  const ended = !plant.is_alive || plant.harvested;
  const pending = care.isPending ? care.variables : null;

  const base =
    "relative flex min-h-[52px] min-w-[68px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition-colors";
  const live = "border-cyan-400/25 bg-cyan-400/[0.05] text-cyan-100 hover:bg-cyan-400/15";
  const off = "cursor-not-allowed border-ink-700 bg-ink-900/40 text-gray-600";

  const doCare = (kind: "water" | "feed") => {
    fire(kind);
    care.mutate(kind);
  };

  return (
    <div className="relative flex flex-wrap gap-2">
      {layer}
      {ACTIONS.map((a) => {
        if (a.key === "water" || a.key === "feed") {
          return (
            <button
              key={a.key}
              onClick={() => doCare(a.key as "water" | "feed")}
              disabled={ended}
              className={`${base} ${ended ? off : live} ${pending === a.key ? "animate-pulse" : ""}`}
            >
              <span className="text-base">{a.icon}</span>
              {a.label}
            </button>
          );
        }
        if (a.key === "inspect" || a.key === "journal") {
          return (
            <Link
              key={a.key}
              href={`/dashboard/plants/${plant.id}`}
              className={`${base} ${live}`}
            >
              <span className="text-base">{a.icon}</span>
              {a.label}
            </Link>
          );
        }
        return (
          <button
            key={a.key}
            disabled
            title="Coming soon"
            className={`${base} ${off}`}
          >
            <span className="text-base opacity-60">{a.icon}</span>
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
