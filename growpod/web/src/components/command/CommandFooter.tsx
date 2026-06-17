"use client";

import { alerts, STATUS_STYLES, podStatus } from "@/lib/podStatus";
import { powerUse } from "@/lib/cosmetics";
import type { PlantState, Pod } from "@/lib/types";

/** Bottom status bar: alerts · power draw · connection. */
export function CommandFooter({ plant, pod }: { plant: PlantState; pod: Pod | undefined }) {
  const lines = alerts(pod, plant);
  const status = podStatus(pod, plant);
  const watts = powerUse(pod);
  const optimal = lines.length === 1 && lines[0] === "Environment is optimal.";

  return (
    <footer className="flex flex-none items-center gap-3 border-t border-cyan-400/10 bg-[#06101a]/80 px-4 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur">
      <span className={`text-xs ${optimal ? "text-grow-300" : STATUS_STYLES[status]}`}>
        <span className="font-mono text-[10px] tracking-[0.14em] text-cyan-200/50">ALERTS </span>
        {optimal ? "✔ Environment is optimal." : lines[0]}
        {lines.length > 1 && <span className="text-cyan-200/50"> +{lines.length - 1} more</span>}
      </span>
      <div className="ml-auto flex items-center gap-4 font-mono text-[10px] tracking-[0.12em] text-cyan-200/60">
        <span>
          POWER USE <span className="font-bold text-cyan-100">{watts} W</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-grow-400" aria-hidden />
          CONNECTION <span className="font-bold text-grow-300">STABLE</span>
        </span>
      </div>
    </footer>
  );
}
