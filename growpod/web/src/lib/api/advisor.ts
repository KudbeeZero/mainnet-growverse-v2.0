import { apiFetch } from "./client";
import type { AdvisorReport, AutoCareResult } from "@/lib/types";

export const advisor = {
  // AI "Master Grower" read-only diagnosis (runs sim catch-up server-side).
  get: (playerId: string, plantId: string) =>
    apiFetch<AdvisorReport>(`/players/${playerId}/plants/${plantId}/advisor`, {
      auth: true,
    }),

  // Agentic auto-care: the AI calls care actions itself within a GROW budget.
  autoCare: (
    playerId: string,
    plantId: string,
    opts: { budget?: number; max_actions?: number } = {},
  ) =>
    apiFetch<AutoCareResult>(
      `/players/${playerId}/plants/${plantId}/advisor/auto-care`,
      { method: "POST", body: opts },
    ),
};
