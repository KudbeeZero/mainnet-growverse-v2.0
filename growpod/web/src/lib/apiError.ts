// Turn a raw ApiError into a short, actionable line a tester can act on.
//
// The time controls (ACCELERATE TIME, SPEED) are writes that travel through the
// Next.js rewrite proxy to the Flask backend. When that path breaks the raw
// errors are opaque ("Request failed (404)", status 0), which is exactly why a
// tester sees dead buttons and can't tell whether it's auth, routing, or a
// sleeping backend. This pure classifier maps the failure to a cause + a plain
// next step, and is unit-tested.

import { ApiError } from "@/lib/api";

export type ApiErrorKind =
  | "offline" // status 0 — never reached the server (proxy/backend down)
  | "auth" // 401/403 — missing or rejected API key
  | "not_found" // 404 — route/player/plant not found (often a proxy misroute)
  | "rate_limited" // 429 — too many time jumps too fast
  | "server" // 5xx — backend errored
  | "unknown";

export interface ApiErrorInfo {
  kind: ApiErrorKind;
  /** One-line, tester-facing explanation + what to do. */
  message: string;
}

/** Classify any thrown error from the API layer. */
export function classifyApiError(err: unknown): ApiErrorInfo {
  const status = err instanceof ApiError ? err.status : undefined;
  const raw = err instanceof Error ? err.message : String(err);

  if (status === 0) {
    return {
      kind: "offline",
      message:
        "Can't reach the game server — it may be waking up. Wait a few seconds and try again.",
    };
  }
  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      message: "Your tester session expired — re-enter as tester to keep playing.",
    };
  }
  if (status === 404) {
    return {
      kind: "not_found",
      message: "The game server didn't recognise that request (route or plant not found).",
    };
  }
  if (status === 429) {
    return {
      kind: "rate_limited",
      message: "Easy on the time travel — too many jumps at once. Give it a moment.",
    };
  }
  if (status != null && status >= 500) {
    return {
      kind: "server",
      message: "The game server hit an error. Try again in a moment.",
    };
  }
  return { kind: "unknown", message: raw || "Something went wrong." };
}

/** Short tester-facing message for any API failure. */
export function describeApiError(err: unknown): string {
  return classifyApiError(err).message;
}
