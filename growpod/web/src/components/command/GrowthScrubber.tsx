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
  disabled = false,
  onScrub,
  onReset,
}: {
  day: number;
  maxDay: number;
  stageLabel: string;
  previewing: boolean;
  disabled?: boolean;
  onScrub: (day: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-grow-500/20 bg-[#0b1b14]/60 px-3 py-2">
      <div className="flex items-center gap-2.5">
        <span className="w-[92px] flex-none instrument-label text-[9px] text-grow-300/80">
          PREVIEW GROWTH
        </span>
        <input
          type="range"
          min={0}
          max={maxDay}
          step={0.5}
          value={Math.min(day, maxDay)}
          disabled={disabled}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label="Preview growth day"
          className="h-2 flex-1 cursor-pointer accent-grow-400 disabled:cursor-not-allowed disabled:opacity-50"
        />
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
