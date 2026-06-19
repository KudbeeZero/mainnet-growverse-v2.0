"use client";

// Overview strip: the at-a-glance "what's connected / partial / unwired" count
// plus the single most-urgent packet headline.

import { Card } from "@/components/ui/Card";
import type { WiringStatus } from "@/lib/mission/wiring";
import type { MissionPacket } from "@/lib/mission/packets";

const TILE: { key: WiringStatus; label: string; cls: string }[] = [
  { key: "connected", label: "Connected", cls: "text-grow-300" },
  { key: "partial", label: "Partial", cls: "text-amber-300" },
  { key: "unavailable", label: "Unavailable", cls: "text-sky-300" },
  { key: "not-wired", label: "Not wired", cls: "text-violet-300" },
  { key: "intentional", label: "Intentional", cls: "text-gray-400" },
];

export function SystemPulse({
  summary,
  packets,
}: {
  summary: Record<WiringStatus, number>;
  packets: MissionPacket[];
}) {
  const alerts = packets.filter((p) => p.health === "alert").length;
  const watches = packets.filter((p) => p.health === "watch").length;
  const unknowns = packets.filter((p) => p.health === "unknown").length;
  const headline =
    packets.length === 0
      ? "No live grow packets yet"
      : alerts > 0
        ? `${alerts} packet(s) need action`
        : watches > 0
          ? `${watches} packet(s) to watch`
          : unknowns > 0
            ? `${packets.length - unknowns} healthy · ${unknowns} unknown`
            : "All active packets healthy";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="instrument-label mb-1">System Pulse</div>
          <p className="text-sm text-gray-200">{headline}</p>
        </div>
        <div className="grid grid-cols-5 gap-3 text-center">
          {TILE.map((t) => (
            <div key={t.key}>
              <div className={`text-lg font-bold tabular-nums ${t.cls}`}>{summary[t.key]}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">{t.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
