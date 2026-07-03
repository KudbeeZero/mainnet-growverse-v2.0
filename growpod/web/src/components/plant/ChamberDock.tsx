"use client";

/**
 * Grow Chamber dock — the mockup's in-scene game hub, built in-place on the
 * existing chamber (no new page/route/room):
 *
 * - `ChamberActionBar`: six glassy sci-fi tiles embedded at the chamber base
 *   (Water / Feed / Prune / Train / Inspect / Boost). Tiles glow when
 *   available, dim with a reason when not, flash on tap, and every tap fires
 *   the button burst + the plant's own reaction (`PlantReactionLayer`).
 *   Treatments aren't tiles (mockup keeps six) — active pest/disease pressure
 *   surfaces as a Do-Now row in Today's Plan instead.
 * - `ChamberPanel`: the side-panel content — Today's Plan (ranked next
 *   actions, tappable) + Plant Insights (health, trichomes, top cola, aroma).
 */

import { useState } from "react";
import Link from "next/link";
import { useCareActions } from "@/hooks/useCareActions";
import { useCareFeedback } from "./CareFeedback";
import type { CareKind } from "./careFeedbackData";
import { dispatchCareReaction } from "./careReactionsData";
import { careAvailability, formatSinceUsed } from "@/lib/careAvailability";
import { buildTodaysPlan, URGENCY_LABEL, type PlanUrgency } from "@/lib/todaysPlan";
import type { PlantState, Strain } from "@/lib/types";

type BarKind = Exclude<CareKind, "harvest" | "treatPests" | "treatDisease">;

const TILES: { kind: BarKind | "inspect"; icon: string; label: string; benefit: string; accent: string }[] = [
  { kind: "water", icon: "💧", label: "Water", benefit: "Top up water", accent: "56,189,248" },
  { kind: "feed", icon: "🧪", label: "Feed", benefit: "Top up nutrients", accent: "118,192,36" },
  { kind: "prune", icon: "✂️", label: "Prune", benefit: "Improve airflow", accent: "248,113,113" },
  { kind: "train", icon: "🪢", label: "Train", benefit: "Shape plant", accent: "125,211,252" },
  { kind: "inspect", icon: "🔍", label: "Inspect", benefit: "Check health", accent: "165,180,252" },
  { kind: "boost", icon: "⚡", label: "Boost", benefit: "Apply boost", accent: "253,224,71" },
];

