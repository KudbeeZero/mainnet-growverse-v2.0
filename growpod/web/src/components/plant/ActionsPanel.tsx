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

// Same per-action accent triplets as `ChamberDock`'s bottom-dock tiles — the
// mockup colors each Actions & Controls row to match its dock counterpart
// (blue Water, green Feed, red Prune, cyan Train, amber Boost); this panel
// previously rendered every row in a uniform cyan, losing that mapping.
const ACCENT: Record<ActionKind | "inspect", string> = {
  water: "56,189,248",
  feed: "118,192,36",
  prune: "248,113,113",
  train: "125,211,252",
  boost: "253,224,71",
  inspect: "165,180,252",
};

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
        const accent = ACCENT[a.kind];
        return (
          <button
            key={a.kind}
            type="button"
            disabled={isDisabled}
            title={!disabled && !state.available && state.reason ? state.reason : undefined}
            onClick={() => doCare(a.kind)}
            style={isDisabled ? undefined : { borderColor: `rgba(${accent},0.35)` }}
            className={`flex min-h-[52px] w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
              isDisabled
                ? "cursor-not-allowed border-white/10 bg-white/[0.02] opacity-45"
                : "bg-white/[0.04] hover:bg-white/[0.07]"
            } ${pending === a.kind ? "opacity-70" : ""}`}
            onMouseEnter={(e) => {
              if (!isDisabled) e.currentTarget.style.borderColor = `rgba(${accent},0.6)`;
            }}
            onMouseLeave={(e) => {
              if (!isDisabled) e.currentTarget.style.borderColor = `rgba(${accent},0.35)`;
            }}
          >
            <span
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border text-lg leading-none"
              aria-hidden
              style={
                isDisabled
                  ? undefined
                  : { borderColor: `rgba(${accent},0.45)`, backgroundColor: `rgba(${accent},0.14)` }
              }
            >
              {a.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="flex items-center gap-1.5 text-[12px] font-extrabold tracking-[0.06em]"
                style={isDisabled ? undefined : { color: `rgb(${accent})` }}
              >
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

      {/* Inspect — deep-links to the full plant report (real route, not invented).
          Same accent as `ChamberDock`'s bottom-dock Inspect tile (light indigo),
          not Tailwind's `violet` — the two views of the same action should read
          as one identical color, not two different purples. */}
      <Link
        href={`/dashboard/plants/${plant.id}`}
        className="flex min-h-[52px] w-full items-center gap-2.5 rounded-xl border bg-white/[0.04] px-3 py-2 text-left transition-colors hover:bg-white/[0.07]"
        style={{ borderColor: `rgba(${ACCENT.inspect},0.35)` }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = `rgba(${ACCENT.inspect},0.6)`)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = `rgba(${ACCENT.inspect},0.35)`)}
      >
        <span
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border text-lg leading-none"
          aria-hidden
          style={{ borderColor: `rgba(${ACCENT.inspect},0.45)`, backgroundColor: `rgba(${ACCENT.inspect},0.14)` }}
        >
          🔍
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-extrabold tracking-[0.06em]" style={{ color: `rgb(${ACCENT.inspect})` }}>
            INSPECT
          </span>
          <span className="block truncate text-[10px] text-[#7fa9bf]">Check health &amp; open the full report</span>
        </span>
      </Link>
    </div>
  );
}
