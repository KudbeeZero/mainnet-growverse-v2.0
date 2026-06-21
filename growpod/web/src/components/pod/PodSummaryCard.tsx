"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { titleCase } from "@/lib/format";
import type { Pod } from "@/lib/types";

/** Dashboard-level pod tile. The dashboard is the "Pods" home: each pod is a
 * summary that links INTO the pod ( /dashboard/pods/[id] ), where its plants and
 * controls live. This is the first hop of the Pods → Pod → Plant drill-down. */
export function PodSummaryCard({
  pod,
  plantCount,
  liveCount,
}: {
  pod: Pod;
  plantCount: number;
  liveCount: number;
}) {
  return (
    <Link href={`/dashboard/pods/${pod.id}`} className="block">
      <Card className="transition-colors hover:border-grow-500/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-100">{pod.name}</h2>
            <Badge className="border-ink-600 bg-ink-700 text-gray-300">
              {titleCase(pod.tier)}
            </Badge>
          </div>
          <span className="text-sm font-medium text-grow-300">Enter pod →</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
          <span>
            {liveCount} live · {plantCount}/{pod.capacity} plants
          </span>
          {pod.temperature != null && <span>🌡 {pod.temperature}°C</span>}
          {pod.humidity != null && <span>💧 {pod.humidity}%</span>}
          {pod.auto_water && <span className="text-sky-300">auto-water</span>}
          {pod.auto_feed && <span className="text-emerald-300">auto-feed</span>}
        </div>
      </Card>
    </Link>
  );
}
