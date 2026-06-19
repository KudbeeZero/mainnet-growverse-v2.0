"use client";

// Honest "what's actually wired" panel. No fake green: each row shows the true
// status the board observed this session.

import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { WiringRow, WiringStatus } from "@/lib/mission/wiring";

const STATUS_STYLE: Record<WiringStatus, { badge: string; label: string; dot: string }> = {
  connected: { badge: "border-grow-700 bg-grow-900/50 text-grow-200", label: "Connected", dot: "bg-grow-400" },
  partial: { badge: "border-amber-700 bg-amber-950/50 text-amber-200", label: "Partial", dot: "bg-amber-400" },
  unavailable: { badge: "border-sky-800 bg-sky-950/50 text-sky-200", label: "Unavailable", dot: "bg-sky-400" },
  "not-wired": { badge: "border-violet-700 bg-violet-950/50 text-violet-200", label: "Not wired", dot: "bg-violet-400" },
  intentional: { badge: "border-ink-600 bg-ink-700 text-gray-300", label: "Intentional", dot: "bg-gray-500" },
};

export function WiringPanel({ rows }: { rows: WiringRow[] }) {
  return (
    <Card>
      <CardHeader
        title="System Wiring Check"
        subtitle="Real connection status — nothing marked green unless data actually flowed this session."
      />
      <ul className="divide-y divide-ink-700">
        {rows.map((r) => {
          const s = STATUS_STYLE[r.status];
          return (
            <li key={r.system} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
                  <span className="text-sm font-medium text-gray-200">{r.system}</span>
                </div>
                <p className="mt-0.5 pl-4 text-xs text-gray-500">{r.note}</p>
              </div>
              <Badge className={`${s.badge} shrink-0`}>{s.label}</Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
