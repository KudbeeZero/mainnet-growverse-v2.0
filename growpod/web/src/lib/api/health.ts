import { apiFetch } from "./client";

/** Liveness ping. Hits the app-root `/health` (proxied to the backend by the
 *  Next.js rewrite), so a success means the SAME path the time controls use is
 *  actually reaching the server. `raw` skips the /api/game prefix. */
export const health = {
  ping: () => apiFetch<unknown>("/health", { raw: true, auth: false }),
};
