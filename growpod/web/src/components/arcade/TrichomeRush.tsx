"use client";

// Arcade Mode — Trichome Rush overlay.
//
// A `fixed inset-0` takeover (design/12's plug-in point #4) that renders the
// timed tap-the-trichome mini-game over the chamber viewport. All game state
// lives in `useTrichomeRushStore` (lib/arcade/trichomeRush.ts) — this
// component only drives the store's `tick()` loop and renders it. No DB, no
// API, no plant/economy state touched here; a finished session's score is a
// separate local/cosmetic thing (see the store's header comment).

import { useEffect, useRef, useState } from "react";
import {
  useTrichomeRushStore,
  computeScore,
  factForSeed,
  COUNTDOWN_MS,
  SESSION_MS,
  type RushTarget,
} from "@/lib/arcade/trichomeRush";

interface HitFx {
  id: number;
  x: number;
  y: number;
  size: number;
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function TargetButton({
  target,
  now,
  reducedMotion,
  onHit,
}: {
  target: RushTarget;
  now: number;
  reducedMotion: boolean;
  onHit: (t: RushTarget) => void;
}) {
  const elapsed = now - target.spawnedAt;
  const pctLeft = Math.max(0, Math.min(100, 100 - (elapsed / target.ttlMs) * 100));
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onHit(target);
      }}
      aria-label="Trichome target"
      className={`absolute flex items-center justify-center rounded-full ${
        reducedMotion ? "" : "gpe-trich-pop"
      }`}
      style={{
        left: `${target.x * 100}%`,
        top: `${target.y * 100}%`,
        width: target.size,
        height: target.size,
        transform: "translate(-50%, -50%)",
        background: "radial-gradient(circle, #ffffff 0%, #6cf0ff 45%, rgba(108,240,255,0.15) 75%, transparent 100%)",
        boxShadow: "0 0 14px rgba(108,240,255,0.85), 0 0 3px rgba(255,255,255,0.9)",
      }}
    >
      {/* TTL ring — a plain conic-gradient recomputed on each tick (numeric, not
          a CSS animation), so it stays accurate under reduced motion too. */}
      <span
        className="pointer-events-none absolute inset-[-4px] rounded-full"
        style={{
          background: `conic-gradient(rgba(255,255,255,0.9) ${pctLeft}%, transparent ${pctLeft}%)`,
          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
        }}
        aria-hidden
      />
    </button>
  );
}

