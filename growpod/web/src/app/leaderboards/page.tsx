"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useLeaderboard } from "@/hooks/queries";
import { useSession } from "@/lib/session";
import { grow, num } from "@/lib/format";
import type { LeaderboardKind } from "@/lib/types";

const BOARDS: { key: LeaderboardKind; label: string; fmt: (v: number) => string }[] = [
  { key: "richest", label: "Richest", fmt: (v) => grow(v) },
  { key: "level", label: "Top Level", fmt: (v) => `Lvl ${num(v)}` },
  { key: "harvests", label: "Biggest Harvesters", fmt: (v) => `${num(v, 1)} g` },
  { key: "breeders", label: "Top Breeders", fmt: (v) => `${num(v)} strains` },
];

function LeaderboardsInner() {
  const [board, setBoard] = useState<LeaderboardKind>("richest");
  const { playerId } = useSession();
  const lb = useLeaderboard(board);
  const fmt = BOARDS.find((b) => b.key === board)!.fmt;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leaderboards</h1>

      <div className="flex flex-wrap gap-2">
        {BOARDS.map((b) => (
          <button
            key={b.key}
            onClick={() => setBoard(b.key)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              board === b.key
                ? "bg-grow-700 text-white"
                : "bg-ink-700 text-gray-300 hover:bg-ink-600"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <Card>
        {lb.isLoading ? (
          <LoadingBlock />
        ) : (lb.data ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">No ranked players yet.</p>
        ) : (
          <ol className="divide-y divide-ink-700">
            {(lb.data ?? []).map((row, i) => (
              <li
                key={row.player_id}
                className={`flex items-center justify-between py-2 ${
                  row.player_id === playerId ? "text-grow-300" : "text-gray-200"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right font-mono text-gray-500">{i + 1}</span>
                  <span className="font-medium">{row.username}</span>
                  {row.player_id === playerId && (
                    <span className="text-xs text-gray-500">(you)</span>
                  )}
                </span>
                <span className="tabular-nums">{fmt(row.value)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

export default function LeaderboardsPage() {
  return (
    <RequireAuth>
      <LeaderboardsInner />
    </RequireAuth>
  );
}
