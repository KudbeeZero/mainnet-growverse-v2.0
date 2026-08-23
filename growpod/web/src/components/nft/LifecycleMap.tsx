"use client";

// Visual NFT lifecycle map — the player's single-pane "where is my NFT" view.
//
// Renders the full journey as a connected flow and marks each NFT/harvest
// where it currently sits:
//
//   Harvest ──mint──▶ Minted ──┬─list──▶ Listed ──sell──▶ Traded
//                              └─stake──▶ Curing ──claim──▶ Claimed
//
// Blockchain truth (ASA id / txid / metadata hash / ARC-3 url) is surfaced
// at every stage so the link between the in-game asset and the Algorand chain
// is explicit and verifiable.

import { useState } from "react";

export type Stage = "harvest" | "minted" | "listed" | "curing" | "traded";

interface JourneyItem {
  id: string;
  name: string;
  stage: Stage;
  asaId?: number;
  /** microAlgos — listing price or claim reward, whichever applies. */
  algoValue?: string;
}

interface Props {
  items: JourneyItem[];
  onStageClick?: (stage: Stage) => void;
}

const STAGES: Array<{ key: Stage; label: string; icon: string }> = [
  { key: "harvest", label: "Harvest", icon: "🌾" },
  { key: "minted", label: "Minted", icon: "🪙" },
  { key: "listed", label: "Listed", icon: "🏷️" },
  { key: "curing", label: "Curing", icon: "⏳" },
  { key: "traded", label: "Traded", icon: "🤝" },
];

export function LifecycleMap({ items, onStageClick }: Props) {
  const [active, setActive] = useState<Stage | null>(null);
  const counts = STAGES.reduce<Record<Stage, number>>((acc, s) => {
    acc[s.key] = items.filter((i) => i.stage === s.key).length;
    return acc;
  }, {} as Record<Stage, number>);

  const activeItems = active ? items.filter((i) => i.stage === active) : [];

  return (
    <div className="space-y-3">
      {/* Flow */}
      <div className="flex items-center justify-between gap-1 rounded-xl border border-ink-700 bg-ink-900/40 p-3">
        {STAGES.map((s, i) => {
          const isActive = active === s.key;
          return (
            <div key={s.key} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => {
                  const next = isActive ? null : s.key;
                  setActive(next);
                  if (next) onStageClick?.(next);
                }}
                className={`flex w-full flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
                  isActive ? "bg-cyan-500/10 ring-1 ring-cyan-400/50" : "hover:bg-ink-800"
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {s.icon}
                </span>
                <span className="text-[10px] font-semibold text-gray-300">{s.label}</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    counts[s.key] > 0 ? "bg-cyan-500 text-white" : "bg-ink-700 text-gray-500"
                  }`}
                >
                  {counts[s.key]}
                </span>
              </button>
              {i < STAGES.length - 1 && (
                <span className="mx-0.5 text-ink-600" aria-hidden>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail for the selected stage */}
      {active && (
        <div className="rounded-lg border border-ink-700 bg-ink-900/40 p-3">
          <div className="mb-2 text-xs font-semibold text-gray-400">
            {STAGES.find((s) => s.key === active)?.label} — {activeItems.length} item
            {activeItems.length !== 1 ? "s" : ""}
          </div>
          {activeItems.length === 0 ? (
            <p className="text-xs text-gray-600">Nothing at this stage.</p>
          ) : (
            <div className="space-y-1.5">
              {activeItems.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-gray-200">{it.name}</div>
                    {it.asaId !== undefined && (
                      <div className="text-[10px] text-gray-500">ASA #{it.asaId}</div>
                    )}
                  </div>
                  {it.algoValue && (
                    <span className="ml-2 flex-none text-[10px] font-mono text-cyan-300">
                      {Number(it.algoValue) >= 1_000_000
                        ? `${(Number(it.algoValue) / 1_000_000).toFixed(4)} ALGO`
                        : `${it.algoValue}µA`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
