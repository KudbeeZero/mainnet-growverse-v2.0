"use client";

// FP-3 — Primary Plant CTA. Surfaces the single most important next action for
// a plant as a prominent, one-tap button so the player never has to ask "what
// do I do next?". Wraps the existing care/harvest mutations; for climate setup
// it links to the dashboard where the pod controls live. Reads server-
// authoritative state only — no new game logic.

import Link from "next/link";
import { useCareActions } from "@/hooks/useCareActions";
import { useCareFeedback } from "./CareFeedback";
import { nextPlantAction } from "@/lib/plantAction";
import type { CareKind } from "./careFeedbackData";
import type { Plant, Pod } from "@/lib/types";

const ACCENT: Record<"critical" | "due" | "calm", string> = {
  critical: "border-red-600/70 bg-red-950/30",
  due: "border-amber-600/60 bg-amber-950/20",
  calm: "border-grow-700/60 bg-grow-950/20",
};

export function PlantActionCTA({
  plant,
  pod,
  compact = false,
}: {
  plant: Plant;
  pod?: Pod | null;
  compact?: boolean;
}) {
  const { care, harvest } = useCareActions(plant.id);
  // Same delight burst the manual care buttons use — the primary CTA is the
  // most-tapped care action, so it deserves the celebration too (DX-005).
  const { fire, layer } = useCareFeedback();
  const action = nextPlantAction(plant, pod);

  // Map the resolved action to a click handler + pending state. Care/harvest
  // taps fire the feedback burst the instant they're pressed (before the
  // network round-trip), matching CareButtons.
  let onClick: (() => void) | null = null;
  let pending = false;
  if (action.kind === "harvest") {
    onClick = () => {
      fire("harvest");
      harvest.mutate({ sell: true });
    };
    pending = harvest.isPending;
  } else if (
    action.kind === "water" ||
    action.kind === "feed" ||
    action.kind === "treatPests" ||
    action.kind === "treatDisease"
  ) {
    const kind = action.kind as Exclude<CareKind, "harvest">;
    onClick = () => {
      fire(kind);
      care.mutate(kind);
    };
    pending = care.isPending && care.variables === action.kind;
  }

  const pulse = action.urgency === "critical" ? "animate-pulse-ring" : "";

  // ---- Calm / terminal: nothing urgent. Stay quiet. ----
  if (action.kind === "none") {
    if (compact) {
      return (
        <p className="text-center text-xs text-gray-500">
          <span aria-hidden>{action.emoji}</span> {action.label}
        </p>
      );
    }
    return (
      <div className={`flex items-center gap-3 rounded-xl border p-3 ${ACCENT.calm}`}>
        <span aria-hidden className="text-2xl">
          {action.emoji}
        </span>
        <div>
          <div className="instrument-label">Status</div>
          <div className="text-sm font-medium text-gray-200">{action.reason}</div>
        </div>
      </div>
    );
  }

  const button =
    action.kind === "setClimate" ? (
      <Link
        href="/dashboard"
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-grow-500 bg-grow-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-grow-500 ${pulse}`}
      >
        <span aria-hidden>{action.emoji}</span>
        {action.label}
      </Link>
    ) : (
      <button
        type="button"
        onClick={onClick ?? undefined}
        disabled={pending}
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-grow-500 bg-grow-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-grow-500 disabled:cursor-not-allowed disabled:opacity-70 ${pulse}`}
      >
        {pending ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <span aria-hidden>{action.emoji}</span>
        )}
        {action.label}
      </button>
    );

  // ---- Compact (inside PlantCard): a single full-width primary action. ----
  if (compact) {
    return (
      <div className={`relative rounded-lg border p-2 ${ACCENT[action.urgency]}`}>
        {layer}
        <div className="mb-1.5 text-center text-[11px] text-gray-300">{action.reason}</div>
        <div className="[&>*]:w-full">{button}</div>
      </div>
    );
  }

  // ---- Full (plant detail): a labelled "next step" banner. ----
  return (
    <div
      className={`relative flex items-center gap-3 rounded-xl border p-3 ${ACCENT[action.urgency]}`}
    >
      {layer}
      <span aria-hidden className="text-2xl">
        {action.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="instrument-label">Next step</div>
        <div className="truncate text-sm font-medium text-gray-100">{action.reason}</div>
      </div>
      {button}
    </div>
  );
}
