// Mission Control v0 — honest wiring map.
//
// Pure builder of the "System Wiring Check" rows. The cardinal rule: NO fake
// green. A system is only "connected" when the board actually received its data
// this session. PR / deploy feeds are "not-wired" (there is no pipeline yet),
// and staking is "intentional" (deliberately not wired). Unit-tested.

export type WiringStatus =
  | "connected" // data is flowing into the board right now
  | "partial" // some of it works / gated / reference-only
  | "unavailable" // exists in backend but not reachable by the web yet
  | "not-wired" // no pipeline exists at all
  | "intentional"; // deliberately not wired

export interface WiringRow {
  system: string;
  status: WiringStatus;
  note: string;
}

/** Live signals the page can actually observe this session. */
export interface WiringSignals {
  plantConnected: boolean;
  forecastConnected: boolean;
  metricsConnected: boolean;
  eventsConnected: boolean;
  /** GET /api/game/flags returned (live feature-flag truth). */
  flagsReachable: boolean;
  /** GET /health reachable from the browser (CORS/proxy). null = not yet checked. */
  healthReachable: boolean | null;
  /** QA dev-clock / speed readable (dev bypass / test build). */
  qaSpeedReadable: boolean;
}

export function buildWiringRows(s: WiringSignals): WiringRow[] {
  const healthRow: WiringRow =
    s.healthReachable === true
      ? { system: "Backend health (/health)", status: "connected", note: "Liveness endpoint reachable from the browser." }
      : s.healthReachable === false
        ? { system: "Backend health (/health)", status: "unavailable", note: "Endpoint exists, but not reachable from the browser (CORS/proxy). Not faking green." }
        : { system: "Backend health (/health)", status: "partial", note: "Reachability unconfirmed this session." };

  return [
    { system: "Plant state", status: s.plantConnected ? "connected" : "unavailable", note: s.plantConnected ? "Live from GET /players/{id}/plants/{id}/state." : "No alive plant to read yet." },
    { system: "Growth stage", status: s.plantConnected ? "connected" : "unavailable", note: "growth_stage on plant state." },
    { system: "Forecast / timers", status: s.forecastConnected ? "connected" : "partial", note: s.forecastConnected ? "stage_progress / ETAs from /state forecast." : "Forecast not present on current state." },
    { system: "Derived metrics (VPD/DLI/PPFD)", status: s.metricsConnected ? "connected" : "partial", note: s.metricsConnected ? "From /state metrics (reference bands only in UI)." : "Not reported outside lit stages." },
    { system: "Events / activity log", status: s.eventsConnected ? "connected" : "partial", note: s.eventsConnected ? "recent_events on /state (full feed at /plants/{id}/events)." : "No events on current state." },
    { system: "Feature flags (live)", status: s.flagsReachable ? "connected" : "unavailable", note: s.flagsReachable ? "GET /api/game/flags resolved." : "Live flags endpoint not reachable; UI fell back to build-time flags." },
    healthRow,
    { system: "QA 10× / dev speed", status: s.qaSpeedReadable ? "partial" : "unavailable", note: "Client toggle only; backend dev-clock is fail-closed in production." },
    { system: "Market", status: "partial", note: "Listings endpoint exists and is feature-gated; not surfaced in this v0." },
    { system: "Cup", status: "partial", note: "Live in code, feature-gated; not surfaced in this v0." },
    { system: "PR feed (GitHub)", status: "not-wired", note: "No PR→website pipeline exists. PR activity lives in GitHub + the agent/webhook layer. Future: server-side GitHub route." },
    { system: "Deploy feed", status: "not-wired", note: "No deploy-status pipeline to the app yet. Future server-side adapter." },
    { system: "Staking", status: "intentional", note: "Deliberately not wired — out of scope and not implemented." },
  ];
}

/** Roll-up counts for the System Pulse overview. */
export function wiringSummary(rows: WiringRow[]): Record<WiringStatus, number> {
  const acc: Record<WiringStatus, number> = {
    connected: 0,
    partial: 0,
    unavailable: 0,
    "not-wired": 0,
    intentional: 0,
  };
  for (const r of rows) acc[r.status] += 1;
  return acc;
}
