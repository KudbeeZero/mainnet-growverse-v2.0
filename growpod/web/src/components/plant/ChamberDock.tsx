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

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCareActions } from "@/hooks/useCareActions";
import { useCareFeedback } from "./CareFeedback";
import type { CareKind } from "./careFeedbackData";
import { dispatchCareReaction } from "./careReactionsData";
import { careAvailability, formatSinceUsed } from "@/lib/careAvailability";
import { buildTodaysPlan, URGENCY_LABEL, type PlanUrgency } from "@/lib/todaysPlan";
import { useBoostStore, BOOST_CONFIG, BOOST_TYPES, BOOST_ICONS } from "@/lib/arcade/boostEngine";
import { titleCase } from "@/lib/format";
import type { PlantState, StageForecast, Strain } from "@/lib/types";

type BarKind = Exclude<CareKind, "harvest" | "treatPests" | "treatDisease">;

const TILES: { kind: BarKind | "inspect"; icon: string; label: string; benefit: string; accent: string }[] = [
  { kind: "water", icon: "💧", label: "Water", benefit: "Top up water", accent: "56,189,248" },
  { kind: "feed", icon: "🧪", label: "Feed", benefit: "Top up nutrients", accent: "118,192,36" },
  { kind: "prune", icon: "✂️", label: "Prune", benefit: "Improve airflow", accent: "248,113,113" },
  { kind: "train", icon: "🪢", label: "Train", benefit: "Shape plant", accent: "125,211,252" },
  { kind: "inspect", icon: "🔍", label: "Inspect", benefit: "Check health", accent: "165,180,252" },
  { kind: "boost", icon: "⚡", label: "Boost", benefit: "Apply boost", accent: "253,224,71" },
];

