"use client";

import Link from "next/link";
import { useLiveClock } from "@/hooks/useLiveClock";
import { deckNumber, shipId } from "@/lib/cosmetics";
import type { Pod } from "@/lib/types";

/** Full-width HUD top bar: brand · ship/deck/day breadcrumb · live clock. */
export function CommandTopBar({
  plantId,
  playerId,
  pod,
  pods,
  day,
}: {
  plantId: string;
  playerId: string;
  pod: Pod | undefined;
  pods: Pod[] | undefined;
  day: number;
}) {
  const now = useLiveClock();
  const ship = shipId(playerId);
  const deck = deckNumber(pod, pods);

  return (
    <header className="flex flex-none items-center gap-3 border-b border-cyan-400/10 bg-[#06101a]/80 px-4 pb-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.6rem,env(safe-area-inset-top))] backdrop-blur">
      <Link
        href={`/dashboard/plants/${plantId}`}
        aria-label="Back to plant"
        className="-m-1 flex h-9 w-9 items-center justify-center rounded-lg text-lg text-cyan-200/70 hover:bg-white/5 hover:text-cyan-100"
      >
        ←
      </Link>
      <h1 className="text-lg font-extrabold tracking-[0.18em] text-[#f2f9ff]">
        GR<span className="text-grow-400">🌿</span>VERS
      </h1>
      <span className="hidden font-mono text-[10px] tracking-[0.22em] text-cyan-300/80 md:inline">
        SHIP: {ship} · GROW DECK {deck} · DAY {Math.max(1, Math.round(day))}
      </span>
      <div className="ml-auto flex items-center gap-3">
        <span className="font-mono text-sm font-bold tabular-nums text-cyan-100">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </header>
  );
}
