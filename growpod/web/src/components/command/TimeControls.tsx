"use client";

import { Countdown } from "@/components/ui/Countdown";
import { hours } from "@/lib/format";
import type { StageForecast } from "@/lib/types";

/**
 * Center-bottom time strip. Shows the live TIME REMAINING until harvest.
 *
 * The SPEED (global turbo) toggle and the ACCELERATE TIME jump buttons were
 * removed — players no longer fast-forward a grow from here; the clock just
 * reports the real harvest ETA.
 */
export function TimeControls({ forecast }: { forecast: StageForecast | undefined }) {
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
    </div>
  );
}