export function ChamberActionBar({
  plant,
  vertical = false,
  onAction,
}: {
  plant: PlantState;
  /** Landscape slide-out HUD layout: full-width labeled rows instead of the 6-tile bar. */
  vertical?: boolean;
  /** Fires after a care tap lands — the landscape HUD uses it to auto-compact. */
  onAction?: () => void;
}) {
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
        onAction?.();
      },
    });
  };

  return (
    <div className="relative">
      {layer}
      <div
        className={`${
          vertical ? "grid grid-cols-1 gap-1.5" : "grid grid-cols-6 gap-1.5 rounded-2xl border border-cyan-400/15 bg-[#08141e]/80 p-1.5 backdrop-blur-md"
        }`}
      >
        {TILES.map((t) => {
          const isInspect = t.kind === "inspect";
          const state = isInspect ? null : avail[t.kind as BarKind];
          const enabled = !dead && (isInspect || !!state?.available);
          const reason = !isInspect && !dead && state && !state.available ? state.reason : null;
          const lastUsed = state ? formatSinceUsed(state.hoursSinceUsed) : null;
          const cls = `relative rounded-xl border transition-all ${
            vertical
              ? "flex min-h-[48px] flex-row items-center gap-2.5 px-2.5 py-1.5 text-left"
              : "flex min-h-[64px] flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-center"
          } ${tapped === t.kind ? "gpe-tile-tap" : ""} ${succeeded === t.kind ? "ring-2 ring-grow-400/80" : ""} ${
            enabled
              ? "gpe-tile cursor-pointer border-[var(--tile)]/50 bg-gradient-to-b from-white/[0.06] to-transparent hover:from-white/[0.12]"
              : "cursor-not-allowed border-white/10 opacity-45"
          }`;
          const style = enabled
            ? ({ "--tile": `rgb(${t.accent})`, "--gpe-glow": t.accent.replace(/,/g, " "), borderColor: `rgba(${t.accent},0.45)` } as React.CSSProperties)
            : undefined;
          const dotColor = enabled ? (lastUsed && lastUsed !== "Just now" ? "#f59e0b" : "#22c55e") : "#ef4444";
          const statusWord = !enabled ? "Wait" : lastUsed && lastUsed !== "Just now" ? "Ready" : "Optimal";
          const inner = (
            <>
              {!vertical && (
                <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
              )}
              {succeeded === t.kind && plant.care_streak && (
                <div className="absolute inset-0 flex items-center justify-center gpe-streak-pop pointer-events-none">
                  <span className="text-sm font-bold text-grow-300">+{plant.care_streak}</span>
                </div>
              )}
              <span className="flex-none text-lg leading-none drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]">{t.icon}</span>
              {vertical ? (
                <>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[11px] font-extrabold tracking-[0.08em]" style={enabled ? { color: `rgb(${t.accent})` } : undefined}>
                      {t.label.toUpperCase()}
                    </span>
                    <span className="truncate text-[9px] leading-tight text-[#7fa9bf]">
                      {reason ?? (lastUsed ? `${t.benefit} · ${lastUsed}` : t.benefit)}
                    </span>
                  </span>
                  <span className="flex flex-none items-center gap-1 pl-1">
                    <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ backgroundColor: dotColor }} />
                    <span className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: dotColor }}>
                      {statusWord}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className="w-full truncate text-center text-[10px] font-extrabold tracking-[0.08em]" style={enabled ? { color: `rgb(${t.accent})` } : undefined}>
                    {t.label.toUpperCase()}
                  </span>
                  <span className="w-full truncate text-center text-[9px] leading-tight text-[#7fa9bf]">
                    {reason ? "Unavailable" : (lastUsed ? `${t.benefit} · ${lastUsed}` : t.benefit)}
                  </span>
                </>
              )}
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
      harvest.mutate({ sell: false });
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
                  <p className="truncate text-[11px] font-bold text-gray-100">{e.title}</p>
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
            ✂️ Harvest
          </button>
        )}
      </div>

      {/* PLANT INSIGHTS */}
      <div className="rounded-xl border border-[#1c3447] bg-[#0d1d2b] p-2.5">
        <h3 className="mb-1.5 text-[10px] font-extrabold tracking-[0.18em] text-cyan-300">PLANT INSIGHTS</h3>
        {/* 6-chip glanceable row (design punch list items 3 + 10): honest fallbacks,
            no dense paragraphs. Deeper science stays on Inspect / the journal. */}
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          <InsightChip icon="🌸" label="Top cola" value={topCola} strong={topCola === "Strong"} />
          <InsightChip
            icon="❤️"
            label="Health"
            value={`${Math.round(plant.health)}%`}
            strong={plant.health >= 70}
            warn={plant.health < 40}
          />
          <InsightChip
            icon="👃"
            label="Aroma"
            value={strain?.terpenes?.length ? strain.terpenes[0] : "Not scanned"}
            cap
          />
          <InsightChip
            icon="❄️"
            label="Trichomes"
            value={tr?.active ? `${Math.round(tr.cloudy_pct)}% cloudy · ${Math.round(tr.amber_pct)}% amber` : "Not yet"}
          />
          <InsightChip
            icon="🔥"
            label="Care streak"
            value={plant.care_streak ? `${plant.care_streak}d` : "—"}
            strong={!!(plant.care_streak && plant.care_streak >= 5)}
          />
          <InsightChip
            icon="💎"
            label="Resin score"
            value={plant.resin_score ? `${Math.round(plant.resin_score)}/100` : "—"}
            strong={!!(plant.resin_score && plant.resin_score >= 70)}
          />
        </div>
        <Link href={`/dashboard/plants/${plant.id}#journal`} className="mt-2 block text-[10px] font-semibold text-cyan-300 hover:underline">
          📓 Open journal →
        </Link>
      </div>
    </div>
  );
}

