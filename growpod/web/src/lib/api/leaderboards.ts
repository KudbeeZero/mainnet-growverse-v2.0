import { apiFetch } from "./client";
import type { LeaderboardEntry, LeaderboardKind } from "@/lib/types";

export const leaderboards = {
  get: (board: LeaderboardKind, limit = 10) =>
    apiFetch<LeaderboardEntry[]>(`/leaderboards/${board}`, { query: { limit } }),
};
