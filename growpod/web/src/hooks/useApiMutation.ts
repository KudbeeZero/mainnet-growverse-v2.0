"use client";

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

/**
 * Thin wrapper over useMutation that invalidates the relevant queries and
 * surfaces ApiError.message through the existing Toast — the standard write
 * path for the whole app.
 */
export function useApiMutation<TData, TVars = void>(
  fn: (vars: TVars) => Promise<TData>,
  opts: Opts<TData, TVars> = {},
) {
  const qc = useQueryClient();
  const toast = useToast();

  const options: UseMutationOptions<TData, unknown, TVars> = {
    mutationFn: fn,
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
