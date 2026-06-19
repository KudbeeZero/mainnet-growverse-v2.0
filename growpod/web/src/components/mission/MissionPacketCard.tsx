"use client";

// The reusable "mission packet" — part status card, part message/parcel. It is
// deliberately NOT a terminal line: a titled object that arrives, reports a
// health state, and lists what's good / watch / alert, with a next checkpoint.

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { timeAgo } from "@/lib/format";
import type { MissionPacket, PacketHealth } from "@/lib/mission/packets";

const HEALTH_STYLE: Record<PacketHealth, { dot: string; badge: string; label: string }> = {
  good: { dot: "bg-grow-400", badge: "border-grow-700 bg-grow-900/50 text-grow-200", label: "Healthy" },
  watch: { dot: "bg-amber-400", badge: "border-amber-700 bg-amber-950/50 text-amber-200", label: "Watch" },
  alert: { dot: "bg-red-400", badge: "border-red-800 bg-red-950/50 text-red-200", label: "Action" },
  unknown: { dot: "bg-gray-500", badge: "border-ink-600 bg-ink-700 text-gray-300", label: "Unknown" },
};

export function MissionPacketCard({ packet }: { packet: MissionPacket }) {
  const s = HEALTH_STYLE[packet.health];
  return (
    <Card className="relative overflow-hidden">
      {/* left status spine — the "parcel" accent */}
      <div className={`absolute inset-y-0 left-0 w-1 ${s.dot}`} aria-hidden />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
              <h3 className="truncate text-sm font-semibold text-gray-100">{packet.title}</h3>
            </div>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-500">{packet.source}</p>
          </div>
          <Badge className={s.badge}>{s.label}</Badge>
        </div>

        <p className="mt-2 text-sm text-gray-200">{packet.summary}</p>

        <ul className="mt-2 space-y-1">
          {packet.lines.map((line, i) => (
            <li key={i} className="flex gap-2 text-xs text-gray-400">
              <span className="select-none text-gray-600">›</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-700 pt-2 text-[11px] text-gray-500">
          <span>
            {packet.actionNeeded ? (
              <span className="font-medium text-amber-300">⚑ Action needed</span>
            ) : (
              <span className="text-gray-500">No action needed</span>
            )}
          </span>
          <span className="flex items-center gap-2 tabular-nums">
            {packet.nextCheckpoint && <span>Next check {packet.nextCheckpoint}</span>}
            <span className="text-gray-600">· {timeAgo(packet.timestamp)}</span>
          </span>
        </div>
      </div>
    </Card>
  );
}