export function TrichomeRush({
  open,
  onClose,
  reducedMotion = false,
  plantId,
  strainName,
}: {
  open: boolean;
  onClose: () => void;
  reducedMotion?: boolean;
  /** Optional context for the best-effort on-chain receipt. */
  plantId?: string;
  strainName?: string;
}) {
  const phase = useTrichomeRushStore((s) => s.phase);
  const targets = useTrichomeRushStore((s) => s.targets);
  const hits = useTrichomeRushStore((s) => s.hits);
  const misses = useTrichomeRushStore((s) => s.misses);
  const combo = useTrichomeRushStore((s) => s.combo);
  const comboPeak = useTrichomeRushStore((s) => s.comboPeak);
  const lastResult = useTrichomeRushStore((s) => s.lastResult);
  const bestScore = useTrichomeRushStore((s) => s.bestScore);
  const seed = useTrichomeRushStore((s) => s.seed);
  const countdownEndsAt = useTrichomeRushStore((s) => s.countdownEndsAt);
  const sessionEndsAt = useTrichomeRushStore((s) => s.sessionEndsAt);
  const startSession = useTrichomeRushStore((s) => s.startSession);
  const tick = useTrichomeRushStore((s) => s.tick);
  const hitTargetAction = useTrichomeRushStore((s) => s.hitTarget);
  const registerMiss = useTrichomeRushStore((s) => s.registerMiss);
  const abortSession = useTrichomeRushStore((s) => s.abortSession);
  const dismissResults = useTrichomeRushStore((s) => s.dismissResults);

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [hitFx, setHitFx] = useState<HitFx[]>([]);

  // Drive the game loop at ~10Hz — matches ArcadeHUD's cooldown-clock cadence.
  useEffect(() => {
    if (!open || (phase !== "countdown" && phase !== "playing")) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      tick(t);
      setNowTick(t);
    }, 100);
    return () => window.clearInterval(id);
  }, [open, phase, tick]);

  // Best-effort on-chain receipt (never blocks the UI, always behind isAlgoEnabled()).
  const loggedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!lastResult || loggedAtRef.current === lastResult.at) return;
    loggedAtRef.current = lastResult.at;
    if (process.env.NEXT_PUBLIC_ALGO_ENABLE !== "true") return;
    void import("@/lib/chain/algorand/client").then(({ isAlgoEnabled }) => {
      if (!isAlgoEnabled()) return;
      void import("@/lib/chain/algorand/growEvents").then(({ logArcadeScore }) => {
        logArcadeScore(
          plantId ?? "unknown",
          strainName ?? "unknown",
          "trichome-rush",
          lastResult.score,
          lastResult.comboPeak,
        );
      });
    });
  }, [lastResult, plantId, strainName]);

  if (!open) return null;

  function onHit(t: RushTarget) {
    if (!reducedMotion) {
      const fx: HitFx = { id: t.id, x: t.x, y: t.y, size: t.size };
      setHitFx((f) => [...f, fx]);
      window.setTimeout(() => setHitFx((f) => f.filter((x) => x.id !== fx.id)), 280);
    }
    hitTargetAction(t.id);
  }

  function onSurfaceMiss() {
    if (phase === "playing") registerMiss();
  }

  function onDismiss() {
    if (phase === "playing" || phase === "countdown") abortSession();
    else dismissResults();
    onClose();
  }

  const fact = factForSeed(seed || Math.floor(Date.now() / 86_400_000));
  const countdownRemaining = Math.max(0, Math.ceil((countdownEndsAt - nowTick) / 1000));
  const sessionRemainingMs = Math.max(0, sessionEndsAt - nowTick);
  const sessionPct = phase === "playing" ? Math.max(0, Math.min(100, (sessionRemainingMs / SESSION_MS) * 100)) : 100;
  const liveScore = computeScore({ hits, misses, comboPeak }).score;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#050b12]/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Trichome Rush"
    >
      {/* header — always visible, holds the close/abort control */}
      <div className="flex flex-none items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200/80">
          🧬 Trichome Rush
        </span>
        <button
          onClick={onDismiss}
          aria-label="Close Trichome Rush"
          className="flex h-8 w-8 items-center justify-center rounded-md text-cyan-200/70 hover:bg-white/5 hover:text-cyan-100"
        >
          ✕
        </button>
      </div>

      {/* game surface — targets spawn here; a background tap counts as a miss */}
      <div className="relative min-h-0 flex-1 px-4 pb-4 pt-2" onClick={onSurfaceMiss}>
        {phase === "playing" && (
          <>
            {/* session timer bar */}
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[#11212e]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-300 transition-[width] duration-100"
                style={{ width: `${sessionPct}%` }}
              />
            </div>
            {/* combo / live score readout */}
            <div className="mb-2 flex items-center gap-3 font-mono text-xs">
              <span className="rounded-md border border-cyan-400/30 bg-[#0d1d2b] px-2 py-1 text-cyan-100">
                🧊 Combo <span className="font-bold text-white">{combo}×</span>
              </span>
              <span className="rounded-md border border-cyan-400/30 bg-[#0d1d2b] px-2 py-1 text-cyan-100">
                Score <span className="font-bold text-white">{liveScore}</span>
              </span>
              <span className="ml-auto text-[10px] text-cyan-200/50">
                {hits} hit · {misses} miss
              </span>
            </div>

            <div className="relative h-full w-full overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#08141e]/40">
              {targets.map((t) => (
                <TargetButton key={t.id} target={t} now={nowTick} reducedMotion={reducedMotion} onHit={onHit} />
              ))}
              {!reducedMotion &&
                hitFx.map((fx) => (
                  <span
                    key={fx.id}
                    className="gpe-trich-hit pointer-events-none absolute rounded-full border-2 border-cyan-200"
                    style={{
                      left: `${fx.x * 100}%`,
                      top: `${fx.y * 100}%`,
                      width: fx.size,
                      height: fx.size,
                    }}
                    aria-hidden
                  />
                ))}
            </div>
          </>
        )}

        {phase === "countdown" && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <span className="font-mono text-6xl font-extrabold text-cyan-200 text-glow-grow">
              {countdownRemaining || "GO"}
            </span>
            <span className="text-xs text-cyan-200/60">Get ready to tap the frost…</span>
          </div>
        )}

        {phase === "idle" && (
          <div
            className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm leading-relaxed text-cyan-100/90">
              Tap the glowing trichomes before they fade. Chain hits for a Resin Combo — a miss or a
              timeout resets it. Score converts into a temporary cosmetic frost boost.
            </p>
            {bestScore > 0 && (
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-cyan-200/70">
                Personal best · <span className="font-bold text-white">{bestScore}</span>
              </p>
            )}
            <div className="rounded-xl border border-cyan-400/25 bg-[#0d1d2b]/80 px-4 py-3 text-left text-[11px] leading-relaxed text-cyan-200/70">
              🔬 <strong className="text-cyan-100">Did you know?</strong> {fact}
            </div>
            <button
              onClick={() => startSession()}
              className="rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500/20 to-teal-400/20 px-6 py-3 text-sm font-bold tracking-[0.06em] text-cyan-100 hover:border-cyan-300 hover:from-cyan-500/30 hover:to-teal-400/30"
            >
              ▶ Start Rush
            </button>
          </div>
        )}

        {phase === "results" && lastResult && (
          <div
            className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-3 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-4xl font-extrabold text-white">{lastResult.score}</p>
            {lastResult.score >= bestScore && lastResult.score > 0 && (
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">🏆 New personal best</p>
            )}
            <div className="grid w-full grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="rounded-lg border border-cyan-400/25 bg-[#0d1d2b] px-2 py-1.5">
                <div className="text-cyan-200/60">Hits</div>
                <div className="font-bold text-white">{lastResult.hits}</div>
              </div>
              <div className="rounded-lg border border-cyan-400/25 bg-[#0d1d2b] px-2 py-1.5">
                <div className="text-cyan-200/60">Combo peak</div>
                <div className="font-bold text-white">{lastResult.comboPeak}×</div>
              </div>
              <div className="rounded-lg border border-cyan-400/25 bg-[#0d1d2b] px-2 py-1.5">
                <div className="text-cyan-200/60">Accuracy</div>
                <div className="font-bold text-white">{fmtPct(lastResult.accuracy)}</div>
              </div>
            </div>
            {lastResult.frostBoost.highlightBoost > 0 && (
              <p className="font-mono text-[11px] text-teal-200">
                🧊 +{fmtPct(lastResult.frostBoost.highlightBoost)} frost shimmer ·{" "}
                {Math.round(lastResult.frostBoost.durationMs / 1000)}s (cosmetic only)
              </p>
            )}
            <div className="rounded-xl border border-cyan-400/25 bg-[#0d1d2b]/80 px-4 py-3 text-left text-[11px] leading-relaxed text-cyan-200/70">
              🔬 <strong className="text-cyan-100">Did you know?</strong> {factForSeed(lastResult.seed)}
            </div>
            <div className="flex w-full gap-2">
              <button
                onClick={() => startSession()}
                className="flex-1 rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500/20 to-teal-400/20 px-4 py-2.5 text-sm font-bold text-cyan-100 hover:border-cyan-300"
              >
                ↻ Play Again
              </button>
              <button
                onClick={onDismiss}
                className="rounded-xl border border-[#1c3447] bg-[#0a1722] px-4 py-2.5 text-sm font-semibold text-cyan-200/80 hover:border-cyan-400/50"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="flex-none px-4 pb-[calc(10px+env(safe-area-inset-bottom))] text-center font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-200/30">
        Session up to {Math.round(SESSION_MS / 1000)}s · Countdown {Math.round(COUNTDOWN_MS / 1000)}s · Arcade score only, never economy
      </p>
    </div>
  );
}
