import { apiFetch } from "./client";
import type { Player } from "@/lib/types";

export interface WalletChallenge {
  message: string;
  nonce: string;
  expires_at: string;
}

export const wallet = {
  challenge: (playerId: string, address: string) =>
    apiFetch<WalletChallenge>(`/players/${playerId}/wallet/challenge`, {
      method: "POST",
      body: { address },
    }),

  link: (playerId: string, address: string, nonce: string, signature: string) =>
    apiFetch<Player>(`/players/${playerId}/wallet/link`, {
      method: "POST",
      body: { address, nonce, signature },
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
