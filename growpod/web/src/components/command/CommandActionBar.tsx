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
 * The seven-action command bar. WATER/FEED + the free care tools PRUNE/TRAIN/
 * BOOSTS are wired to the care mutations (the latter are free, with server-side
 * once-per-stage / cooldown guards surfaced as error toasts); INSPECT/JOURNAL
 * deep-link to the plant detail page (Advisor + Event log).
 */
type CareKey = "water" | "feed" | "prune" | "train" | "boost";

// The "boosts" button maps to the singular `boost` care kind.
const CARE_KIND: Record<string, CareKey> = {
  water: "water",
  feed: "feed",
  prune: "prune",
  train: "train",
  boosts: "boost",
};

export function CommandActionBar({
  plant,
  recommend = null,
}: {
  plant: PlantState;
  /** Care-bar key to spotlight as the recommended next move (e.g. "water"). */
  recommend?: string | null;
}) {
  const { care } = useCareActions(plant.id);
  const { fire, layer } = useCareFeedback();
  const ended = !plant.is_alive || plant.harvested;
  const pending = care.isPending ? care.variables : null;

  const base =
    "relative flex min-h-[52px] min-w-[68px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition-colors";
  const live = "border-cyan-400/25 bg-cyan-400/[0.05] text-cyan-100 hover:bg-cyan-400/15";
  const off = "cursor-not-allowed border-ink-700 bg-ink-900/40 text-gray-600";
  // Spotlight ring on the recommended action (skip when the plant has ended).
  const rec = (key: string) =>
    !ended && recommend === key ? " ring-2 ring-grow-400/70 ring-offset-2 ring-offset-[#0b1b27]" : "";

  const doCare = (kind: CareKey) => {
    fire(kind);
    care.mutate(kind);
  };

  return (
    // On the smallest phones (<=375px, no `xs:` match) the seven-action bar's
    // flex-wrap runs at ~41px/button — below the 44px tap-target floor — so it
    // stacks 2-wide instead; from 376px up (`xs:`, tablets, desktop) there's
    // room for the original flex-wrap row.
    <div className="relative grid grid-cols-2 gap-2 xs:flex xs:flex-wrap">
      {layer}
      {ACTIONS.map((a) => {
        const kind = CARE_KIND[a.key];
        if (kind) {
          return (
            <button
              key={a.key}
              onClick={() => doCare(kind)}
              disabled={ended}
              className={`${base} ${ended ? off : live} ${pending === kind ? "animate-pulse" : ""}${rec(a.key)}`}
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
              className={`${base} ${live}${rec(a.key)}`}
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
