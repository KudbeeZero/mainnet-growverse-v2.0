"use client";

// PREVIEW GROWTH scrubber — drag to watch the plant render forward and back
// through its whole life (seed → harvest) without touching the server. Unlike
// ACCELERATE TIME (a real, server-authoritative jump), this is a pure visual
// "what would it look like" preview, so it works even when the backend is
// unreachable and never changes the plant's real age.

import { titleCase } from "@/lib/format";

export function GrowthScrubber({
  day,
  maxDay,
  stageLabel,
  previewing,
  readyFromDay,
  harvestDay,
  disabled = false,
  onScrub,
  onReset,
}: {
  day: number;
  maxDay: number;
  stageLabel: string;
  previewing: boolean;
  /** Start of the ripening/harvest window (days), for the green track zone. */
  readyFromDay: number;
  /** Fully harvest-ready day, for the tick marker. */
  harvestDay: number;
  disabled?: boolean;
  onScrub: (day: number) => void;
  onReset: () => void;
}) {
  const pct = (d: number) => `${Math.max(0, Math.min(100, (d / maxDay) * 100))}%`;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-grow-500/20 bg-[#0b1b14]/60 px-3 py-2">
      <div className="flex items-center gap-2.5">
        <span className="w-[92px] flex-none instrument-label text-[9px] text-grow-300/80">
          PREVIEW GROWTH
        </span>
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={maxDay}
            step={0.5}
            value={Math.min(day, maxDay)}
            disabled={disabled}
            onChange={(e) => onScrub(Number(e.target.value))}
            aria-label="Preview growth day"
            className="h-2 w-full cursor-pointer accent-grow-400 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {/* harvest-window guide: green "ready" zone + a chop tick, so scrubbing
              shows WHEN the bud is ripe, not just what it looks like. */}
          <div className="relative mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-700" aria-hidden>
            <div
              className="absolute inset-y-0 bg-grow-500/45"
              style={{ left: pct(readyFromDay), right: 0 }}
            />
            <div
              className="absolute top-1/2 h-2 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-amber-300"
              style={{ left: pct(harvestDay) }}
              title="Harvest-ready"
            />
          </div>
        </div>
        <span className="w-[34px] flex-none text-right font-mono text-[11px] font-bold text-white">
          d{Math.round(day)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] leading-snug text-grow-200/50">
          {previewing
            ? `Previewing ${titleCase(stageLabel)} — not this plant's real age.`
            : "Drag to watch it grow seed → harvest (visual only, no server)."}
        </span>
        {previewing && (
          <button
            type="button"
            onClick={onReset}
            className="flex-none rounded-md border border-grow-600/50 bg-grow-900/40 px-2 py-0.5 text-[9px] font-bold text-grow-200 hover:border-grow-400/60"
          >
            Back to live
          </button>
        )}
      </div>
    </div>
  );
}
