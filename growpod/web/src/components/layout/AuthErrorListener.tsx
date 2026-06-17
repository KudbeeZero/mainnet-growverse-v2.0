"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { isAuthError } from "@/lib/authError";
import { useSession } from "@/lib/session";

/**
 * Global 401/403 handler (RISK #9). Without this, a key that the server starts
 * rejecting mid-session (rotated/revoked/expired) leaves the dashboard "logged in"
 * but every read fails — a broken, confusing state. We subscribe to the React Query
 * query+mutation caches and, the first time an authed request comes back 401/403,
 * tear the session down and bounce to /onboarding so the user can re-key.
 *
 * Mounted INSIDE SessionProvider (it needs `logout`), so the cache subscription is
 * the bridge from the QueryClient (which lives one layer out) to the session.
 */
export function AuthErrorListener() {
  const qc = useQueryClient();
  const { isAuthed, logout } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Only react once we actually hold a session. Pre-auth 401s (e.g. the
    // sign-in key validation on /onboarding) must not trigger a redirect loop.
    if (!isAuthed) return;

    let handled = false;
    const handle = (err: unknown) => {
      if (handled || !isAuthError(err)) return;
      handled = true;
      logout(); // clears stored key/player id → RequireAuth redirects too
      qc.clear(); // drop any stale authed data so the next session starts clean
      router.replace("/onboarding");
    };

    const unsubQueries = qc.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.query.state.status === "error") {
        handle(event.query.state.error);
      }
    });
    const unsubMutations = qc.getMutationCache().subscribe((event) => {
      const mutation = event.mutation;
      if (mutation && mutation.state.status === "error") {
        handle(mutation.state.error);
      }
    });

    return () => {
      unsubQueries();
      unsubMutations();
    };
  }, [qc, isAuthed, logout, router]);

  return null;
}
