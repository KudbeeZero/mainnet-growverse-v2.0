"use client";

import { useEffect, useState } from "react";
import { CONDITION_VISUALS } from "@/lib/conditionVisuals";
import type { AgentFinding } from "./introScript";

type Phase = "scanning" | "thinking" | "found";

const SCAN_MS = 900;
const THINK_MS = 1100;

/**
 * A little AI agent that pops up over the plant, scans, "thinks", then reveals
 * the condition it recognized with a button to summon a specialist.
 *
 * `reduced` skips the timed phases and renders the resolved "found" state
 * immediately (no looping animation), mirroring the scene's reduced-motion path.
 */
export function AgentBubble({
  finding,
  reduced,
  onRequest,
}: {
  finding: AgentFinding;
  reduced: boolean;
  onRequest: (finding: AgentFinding) => void;
}) {
  const [phase, setPhase] = useState<Phase>(reduced ? "found" : "scanning");

  useEffect(() => {
    if (reduced) return;
    const toThink = setTimeout(() => setPhase("thinking"), SCAN_MS);
    const toFound = setTimeout(() => setPhase("found"), SCAN_MS + THINK_MS);
    return () => {
      clearTimeout(toThink);
      clearTimeout(toFound);
    };
  }, [reduced]);

  const visual = CONDITION_VISUALS[finding.condition];

  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${finding.anchor.xPct}%`, top: `${finding.anchor.yPct}%` }}
    >
      {/* Anchor dot on the plant + scan pulse while analyzing. */}
      <span className="absolute left-0 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-grow-300 shadow-[0_0_8px_rgba(120,220,120,0.9)]" />
      {phase === "scanning" && !reduced && (
        <span className="gpe-scan-ring absolute left-0 top-0 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-grow-300" />
      )}

      {/* The chip floats up-and-right of the anchor so it never covers it. */}
      <div
        className={`${reduced ? "" : "gpe-agent-pop"} pointer-events-auto absolute bottom-2 left-2 w-max max-w-[15rem] rounded-lg border border-ink-600 bg-ink-800/95 p-2.5 text-left shadow-xl backdrop-blur`}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🤖</span>
          <span className="instrument-label text-gray-400">AI Scout</span>
        </div>

        {phase === "scanning" && (
          <p className="mt-1 text-xs text-gray-400">Analyzing leaf surface…</p>
        )}

        {phase === "thinking" && (
          <div className="mt-1 flex items-center gap-1" aria-label="Thinking">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="gpe-think-dot h-1.5 w-1.5 rounded-full bg-grow-300"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        )}

        {phase === "found" && (
          <div className="mt-1">
            <span
              className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${visual.badgeClass}`}
            >
              {visual.label}
            </span>
            <p className="mt-1.5 text-xs text-gray-300">{finding.note}</p>
            <button
              onClick={() => onRequest(finding)}
              className="mt-2 w-full rounded-md border border-grow-500 bg-grow-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-grow-500"
            >
              Request specialist · {finding.feeGrow} 🌿
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
