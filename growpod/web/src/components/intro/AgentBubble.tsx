"use client";

import { useEffect, useState } from "react";
import { CONDITION_VISUALS } from "@/lib/conditionVisuals";
import type { AgentFinding } from "./introScript";

type Phase = "scanning" | "thinking" | "found";

const SCAN_MS = 900;
const THINK_MS = 1100;

/**
 * A little AI scout card that pops in, scans, "thinks", then reveals the
 * condition it recognized with a button to summon a specialist.
 *
 * Laid out in normal flow inside the scene's scout column (see
 * GrowthIntroScene), so cards can never overlap each other, the wordmark, or
 * clip off-screen on mobile — they simply stack.
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
      className={`${reduced ? "" : "gpe-agent-pop"} w-full rounded-lg border border-ink-600 bg-ink-800/95 p-2.5 text-left shadow-lg backdrop-blur`}
    >
      <div className="flex items-center gap-1.5">
        <span className="relative inline-flex text-sm">
          🤖
          {phase === "scanning" && !reduced && (
            <span className="gpe-scan-ring absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-grow-300" />
          )}
        </span>
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
            className="mt-2 w-full whitespace-nowrap rounded-md border border-grow-500 bg-grow-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-grow-500"
          >
            Request specialist · {finding.feeGrow} 🌿
          </button>
        </div>
      )}
    </div>
  );
}
