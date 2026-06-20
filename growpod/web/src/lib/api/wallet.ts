import { apiFetch } from "./client";
import type { Player } from "@/lib/types";

export const wallet = {
  link: (playerId: string, address: string) =>
    apiFetch<Player>(`/players/${playerId}/wallet/link`, {
      method: "POST",
      body: { address },
    }),

  unlink: (playerId: string) =>
    apiFetch<Player>(`/players/${playerId}/wallet/unlink`, { method: "POST" }),

  withdraw: (playerId: string, amount: number) =>
    apiFetch<Record<string, unknown>>(`/players/${playerId}/wallet/withdraw`, {
      method: "POST",
      body: { amount },
    }),

  deposit: (playerId: string, amount: number) =>
    apiFetch<Record<string, unknown>>(`/players/${playerId}/wallet/deposit`, {
      method: "POST",
      body: { amount },
    }),
};
