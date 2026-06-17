import { apiFetch } from "./client";
import type { Strain } from "@/lib/types";

export const breeding = {
  // The RNG seed is server-generated (anti seed-shopping); only an optional
  // offspring name is client-supplied.
  breed: (
    playerId: string,
    parentAId: string,
    parentBId: string,
    opts: { name?: string } = {},
  ) =>
    apiFetch<Strain>(`/players/${playerId}/breed`, {
      method: "POST",
      body: { parent_a_id: parentAId, parent_b_id: parentBId, ...opts },
    }),
};
