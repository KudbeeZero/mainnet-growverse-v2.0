"use client";

import { Countdown } from "@/components/ui/Countdown";
import { hours } from "@/lib/format";
import type { StageForecast } from "@/lib/types";

const JUMPS: { label: string; days: number }[] = [
  { label: "+1h", days: 1 / 24 },
  { label: "+6h", days: 6 / 24 },
  { label: "+1d", days: 1 },
];

/**
 * Center-bottom time strip. The accelerate buttons advance the growth PREVIEW
 * only — they never mutate server state (the simulation is server-authoritative).
 */
export function TimeControls({
  forecast,
  previewing,
  previewDay,
  liveNominalDay,
  maxPreviewDay,
  onPreview,
  onLive,
}: {
  forecast: StageForecast | undefined;
  previewing: boolean;
  previewDay: number;
  liveNominalDay: number;
  maxPreviewDay: number;
  onPreview: (day: number) => void;
  onLive: () => void;
}) {
  const base = previewing ? previewDay : liveNominalDay;
  const jump = (days: number) => onPreview(Math.min(maxPreviewDay, base + days));

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-cyan-400/15 bg-[#0b1b27]/70 px-3 py-2">
      <div className="text-center">
        <div className="instrument-label text-[9px]">TIME REMAINING</div>
        <div className="font-mono text-sm font-bold text-white">
          {forecast?.harvest_eta ? (
            <Countdown to={forecast.harvest_eta} />
          ) : forecast ? (
            hours(forecast.hours_to_harvest)
          ) : (
            "—"
          )}
        </div>
      </div>

      <div className="h-7 w-px bg-ink-700" aria-hidden />

      <div className="text-center">
        <div className="instrument-label text-[9px]">SPEED</div>
        <div className="font-mono text-sm font-bold text-cyan-200">1x · NORMAL</div>
      </div>

      <div className="h-7 w-px bg-ink-700" aria-hidden />

      <div className="flex items-center gap-1.5">
        <span className="instrument-label text-[9px]">PREVIEW</span>
        {JUMPS.map((j) => (
          <button
            key={j.label}
            onClick={() => jump(j.days)}
            className="min-h-[32px] rounded-md border border-cyan-400/30 bg-cyan-400/[0.06] px-2.5 text-xs font-bold text-cyan-100 hover:bg-cyan-400/15"
          >
            {j.label}
          </button>
        ))}
        {previewing && (
          <button
            onClick={onLive}
            className="min-h-[32px] rounded-md border border-grow-600 bg-grow-700/40 px-2.5 text-xs font-bold text-grow-100 hover:bg-grow-700/60"
          >
            LIVE
          </button>
        )}
      </div>
    </div>
  );
}
