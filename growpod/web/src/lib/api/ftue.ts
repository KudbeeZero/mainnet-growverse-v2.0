import { apiFetch } from "./client";
import type { AdvisorReport, FtueStatus } from "@/lib/types";

// First-Time-User-Experience: the guided tutorial that walks a new player
// through the core loop. Backed by the deterministic FTUEService on the server.
export const ftue = {
  // Current tutorial step + the tutorial plant (if one's been planted yet).
  status: (playerId: string) =>
    apiFetch<FtueStatus>(`/players/${playerId}/ftue/status`, { auth: true }),

  // The Master Grower's scripted coaching for a step (deterministic; no live AI).
  coaching: (playerId: string, step: string) =>
    apiFetch<AdvisorReport>(`/players/${playerId}/ftue/coaching/${step}`, { auth: true }),

  // Complete the given step (performs its real game action) and advance.
  advance: (playerId: string, step: string) =>
    apiFetch<FtueStatus>(`/players/${playerId}/ftue/advance`, {
      method: "POST",
      body: { step },
    }),
};
