"use client";

import { usePlantsList, usePods } from "@/hooks/queries";

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-1.5">
      <span className="text-lg font-extrabold leading-none text-grow-300">{value}</span>
      <span className="mt-0.5 text-[9px] font-semibold tracking-[0.16em] text-cyan-200/60">
        {label}
      </span>
    </div>
  );
}

/** LIVE PLANTS / ACTIVE PODS / EMPTY PODS — derived from cached fleet queries. */
export function FleetCounters() {
  const { data: plants } = usePlantsList();
  const { data: pods } = usePods();

  const live = (plants ?? []).filter((p) => p.is_alive && !p.harvested);
  const liveByPod = new Map<string, number>();
  for (const p of live) liveByPod.set(p.pod_id, (liveByPod.get(p.pod_id) ?? 0) + 1);

  const activePods = (pods ?? []).filter((p) => p.active).length;
  const emptyPods = (pods ?? []).filter((p) => (liveByPod.get(p.id) ?? 0) === 0).length;

  return (
    <div className="flex gap-2">
      <Counter value={live.length} label="LIVE PLANTS" />
      <Counter value={activePods} label="ACTIVE PODS" />
      <Counter value={emptyPods} label="EMPTY PODS" />
    </div>
  );
}
