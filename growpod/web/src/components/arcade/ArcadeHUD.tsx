"use client";

// Arcade Mode — the REWIND + chain control HUD.
//
// A small floating control anchored bottom-center of the chamber, above the nav
// tabs. Holds ONLY the REWIND control (a slide-up snapshot scrubber) and the
// optional Phase-2 chain row (`chainSlot`: WalletConnect + mint). Lazy-imported
// by the chamber so it's tree-shaken out of every other route.
//
// The boost-APPLY UI used to live here too (4 boost buttons duplicating the
// live grow-speed readout) — a second, floating boost surface showing the same
// `useBoostStore` state as the inline BOOSTS section below it. It was removed:
// `BoostsInline` (components/plant/ChamberDock.tsx) is now the single boost
// surface, embedded in the GROW/ARCADE sheet. This component only owns what
// BoostsInline doesn't: REWIND (`useRewindStore`) and the chain row.
//
// All rewind state is in-memory (rewindStore). No DB, no API, no chain here —
// the Phase-2 chain row is mounted via the optional `chainSlot`.

import { useState, type ReactNode } from "react";
import { useRewindStore } from "@/lib/arcade/timeRewind";
import { playRewindActive } from "@/lib/arcade/soundHooks";

export function ArcadeHUD({
  reducedMotion = false,
  chainSlot,
}: {
  reducedMotion?: boolean;
  /** Phase-2 chain row (WalletConnect + mint). Rendered above the rewind button. */
  chainSlot?: ReactNode;
}) {
  const snapshots = useRewindStore((s) => s.snapshots);
  const rewindActive = useRewindStore((s) => s.rewindActive);
  const rewindTo = useRewindStore((s) => s.rewindTo);
  const exitRewind = useRewindStore((s) => s.exitRewind);

  const [sheetOpen, setSheetOpen] = useState(false);

  function onRewindOpen() {
    setSheetOpen((o) => {
      const next = !o;
      if (next) playRewindActive();
      return next;
    });
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[100px] z-20 flex flex-col items-end gap-2 px-2">
      {/* Snapshot scrubber sheet (slides up above the button). */}
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

      {/* Rewind toggle — the only remaining tray control (boosts moved to the
          inline BOOSTS section in the GROW/ARCADE sheet). */}
      <button
        onClick={onRewindOpen}
        aria-label="Time rewind"
        aria-pressed={sheetOpen}
        className={`pointer-events-auto flex h-12 w-12 flex-none items-center justify-center rounded-full border shadow-lg backdrop-blur transition-colors ${
          sheetOpen || rewindActive
            ? "border-cyan-300 bg-[#16364c] text-cyan-100"
            : "border-cyan-400/30 bg-[#08141e]/90 text-cyan-200/80 hover:border-cyan-300/60"
        }`}
      >
        <span className="text-lg leading-none">⏪</span>
      </button>
    </div>
  );
}
