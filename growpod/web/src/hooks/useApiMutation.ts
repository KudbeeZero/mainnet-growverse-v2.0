"use client";

import { useRef } from "react";
import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface Opts<TData, TVars> {
  /** Query keys to invalidate on success. */
  invalidate?: QueryKey[];
  successMessage?: string | ((data: TData, vars: TVars) => string);
  onSuccess?: (data: TData, vars: TVars) => void;
  /** Set false to suppress the automatic error toast. */
  toastError?: boolean;
}

const VOID_KEY = "__void__";

/**
 * Marks a `mutationFn` invocation that was silently dropped because an
 * identical (same-vars) call was already in flight. Distinguished so the
 * error/success handlers below can swallow it instead of toasting/invalidating.
 */
class DuplicateInFlightSubmission extends Error {
  constructor() {
    super("duplicate in-flight submission — ignored");
  }
}

/**
 * Thin wrapper over useMutation that invalidates the relevant queries and
 * surfaces ApiError.message through the existing Toast — the standard write
 * path for the whole app.
 *
 * Also closes the double-submit gap `useInFlightGuard` was built for, but for
 * every call site automatically: the `isPending`/`disabled` React *state* a
 * caller uses to disable its button is only reflected in the DOM after a
 * re-render, so a fast double-click (or a duplicate synthetic click event)
 * can invoke `.mutate()` twice before that re-render lands. A `useRef` set,
 * keyed by the call's own `vars` (or a shared sentinel for void-arg calls),
 * is visible synchronously to the very next `mutationFn` invocation — no
 * render involved — so the second call is dropped instead of double-firing
 * the request. Sites that already share one `useApiMutation` instance across
 * many distinct items and use `useInFlightGuard` with an explicit per-item key
 * keep doing so unaffected; this is a no-op for them unless they'd otherwise
 * have collided on the same key.
 */
export function useApiMutation<TData, TVars = void>(
  fn: (vars: TVars) => Promise<TData>,
  opts: Opts<TData, TVars> = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  const inFlight = useRef<Set<string>>(new Set());

  const guardedFn = async (vars: TVars): Promise<TData> => {
    const key = vars === undefined ? VOID_KEY : JSON.stringify(vars);
    if (inFlight.current.has(key)) {
      throw new DuplicateInFlightSubmission();
    }
    inFlight.current.add(key);
    try {
      return await fn(vars);
    } finally {
      inFlight.current.delete(key);
    }
  };

  const options: UseMutationOptions<TData, unknown, TVars> = {
    mutationFn: guardedFn,
    onSuccess: (data, vars) => {
      for (const key of opts.invalidate ?? []) {
        qc.invalidateQueries({ queryKey: key });
      }
      if (opts.successMessage) {
        const msg =
          typeof opts.successMessage === "function"
            ? opts.successMessage(data, vars)
            : opts.successMessage;
        toast.success(msg);
      }
      opts.onSuccess?.(data, vars);
    },
    onError: (err) => {
      // A dropped duplicate isn't a real failure — the original call is still
      // in flight and will resolve/toast normally. Stay silent.
      if (err instanceof DuplicateInFlightSubmission) return;
      if (opts.toastError === false) return;
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Request failed";
      toast.error(msg);
    },
  };

  return useMutation(options);
}
