"use client";

// Arcade Mode — the control HUD.
//
// A dark-glass panel anchored bottom-center of the chamber, above the nav tabs.
// Holds the 4 boost buttons (with cooldown rings), the live grow-speed readout, the
// active-boost countdown, and the REWIND control (a slide-up snapshot scrubber).
// Lazy-imported by the chamber so it's tree-shaken out of every other route.
//
// All state is in-memory (boostStore / rewindStore). No DB, no API, no chain here —
// the Phase-2 chain row is mounted via the optional `chainSlot`.

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useBoostStore,
  BOOST_CONFIG,
  BOOST_COLORS,
  BOOST_ICONS,
  BOOST_TYPES,
  type BoostType,
} from "@/lib/arcade/boostEngine";
import { useRewindStore } from "@/lib/arcade/timeRewind";
import { resumeAudio, playBoostApply, playRewindActive } from "@/lib/arcade/soundHooks";
import { dispatchCareReaction } from "@/components/plant/careReactionsData";

function fmtMult(m: number): string {
  return Number.isInteger(m) ? `${m}×` : `${m}×`;
}

export function ArcadeHUD({
  reducedMotion = false,
  chainSlot,
}: {
  reducedMotion?: boolean;
  /** Dismiss the HUD (clean simulation mode). */
  onClose?: () => void;
  /** Phase-2 chain row (WalletConnect + mint). Rendered above the boost buttons. */
  chainSlot?: ReactNode;
}) {
  const applyBoost = useBoostStore((s) => s.applyBoost);
  const activeBoost = useBoostStore((s) => s.activeBoost);
  const boostExpiresAt = useBoostStore((s) => s.boostExpiresAt);
  const getMultiplier = useBoostStore((s) => s.getMultiplier);

  const snapshots = useRewindStore((s) => s.snapshots);
  const rewindActive = useRewindStore((s) => s.rewindActive);
  const rewindTo = useRewindStore((s) => s.rewindTo);
  const exitRewind = useRewindStore((s) => s.exitRewind);

  // Per-type cooldown clock (local — driven by HUD taps).
  const cooldownUntil = useRef<Record<string, number>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  // Quick tool tray, not a room: collapsed to a slim pill until the player
  // opens it, and it re-collapses right after a boost is applied.
  const [collapsed, setCollapsed] = useState(true);
  // A coarse tick forces re-render so rings/countdowns advance.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => (t + 1) % 1_000_000), 100);
    return () => window.clearInterval(id);
  }, []);

  const now = Date.now();
  const mult = getMultiplier();
  const boostRemaining = activeBoost && boostExpiresAt > now ? boostExpiresAt - now : 0;
  const boostTotal = activeBoost ? BOOST_CONFIG[activeBoost].durationMs : 1;

  function onBoostTap(type: BoostType) {
    if ((cooldownUntil.current[type] ?? 0) > now) return;
    resumeAudio();
    applyBoost(type);
    playBoostApply();
    cooldownUntil.current[type] = Date.now() + BOOST_CONFIG[type].cooldownMs;
    // Quick-tray behaviour: close the tray and let the PLANT show the feedback.
    setCollapsed(true);
    dispatchCareReaction("boost");
  }

  function onRewindOpen() {
    setSheetOpen((o) => {
      const next = !o;
      if (next) playRewindActive();
      return next;
    });
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[100px] z-20 flex flex-col items-start gap-2 px-2">
      {/* Snapshot scrubber sheet (slides up above the panel). */}
      {sheetOpen && (
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-cyan-400/30 bg-[#08141e]/90 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">
              Rewind · {snapshots.length} snapshots
            </span>
            {rewindActive && (
              <button
                onClick={() => exitRewind()}
                className="rounded-md border border-cyan-400/40 px-2 py-1 text-[10px] font-bold text-cyan-100 hover:bg-cyan-400/10"
              >
                Back to live
              </button>
            )}
          </div>
          {snapshots.length === 0 ? (
            <p className="px-1 py-3 text-center text-[11px] text-cyan-200/50">
              No snapshots yet — they capture as the plant grows.
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {snapshots.map((s, i) => (
                <button
                  key={s.at}
                  onClick={() => rewindTo(i, { reducedMotion })}
                  className="flex h-16 w-16 flex-none flex-col items-center justify-center rounded-lg border border-cyan-400/25 bg-[#0d1d2b] text-center hover:border-cyan-300/60"
                >
                  <span className="text-lg">🌿</span>
                  <span className="font-mono text-[9px] text-cyan-200/70">d{Math.round(s.day)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Optional Phase-2 chain row. */}
      {chainSlot && <div className="pointer-events-auto w-full max-w-md">{chainSlot}</div>}

      {/* Collapsed: a slim pill — quick tool tray, not a room. */}
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Open boosts tray"
          aria-expanded={false}
          className="pointer-events-auto flex min-h-[40px] items-center gap-1.5 self-start rounded-full border border-cyan-400/30 bg-[#08141e]/85 px-3.5 py-1.5 font-mono text-[11px] font-bold text-cyan-100 shadow-lg backdrop-blur hover:border-cyan-300/60"
          style={mult > 1 ? { boxShadow: "0 0 14px rgba(118,192,36,0.4)", borderColor: "rgba(118,192,36,0.6)" } : undefined}
        >
          ⚡ Boosts <span className={mult > 1 ? "text-grow-300" : "text-white/70"}>{fmtMult(mult)}</span>
          {boostRemaining > 0 && <span className="text-[9px] text-grow-300/80">· active</span>}
        </button>
      ) : (
      <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-cyan-400/30 bg-[#08141e]/90 p-2.5 shadow-lg backdrop-blur">
        {/* Top row: grow-speed readout + active boost countdown + dismiss. */}
        <div className="flex items-center gap-2">
          <span className="flex items-baseline gap-1 font-mono">
            <span className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/60">Grow</span>
            <span
              className={`tabular-nums text-lg font-extrabold transition-transform ${
                mult > 1 ? "text-grow-300" : "text-white"
              }`}
            >
              🌿 {fmtMult(mult)}
            </span>
          </span>
          {boostRemaining > 0 && activeBoost && (
            <div className="flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#11212e]">
                <div
                  className="h-full rounded-full transition-[width] duration-100"
                  style={{
                    width: `${(boostRemaining / boostTotal) * 100}%`,
                    background: BOOST_COLORS[activeBoost][1],
                  }}
                />
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse boosts tray"
            className="ml-auto flex h-7 w-7 flex-none items-center justify-center rounded-md text-cyan-200/60 hover:bg-white/5 hover:text-cyan-100"
          >
            ✕
          </button>
        </div>

        {/* Boost buttons + rewind. */}
        <div className="flex items-stretch gap-1.5">
          {BOOST_TYPES.map((type) => {
            const cfg = BOOST_CONFIG[type];
            const until = cooldownUntil.current[type] ?? 0;
            const onCooldown = until > now;
            const cdPct = onCooldown ? ((until - now) / cfg.cooldownMs) * 100 : 0;
            const isActive = activeBoost === type && boostRemaining > 0;
            const [c1, c2] = BOOST_COLORS[type];
            return (
              <button
                key={type}
                onClick={() => onBoostTap(type)}
                disabled={onCooldown}
                aria-label={`${cfg.label} ${cfg.multiplier}× boost`}
                className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border p-1 text-center transition-colors ${
                  onCooldown
                    ? "cursor-not-allowed border-[#1c3447] bg-[#0a1722] opacity-50"
                    : "border-cyan-400/30 bg-[#0d1d2b] hover:border-cyan-300/60"
                }`}
                style={isActive ? { boxShadow: `0 0 14px ${c2}`, borderColor: c1 } : undefined}
              >
                {/* Cooldown ring (conic sweep that empties as it cools). */}
                {onCooldown && (
                  <span
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{
                      background: `conic-gradient(rgba(108,240,255,0.25) ${cdPct}%, transparent ${cdPct}%)`,
                    }}
                    aria-hidden
                  />
                )}
                <span className="text-base leading-none">{BOOST_ICONS[type]}</span>
                <span className="font-mono text-[8px] uppercase leading-tight tracking-wide text-cyan-200/70">
                  {cfg.label.split(" ")[0]}
                </span>
                <span className="font-mono text-[10px] font-bold text-white">{cfg.multiplier}×</span>
              </button>
            );
          })}

          {/* Rewind toggle. */}
          <button
            onClick={onRewindOpen}
            aria-label="Time rewind"
            aria-pressed={sheetOpen}
            className={`flex min-h-[56px] w-12 flex-none flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${
              sheetOpen || rewindActive
                ? "border-cyan-300 bg-[#16364c] text-cyan-100"
                : "border-cyan-400/30 bg-[#0d1d2b] text-cyan-200/80 hover:border-cyan-300/60"
            }`}
          >
            <span className="text-base leading-none">⏪</span>
            <span className="font-mono text-[8px] uppercase tracking-wide">Rewind</span>
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
