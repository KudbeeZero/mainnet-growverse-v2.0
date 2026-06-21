"use client";

import { Countdown } from "@/components/ui/Countdown";
import { hours } from "@/lib/format";
import type { StageForecast } from "@/lib/types";

const JUMPS: { label: string; hours: number }[] = [
  { label: "+1h", hours: 1 },
  { label: "+6h", hours: 6 },
  { label: "+1d", hours: 24 },
];

/**
 * Center-bottom time strip. ACCELERATE TIME really fast-forwards the plant's grow
 * clock by the given hours (server-authoritative, deterministic recompute) — the
 * one place to actually speed a single grow up.
 */
export function TimeControls({
  forecast,
  turboOn = false,
  turboX = 10,
  onAdvanceHours,
  advancing = false,
  disabled = false,
}: {
  forecast: StageForecast | undefined;
  /** Live global turbo state (read-only readout) — the faucet is toggled in the Grow Chamber. */
  turboOn?: boolean;
  turboX?: number;
  onAdvanceHours: (hours: number) => void;
  advancing?: boolean;
  disabled?: boolean;
}) {
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
        <div
          className={`font-mono text-sm font-bold ${turboOn ? "text-green-300" : "text-cyan-200"}`}
        >
          {turboOn ? `⚡ ${turboX}× · TURBO` : "1× · NORMAL"}
        </div>
      </div>

      <div className="h-7 w-px bg-ink-700" aria-hidden />

      <div className="flex items-center gap-1.5">
        <span className="instrument-label text-[9px]">ACCELERATE TIME</span>
        {JUMPS.map((j) => (
          <button
            key={j.label}
            onClick={() => onAdvanceHours(j.hours)}
            disabled={disabled || advancing}
            className="min-h-[32px] rounded-md border border-cyan-400/30 bg-cyan-400/[0.06] px-2.5 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {advancing ? "…" : j.label}
          </button>
        ))}
      </div>
    </div>
  );
}
