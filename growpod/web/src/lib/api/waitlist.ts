import { apiFetch } from "./client";
import type { FactionsResponse, WaitlistSignup, WaitlistStandings } from "@/lib/types";

// Public, NON-economic pre-launch faction + waitlist endpoints (behind the
// `faction_waitlist` flag server-side; calls 404 gracefully when it's off).
export const waitlist = {
  factions: () => apiFetch<FactionsResponse>(`/factions`),
  standings: () => apiFetch<WaitlistStandings>(`/waitlist/standings`),
  join: (body: { faction: string; algorand_address?: string; email?: string; source?: string }) =>
    apiFetch<WaitlistSignup>(`/waitlist`, { method: "POST", body }),
  engage: (body: { algorand_address?: string; email?: string; signup_id?: string; points: number }) =>
    apiFetch<WaitlistSignup>(`/waitlist/engage`, { method: "POST", body }),
};