function InsightChip({
  icon,
  label,
  value,
  strong,
  warn,
  cap,
}: {
  icon: string;
  label: string;
  value: string;
  strong?: boolean;
  warn?: boolean;
  cap?: boolean;
}) {
  return (
    <div className="flex min-h-[46px] flex-col justify-center rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1">
      <span className="text-[9px] text-[#7fa9bf]">
        {icon} {label}
      </span>
      <span
        className={`truncate text-[11px] font-bold ${cap ? "capitalize" : ""} ${
          warn ? "text-red-400" : strong ? "text-grow-300" : "text-gray-100"
        }`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * PLANT PROGRESS strip (design punch list "remaining" item 5, honest subset) —
 * a compact stage-progress row fed entirely by the server's `plant.forecast`
 * (stage / hours_in_stage / stage_progress_pct / hours_to_harvest). Care-streak
 * and resin-score stats are deliberately NOT shown: no backend tracks them, and
 * we never invent numbers.
 */
export function PlantProgressStrip({ forecast }: { forecast: StageForecast }) {
  // Day within the CURRENT stage, 1-based (hour 0–23 = day 1).
  const stageDay = Math.max(1, Math.floor(forecast.hours_in_stage / 24) + 1);
  const pct = Math.max(0, Math.min(100, Math.round(forecast.stage_progress_pct)));
  // Same whole-day countdown rule as the HUD chip: never show 0 until ready.
  const harvestNote = forecast.is_harvest_ready
    ? "Harvest ready"
    : `≈${Math.max(1, Math.ceil(forecast.hours_to_harvest / 24))}d to harvest`;
  return (
    <div className="rounded-xl border border-[#1c3447] bg-[#0d1d2b] p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[10px] font-extrabold tracking-[0.18em] text-cyan-300">PLANT PROGRESS</h3>
        <span className="font-mono text-[10px] font-bold text-white/70">{harvestNote}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-none text-[11px] font-bold text-gray-100">
          Day {stageDay} of {titleCase(forecast.stage)}
        </span>
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#11212e]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-grow-400 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="flex-none font-mono text-[11px] font-bold text-grow-300">{pct}%</span>
      </div>
    </div>
  );
}

/**
 * Footer encouragement bar (design punch list "remaining" item 4) — slim
 * full-width closer for the GROW sheet: a small circular health dial (real
 * plant.health %) + copy that adapts HONESTLY to the plant's state instead of
 * cheerleading a dying plant.
 */
export function EncouragementFooter({ health }: { health: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(health)));
  const tier = pct >= 70 ? "thriving" : pct >= 40 ? "struggling" : "critical";
  const line =
    tier === "thriving"
      ? "Keep it up. She's thriving."
      : tier === "struggling"
        ? "She needs a little care."
        : "She's in trouble — act now.";
  const ring = tier === "thriving" ? "#62d99a" : tier === "struggling" ? "#fbbf24" : "#f87171";
  // SVG ring: r=15 → circumference ≈ 94.25; offset the gap for the missing %.
  const C = 2 * Math.PI * 15;
  return (
    <div className={`flex w-full items-center gap-2.5 rounded-xl border border-[#1c3447] bg-[#0d1d2b] px-2.5 py-2 ${pct < 30 ? "gpe-health-danger" : ""}`}>
      <svg width="36" height="36" viewBox="0 0 36 36" className="flex-none -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="#11212e" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke={pct < 30 ? "#dc2626" : ring}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct / 100)}
        />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-gray-100">Your actions make a difference</p>
        <p className="text-[10px] text-[#7fa9bf]">{line}</p>
      </div>
      <span className="flex-none font-mono text-[11px] font-bold" style={{ color: pct < 30 ? "#dc2626" : ring }}>
        {pct}%
      </span>
    </div>
  );
}

/**
 * Inline BOOSTS section (design punch list item 2) — the SINGLE boost-apply
 * surface in the chamber: compact status row in the GROW sheet with the live
 * multiplier, the active boost's remaining time, and a QUICK BOOSTS row of
 * one-tap chips (one per boost type) that apply directly via the shared
 * store. (A second, floating tray — ArcadeHUD — used to duplicate this same
 * apply UI; it was removed, and ArcadeHUD now only owns REWIND + the chain
 * row.) Reads the existing boostEngine store only — no new boost economy.
 */
export function BoostsInline() {
  const activeBoost = useBoostStore((s) => s.activeBoost);
  const boostExpiresAt = useBoostStore((s) => s.boostExpiresAt);
  const getMultiplier = useBoostStore((s) => s.getMultiplier);
  const applyBoost = useBoostStore((s) => s.applyBoost);
  const cooldownUntil = useBoostStore((s) => s.cooldownUntil);
  const now = Date.now();
  const anyCooldown = BOOST_TYPES.some((t) => (cooldownUntil[t] ?? 0) > now);
  // 1s tick keeps the countdown AND the chip cooldowns honest while either runs.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeBoost && !anyCooldown) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [activeBoost, anyCooldown]);

  const remaining = activeBoost && boostExpiresAt > now ? boostExpiresAt - now : 0;
  const total = activeBoost ? BOOST_CONFIG[activeBoost].durationMs : 1;
  const mult = getMultiplier();
  const active = remaining > 0 && activeBoost;

  // Quick Boosts row (mockup): tap a chip to apply that boost directly. The
  // per-type cooldown lives in the shared boostEngine store, so these chips
  // stay honest across remounts, and only fire the plant reaction when the
  // boost actually applied (applyBoost also rejects a weaker boost while a
  // stronger one is active).
  const onQuickBoost = (type: (typeof BOOST_TYPES)[number]) => {
    if (!applyBoost(type)) return;
    dispatchCareReaction("boost");
  };

  return (
    <div className="rounded-xl border border-[#1c3447] bg-[#0d1d2b] p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[10px] font-extrabold tracking-[0.18em] text-amber-200">
          BOOSTS{active ? " · 1 active" : ""}
        </h3>
        <span className={`font-mono text-[11px] font-bold ${mult > 1 ? "text-grow-300" : "text-white/60"}`}>
          🌿 {mult}×
        </span>
      </div>
      <div className="flex items-center gap-2">
        {active ? (
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-gray-100">
              {BOOST_CONFIG[activeBoost].label} · {Math.ceil(remaining / 60_000)}m left
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#11212e]">
              <div
                className="h-full rounded-full bg-grow-400 transition-[width] duration-1000"
                style={{ width: `${(remaining / total) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="flex-1 text-[10px] text-[#7fa9bf]">No boost active — speed up the grow.</p>
        )}
      </div>
      {/* QUICK BOOSTS — one-tap chips for the 4 boost types, sourced from the
          shared boostEngine config so this is the single source of truth for
          applying a boost. */}
      <div className="mt-1.5 flex items-stretch gap-1.5">
        {BOOST_TYPES.map((type) => {
          const cfg = BOOST_CONFIG[type];
          const isActive = activeBoost === type && !!active;
          const cdLeft = Math.max(0, (cooldownUntil[type] ?? 0) - now);
          const onCooldown = cdLeft > 0;
          return (
            <button
              key={type}
              onClick={() => onQuickBoost(type)}
              disabled={onCooldown}
              title={
                onCooldown
                  ? `${cfg.label} · ready in ${Math.ceil(cdLeft / 1000)}s`
                  : `${cfg.label} · ${cfg.multiplier}× for ${Math.round(cfg.durationMs / 1000)}s`
              }
              aria-label={
                onCooldown
                  ? `${cfg.label} on cooldown, ready in ${Math.ceil(cdLeft / 1000)} seconds`
                  : `Quick-apply ${cfg.label}, ${cfg.multiplier} times multiplier`
              }
              className={`flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-lg border font-mono text-[11px] font-bold transition-colors ${
                onCooldown
                  ? "cursor-not-allowed border-[#1c3447] bg-[#0a1722] text-cyan-200/40"
                  : isActive
                    ? "border-grow-400/60 bg-grow-500/15 text-grow-200"
                    : "border-white/10 bg-white/[0.04] text-cyan-100 hover:border-amber-300/40 hover:bg-amber-300/10"
              }`}
            >
              <span className={`text-sm leading-none ${onCooldown ? "opacity-50" : ""}`}>{BOOST_ICONS[type]}</span>
              <span>{onCooldown ? `${Math.ceil(cdLeft / 1000)}s` : `${cfg.multiplier}×`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
