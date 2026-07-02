import { ApiError } from "@/lib/api";

/**
 * True only for 401 (unauthenticated) — the status that means "this session's
 * key is no longer valid" and the session should be torn down.
 *
 * 403 is deliberately excluded: the backend returns 403 for *authorization*
 * failures (e.g. a valid, non-admin player key hitting an /admin route), which
 * says nothing about whether the session key is still good. Treating 403 as
 * session death would force-log-out a perfectly valid player who merely browsed
 * to a forbidden page — and, since the API key is shown only once at creation,
 * could permanently orphan their account. Forbidden states are handled per-page.
 *
 * Pure + framework-free so it can be unit-tested and reused by the global
 * AuthErrorListener.
 */
export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}
