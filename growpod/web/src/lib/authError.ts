import { ApiError } from "@/lib/api";

/**
 * True for the two statuses that mean "this session's key is no longer good":
 * 401 (unauthenticated) and 403 (forbidden). Pure + framework-free so it can be
 * unit-tested and reused by the global AuthErrorListener.
 */
export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}
