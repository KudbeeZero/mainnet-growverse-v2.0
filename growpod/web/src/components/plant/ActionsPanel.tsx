"use client";

/**
 * Left edge panel content — "Actions & Controls" (mockup: Water / Feed /
 * Prune / Train / Inspect / Boost). Reuses the SAME real care mutations as
 * the rest of the app (`useCareActions`, `careAvailability`) — no new game
 * mechanics, just the mockup's fuller, labeled layout for the same six taps
 * that already live on `ChamberActionBar`'s bottom dock tiles.
 */

import Link from "next/link";
import { useCareActions } from "@/hooks/useCareActions";
import { useCareFeedback } from "./CareFeedback";
import { dispatchCareReaction } from "./careReactionsData";
import { careAvailability, formatSinceUsed } from "@/lib/careAvailability";
import { useGameShell } from "@/components/shell/GameShellContext";
import type { PlantState } from "@/lib/types";

type ActionKind = "water" | "feed" | "prune" | "train" | "boost";

const ACTIONS: { kind: ActionKind; icon: string; label: string; benefit: string; cost?: string }[] = [
  { kind: "water", icon: "💧", label: "Water", benefit: "Tops up water level", cost: "10 🌿" },
  { kind: "feed", icon: "🧪", label: "Feed", benefit: "Tops up nutrients", cost: "10 🌿" },
  { kind: "prune", icon: "✂️", label: "Prune", benefit: "Improve airflow" },
  { kind: "train", icon: "🪢", label: "Train", benefit: "Shape plant" },
  { kind: "boost", icon: "⚡", label: "Boost", benefit: "Free — tops up water/nutrients, health boost" },
];

export function ActionsPanel({ plant }: { plant: PlantState }) {
  const { care } = useCareActions(plant.id);
  const { fire, layer } = useCareFeedback();
  const { collapse, openGeneration } = useGameShell();
  const disabled = !plant.is_alive || plant.harvested;
  const pending = care.isPending ? care.variables : null;
  const avail = careAvailability(plant, plant.recent_events ?? []);

  const doCare = (kind: ActionKind) => {
    fire(kind);
    dispatchCareReaction(kind); // the plant itself reacts (PlantReactionLayer)
    // Snapshot the panel's open-generation so a close-then-reopen while this
    // mutation is still in flight isn't stomped by this stale success handler.
    const gen = openGeneration("left");
    care.mutate(kind, {
      onSuccess: () => {
        if (openGeneration("left") === gen) collapse("left"); // auto-compact, unless reopened since
      },
    });
  };

  return (
    <div className="relative space-y-2" data-testid="actions-panel">
      {layer}
      {ACTIONS.map((a) => {
        const state = avail[a.kind];
        const isDisabled = disabled || !state.available;
        const lastUsed = formatSinceUsed(state.hoursSinceUsed);
        return (
          <button
            key={a.kind}
            type="button"
            disabled={isDisabled}
            title={!disabled && !state.available && state.reason ? state.reason : undefined}
            onClick={() => doCare(a.kind)}
            className={`flex min-h-[52px] w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
              isDisabled
                ? "cursor-not-allowed border-white/10 bg-white/[0.02] opacity-45"
                : "border-cyan-400/25 bg-white/[0.04] hover:border-cyan-300/50 hover:bg-cyan-400/10"
            } ${pending === a.kind ? "opacity-70" : ""}`}
          >
            <span className="text-xl leading-none" aria-hidden>
              {a.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[12px] font-extrabold tracking-[0.06em] text-white">
                {a.label.toUpperCase()}
                {a.cost && <span className="font-mono text-[10px] font-normal text-cyan-200/60">· {a.cost}</span>}
              </span>
              <span className="block truncate text-[10px] text-[#7fa9bf]">
                {!disabled && !state.available && state.reason ? state.reason : lastUsed ? `${a.benefit} · last: ${lastUsed}` : a.benefit}
              </span>
            </span>
          </button>
        );
      })}

      {/* Inspect — deep-links to the full plant report (real route, not invented). */}
      <Link
        href={`/dashboard/plants/${plant.id}`}
        className="flex min-h-[52px] w-full items-center gap-2.5 rounded-xl border border-violet-400/25 bg-white/[0.04] px-3 py-2 text-left transition-colors hover:border-violet-300/50 hover:bg-violet-400/10"
      >
        <span className="text-xl leading-none" aria-hidden>
          🔍
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-extrabold tracking-[0.06em] text-white">INSPECT</span>
          <span className="block truncate text-[10px] text-[#7fa9bf]">Check health &amp; open the full report</span>
        </span>
      </Link>
    </div>
  );
}
