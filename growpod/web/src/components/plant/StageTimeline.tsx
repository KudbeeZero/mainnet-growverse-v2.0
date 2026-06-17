"use client";

import type { ReactNode } from "react";
import { Countdown } from "@/components/ui/Countdown";
import { STAGE_ORDER, STAGE_INFO } from "@/lib/stageInfo";
import { hours, num } from "@/lib/format";
import type { GrowthStage, StageForecast } from "@/lib/types";

interface Props {
  forecast: StageForecast;
  harvested: boolean;
  isAlive: boolean;
}

/** The 6-stage journey, with completed / current / upcoming states. */
function Stepper({ index, compact = false }: { index: number; compact?: boolean }) {
  return (
    <div className="flex items-start gap-1">
      {STAGE_ORDER.map((s: GrowthStage, i) => {
        const done = i < index;
        const current = i === index;
        return (
          <div key={s} className="flex flex-1 flex-col items-center gap-1">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                current
                  ? "bg-grow-400 ring-2 ring-grow-500/40"
                  : done
                    ? "bg-grow-600"
                    : "bg-ink-600"
              }`}
            />
            {!compact && (
              <span
                className={`text-center text-[10px] leading-tight ${
                  current ? "text-grow-300" : done ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {STAGE_INFO[s].label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MiniBar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
      <div
        className="h-full rounded-full bg-grow-500 transition-all duration-500"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900/50 px-2.5 py-1.5">
      <div className="instrument-label text-[10px]">{label}</div>
      <div className="text-sm text-gray-100">{children}</div>
    </div>
  );
}

/** Full lifecycle timeline for the plant detail page. */
export function StageTimeline({ forecast, harvested, isAlive }: Props) {
  const info = STAGE_INFO[forecast.stage];
  const dead = !isAlive && !harvested;
  const growing = isAlive && !harvested && !forecast.is_harvest_ready;
  const nextLabel = STAGE_INFO[forecast.next_stage ?? forecast.stage].label;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          {info.icon}
        </span>
        <div>
          <div className="text-sm font-semibold text-gray-100">{info.label}</div>
          <div className="text-[11px] text-gray-500">
            Stage {forecast.stage_index + 1} of {forecast.stage_count}
          </div>
        </div>
      </div>

      <Stepper index={forecast.stage_index} />

      {growing && (
        <>
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>
              {num(forecast.stage_progress_pct)}% through {info.label}
            </span>
            <span>Next: {nextLabel}</span>
          </div>
          <MiniBar pct={forecast.stage_progress_pct} />
          <div className="grid grid-cols-2 gap-2">
            <Readout label={`Next stage (${nextLabel})`}>
              <Countdown to={forecast.next_stage_eta} />
            </Readout>
            <Readout label="Harvest-ready (est.)">
              <Countdown to={forecast.harvest_eta} />
            </Readout>
          </div>
        </>
      )}

      {forecast.is_harvest_ready && !harvested && (
        <div className="rounded-md border border-amber-700 bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
          ✂️ Ready to harvest — cut it, then dry and cure to lock in quality.
        </div>
      )}
      {harvested && (
        <div className="rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-gray-400">
          Harvested — this grow is complete.
        </div>
      )}
      {dead && (
        <div className="rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          This plant has died, so its timeline has stopped.
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-500">{info.blurb}</p>

      {growing && (
        <p className="text-[10px] leading-relaxed text-gray-600">
          At current health this stage runs ~{hours(forecast.stage_total_hours)} (
          {hours(forecast.stage_base_hours)} at full health). Times are estimates: stress
          slows growth and attentive care speeds it up.
        </p>
      )}
    </div>
  );
}

/** Compact stepper + harvest estimate for dashboard plant cards. */
export function StageTimelineCompact({ forecast, harvested, isAlive }: Props) {
  const info = STAGE_INFO[forecast.stage];
  let trailing: ReactNode;
  if (harvested) trailing = <span className="text-gray-400">Harvested</span>;
  else if (!isAlive) trailing = <span className="text-red-300">Died</span>;
  else if (forecast.is_harvest_ready)
    trailing = <span className="text-amber-300">✂️ Ready to harvest</span>;
  else
    trailing = (
      <span className="text-grow-300">Harvest ~{hours(forecast.hours_to_harvest)}</span>
    );

  return (
    <div className="space-y-1.5">
      <Stepper index={forecast.stage_index} compact />
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-400">
          <span aria-hidden>{info.icon}</span> {info.label}
        </span>
        {trailing}
      </div>
    </div>
  );
}
