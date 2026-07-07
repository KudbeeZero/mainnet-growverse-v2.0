"use client";

import type { ReactNode } from "react";
import { Countdown } from "@/components/ui/Countdown";
import { STAGE_INFO } from "@/lib/stageInfo";
import { hours, titleCase } from "@/lib/format";
import { rarityStars } from "@/lib/cosmetics";
import { STATUS_STYLES, type Status } from "@/lib/podStatus";
import type { GrowthStage, Rarity, StageForecast } from "@/lib/types";

/** Big strain name + current stage/day, centered above the chamber. */
export function StageHeader({
  name,
  stage,
  day,
}: {
  name: string;
  stage: GrowthStage;
  day: number;
}) {
  return (
    <div className="text-center">
      <h2 className="text-glow-grow text-2xl font-extrabold tracking-[0.12em] text-grow-200 sm:text-3xl">
        {name}
      </h2>
      <p className="mt-0.5 font-mono text-[11px] tracking-[0.18em] text-cyan-200/70">
        STAGE: {STAGE_INFO[stage].label.toUpperCase()} · DAY {Math.max(1, Math.round(day))}
      </p>
    </div>
  );
}

/** "POD STATUS: OPTIMAL" overlay tag for the chamber. */
export function PodStatusTag({ status }: { status: Status }) {
  return (
    <div className="pointer-events-none rounded-md border border-cyan-400/40 bg-[#08141e]/70 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] backdrop-blur">
      <span className="text-cyan-200/60">POD STATUS: </span>
      <span className={`font-bold ${STATUS_STYLES[status]}`}>{status}</span>
    </div>
  );
}

function Chip({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-[120px] rounded-lg border border-cyan-400/25 bg-cyan-400/[0.05] px-2.5 py-1.5">
      <div className="text-[9px] font-semibold tracking-[0.16em] text-cyan-200/60">{label}</div>
      <div className="text-sm font-bold text-white">{children}</div>
      {sub && <div className="text-[9px] text-cyan-200/50">{sub}</div>}
    </div>
  );
}

/** STAGE TIME REMAINING / TOTAL TIME REMAINING / STRAIN RARITY chips. */
export function HeroStatChips({
  forecast,
  rarity,
}: {
  forecast: StageForecast | undefined;
  rarity: Rarity | undefined;
}) {
  const nextLabel = forecast?.next_stage ? STAGE_INFO[forecast.next_stage].label : "Harvest";
  const stars = rarity ? rarityStars(rarity) : 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Chip label="STAGE TIME LEFT" sub={forecast ? `Until ${nextLabel}` : undefined}>
        {forecast?.next_stage_eta ? (
          <Countdown to={forecast.next_stage_eta} />
        ) : forecast ? (
          hours(forecast.stage_total_hours)
        ) : (
          "—"
        )}
      </Chip>
      <Chip label="TOTAL TIME LEFT" sub={forecast ? "Est. harvest" : undefined}>
        {forecast?.harvest_eta ? (
          <Countdown to={forecast.harvest_eta} />
        ) : forecast ? (
          hours(forecast.hours_to_harvest)
        ) : (
          "—"
        )}
      </Chip>
      <Chip label="STRAIN RARITY" sub={rarity ? "★".repeat(stars) + "☆".repeat(5 - stars) : undefined}>
        <span className="text-fuchsia-300">{rarity ? titleCase(rarity) : "—"}</span>
      </Chip>
    </div>
  );
}
