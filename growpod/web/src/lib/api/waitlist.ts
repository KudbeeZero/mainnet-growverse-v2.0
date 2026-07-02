import { apiFetch } from "./client";
import type { FactionsResponse, WaitlistSignup, WaitlistStandings } from "@/lib/types";

// Public, NON-economic pre-launch faction + waitlist endpoints (behind the
// `faction_waitlist` flag server-side; calls 404 gracefully when it's off).
export const waitlist = {
  factions: () => apiFetch<FactionsResponse>(`/factions`),
  standings: () => apiFetch<WaitlistStandings>(`/waitlist/standings`),
  // Public endpoints: the flagship pre-launch signup must work for logged-out
  // visitors, so never attach the player's API key (auth: false). Attaching it
  // would throw a client-side 401 before the request when no session exists.
  join: (body: { faction: string; algorand_address?: string; email?: string; source?: string }) =>
    apiFetch<WaitlistSignup>(`/waitlist`, { method: "POST", auth: false, body }),
  engage: (body: { algorand_address?: string; email?: string; signup_id?: string; points: number }) =>
    apiFetch<WaitlistSignup>(`/waitlist/engage`, { method: "POST", auth: false, body }),
};
