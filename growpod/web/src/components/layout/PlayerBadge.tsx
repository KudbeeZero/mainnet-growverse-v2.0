"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { grow } from "@/lib/format";
import { rank_for_level_client } from "@/lib/rank";

export function PlayerBadge() {
  const { playerId, isAuthed } = useSession();

  const { data: player } = useQuery({
    queryKey: queryKeys.player(playerId ?? ""),
    queryFn: () => api.players.get(playerId!),
    enabled: isAuthed,
    refetchInterval: 15_000,
  });

  if (!isAuthed || !player) return null;

  const rank = rank_for_level_client(player.level ?? 1);

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="text-right">
        <div className="font-medium leading-tight text-gray-100">{player.username}</div>
        <div className="text-[11px] leading-tight text-gray-400">
          {rank.icon} {rank.name} · {grow(player.wallet?.balance ?? player.balance)}
        </div>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-grow-700 font-semibold text-white">
        {player.username.slice(0, 2).toUpperCase()}
      </div>
    </div>
  );
}