export function ChamberActionBar({ plant }: { plant: PlantState }) {
  const { care } = useCareActions(plant.id);
  const { fire, layer } = useCareFeedback();
  const [tapped, setTapped] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState<string | null>(null);
  const avail = careAvailability(plant, plant.recent_events ?? []);
  const dead = !plant.is_alive || plant.harvested;
  const pending = care.isPending ? care.variables : null;

  const doCare = (kind: BarKind) => {
    setTapped(kind);
    window.setTimeout(() => setTapped((t) => (t === kind ? null : t)), 650);
    fire(kind);
    dispatchCareReaction(kind);
    care.mutate(kind, {
      onSuccess: () => {
        setSucceeded(kind);
        window.setTimeout(() => setSucceeded((k) => (k === kind ? null : k)), 1100);
      },
    });
  };

  return (
    <div className="relative">
      {layer}
      <div className="grid grid-cols-6 gap-1.5 rounded-2xl border border-cyan-400/15 bg-[#08141e]/80 p-1.5 backdrop-blur-md">
        {TILES.map((t) => {
          const isInspect = t.kind === "inspect";
          const state = isInspect ? null : avail[t.kind as BarKind];
          const enabled = !dead && (isInspect || !!state?.available);
          const reason = !isInspect && !dead && state && !state.available ? state.reason : null;
          const lastUsed = state ? formatSinceUsed(state.hoursSinceUsed) : null;
          const cls = `flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1.5 text-center transition-all ${
            tapped === t.kind ? "gpe-tile-tap" : ""
          } ${succeeded === t.kind ? "ring-2 ring-grow-400/80" : ""} ${
            enabled
              ? "cursor-pointer border-[var(--tile)]/50 bg-gradient-to-b from-white/[0.06] to-transparent hover:from-white/[0.12]"
              : "cursor-not-allowed border-white/10 opacity-45"
          }`;
          const style = enabled
            ? ({ "--tile": `rgb(${t.accent})`, boxShadow: `0 0 14px rgba(${t.accent},0.28), inset 0 1px 0 rgba(255,255,255,0.08)`, borderColor: `rgba(${t.accent},0.45)` } as React.CSSProperties)
            : undefined;
          const inner = (
            <>
              <span className="text-lg leading-none drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]">{t.icon}</span>
              <span className="text-[10px] font-extrabold tracking-[0.08em]" style={enabled ? { color: `rgb(${t.accent})` } : undefined}>
                {t.label.toUpperCase()}
              </span>
              <span className="text-[9px] leading-tight text-[#7fa9bf]">
                {reason ? "Unavailable" : (lastUsed ? `${t.benefit} · ${lastUsed}` : t.benefit)}
              </span>
            </>
          );
          return isInspect ? (
            <Link key={t.kind} href={`/dashboard/plants/${plant.id}`} className={cls} style={style} title="Open the full plant report">
              {inner}
            </Link>
          ) : (
            <button
              key={t.kind}
              className={cls}
              style={style}
              disabled={!enabled || pending === t.kind}
              title={reason ?? undefined}
              onClick={() => doCare(t.kind as BarKind)}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const URGENCY_STYLE: Record<PlanUrgency, string> = {
  now: "border-grow-400/60 bg-grow-500/20 text-grow-200",
  soon: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  upcoming: "border-white/15 bg-white/5 text-[#7fa9bf]",
};

export function ChamberPanel({ plant, strain }: { plant: PlantState; strain?: Strain }) {
  const { care, harvest } = useCareActions(plant.id);
  const avail = careAvailability(plant, plant.recent_events ?? []);
  const plan = buildTodaysPlan(plant, avail, plant.forecast?.hours_to_harvest);
  const tr = plant.trichomes;
  const canHarvest = plant.growth_stage === "harvest" && !plant.harvested && plant.is_alive;
  const topCola = !tr?.active
    ? "Not yet forming"
    : tr.head_development > 0.6
      ? "Strong"
      : tr.head_development > 0.3
        ? "Swelling"
        : "Forming";

  const act = (kind: NonNullable<(typeof plan)[number]["kind"]>) => {
    if (kind === "harvest") {
      dispatchCareReaction("harvest");
      harvest.mutate({ sell: true });
    } else {
      dispatchCareReaction(kind);
      care.mutate(kind);
    }
  };

  return (
    <div className="space-y-2">
      {/* TODAY'S PLAN */}
      <div className="rounded-xl border border-[#1c3447] bg-[#0d1d2b] p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-[10px] font-extrabold tracking-[0.18em] text-grow-300">TODAY&apos;S PLAN</h3>
          <span className="rounded-md bg-white/10 px-1.5 text-[10px] font-bold text-white/70">{plan.length}</span>
        </div>
        {plan.length === 0 ? (
          <p className="text-[11px] text-[#7fa9bf]">
            {plant.harvested ? "Harvest complete — enjoy the spoils." : "🌿 Thriving — nothing urgent. Check back soon."}
          </p>
        ) : (
          <ul className="space-y-1">
            {plan.map((e, i) => (
              <li key={i} className="flex min-h-[36px] items-center gap-2 border-b border-white/5 pb-1 last:border-0 last:pb-0">
                <span className="text-sm">{e.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-gray-100">{e.title}</p>
                  <p className="truncate text-[9px] text-[#7fa9bf]">{e.why}</p>
                </div>
                {e.kind ? (
                  <button
                    onClick={() => act(e.kind!)}
                    disabled={care.isPending || harvest.isPending}
                    className={`rounded-md border px-2 py-1 text-[9px] font-extrabold tracking-wide ${URGENCY_STYLE[e.urgency]}`}
                  >
                    {URGENCY_LABEL[e.urgency]}
                  </button>
                ) : (
                  <span className={`rounded-md border px-2 py-1 text-[9px] font-extrabold tracking-wide ${URGENCY_STYLE[e.urgency]}`}>
                    {URGENCY_LABEL[e.urgency]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {canHarvest && (
          <button
            onClick={() => act("harvest")}
            disabled={harvest.isPending}
            className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-grow-500 bg-grow-600/80 text-sm font-extrabold text-white hover:bg-grow-500"
          >
            ✂️ Harvest &amp; Sell
          </button>
        )}
      </div>

      {/* PLANT INSIGHTS */}
      <div className="rounded-xl border border-[#1c3447] bg-[#0d1d2b] p-2.5">
        <h3 className="mb-1.5 text-[10px] font-extrabold tracking-[0.18em] text-cyan-300">PLANT INSIGHTS</h3>
        <dl className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <dt className="text-[#7fa9bf]">🌸 Top cola</dt>
            <dd className="font-bold text-grow-200">{topCola}</dd>
          </div>
          {tr?.active && (
            <div className="flex items-center justify-between">
              <dt className="text-[#7fa9bf]">❄️ Trichomes</dt>
              <dd className="font-mono text-[10px] text-gray-200">
                {Math.round(tr.cloudy_pct)}% Cloudy · {Math.round(tr.amber_pct)}% Amber
              </dd>
            </div>
          )}
          {strain?.terpenes && strain.terpenes.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <dt className="flex-none text-[#7fa9bf]">👃 Aroma</dt>
              <dd className="truncate text-right text-[10px] capitalize text-gray-300">{strain.terpenes.slice(0, 3).join(" · ")}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-[#7fa9bf]">❤️ Health</dt>
            <dd className={`font-mono font-bold ${plant.health >= 70 ? "text-grow-300" : plant.health >= 40 ? "text-amber-300" : "text-red-400"}`}>
              {Math.round(plant.health)}%
            </dd>
          </div>
        </dl>
        <Link href={`/dashboard/plants/${plant.id}#journal`} className="mt-2 block text-[10px] font-semibold text-cyan-300 hover:underline">
          📓 Open journal →
        </Link>
      </div>
    </div>
  );
}
