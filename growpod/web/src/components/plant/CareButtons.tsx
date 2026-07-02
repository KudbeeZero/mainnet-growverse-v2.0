"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useCareActions } from "@/hooks/useCareActions";
import { useCareFeedback } from "./CareFeedback";
import type { CareKind } from "./careFeedbackData";
import { careAvailability, formatSinceUsed } from "@/lib/careAvailability";
import type { PlantState } from "@/lib/types";

interface ActionDef {
  kind: Exclude<CareKind, "harvest">;
  emoji: string;
  label: string;
  /** One-line "why you'd tap this" — shown under the button. */
  benefit: string;
  cost?: string;
}

const ACTIONS: ActionDef[] = [
  { kind: "water", emoji: "💧", label: "Water", benefit: "Tops up water level", cost: "10 🌿" },
  { kind: "feed", emoji: "🧪", label: "Feed", benefit: "Tops up nutrients", cost: "10 🌿" },
  { kind: "treatPests", emoji: "🐞", label: "Treat Pests", benefit: "Clears pest pressure" },
  { kind: "treatDisease", emoji: "🧫", label: "Treat Disease", benefit: "Clears disease pressure" },
  { kind: "prune", emoji: "✂️", label: "Prune", benefit: "Free — trims pests/disease, small health boost" },
  { kind: "train", emoji: "🪢", label: "Train", benefit: "Free — gentle health boost, eases pests" },
  { kind: "boost", emoji: "⚡", label: "Boost", benefit: "Free — tops up water/nutrients, health boost" },
];

export function CareButtons({ plant }: { plant: PlantState }) {
  const { care, harvest } = useCareActions(plant.id);
  const { fire, layer } = useCareFeedback();
  const disabled = !plant.is_alive || plant.harvested;
  const canHarvest = plant.growth_stage === "harvest" && !plant.harvested && plant.is_alive;
  const pending = care.isPending ? care.variables : null;
  const avail = careAvailability(plant, plant.recent_events ?? []);

  // Fire the delight burst the instant the player taps — feedback should feel
  // immediate, not wait on the network round-trip.
  const doCare = (kind: Exclude<CareKind, "harvest">) => {
    fire(kind);
    care.mutate(kind);
  };

  return (
    <div className="relative space-y-2" data-onboarding="care-actions">
      {layer}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map((a) => {
          const state = avail[a.kind];
          const isDisabled = disabled || !state.available;
          const lastUsed = formatSinceUsed(state.hoursSinceUsed);
          return (
            <div key={a.kind} className="flex flex-col gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="min-h-[44px] w-full px-2 text-sm"
                disabled={isDisabled}
                loading={pending === a.kind}
                title={!disabled && !state.available && state.reason ? state.reason : undefined}
                onClick={() => doCare(a.kind)}
              >
                {a.emoji} {a.label}
                {a.cost && <span className="ml-1 font-mono text-[10px] opacity-60">· {a.cost}</span>}
              </Button>
              <p className="px-0.5 text-[10px] leading-tight text-gray-500">
                {!disabled && !state.available && state.reason
                  ? state.reason
                  : lastUsed
                    ? `${a.benefit} · last: ${lastUsed}`
                    : a.benefit}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href={`/dashboard/plants/${plant.id}`}
          className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/[0.06] px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"
        >
          🔍 Inspect
        </Link>
        <Link
          href={`/dashboard/plants/${plant.id}#journal`}
          className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/[0.06] px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"
        >
          📓 Journal
        </Link>
      </div>

      {canHarvest && (
        <Button
          size="sm"
          variant="primary"
          className="min-h-[44px] w-full text-sm"
          loading={harvest.isPending}
          onClick={() => {
            fire("harvest");
            harvest.mutate({ sell: true });
          }}
        >
          ✂️ Harvest & Sell
        </Button>
      )}
    </div>
  );
}
