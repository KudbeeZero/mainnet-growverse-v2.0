"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { healthStatus, type HealthStatus } from "@/lib/health";

/**
 * Liveness of the backend the time controls talk to. Polls `/health` through
 * the same rewrite proxy a write would use, so "online" really means the path
 * is reachable. `enabled` lets callers (the dev/tester badge) skip the poll
 * entirely in production builds.
 */
export function useBackendHealth(enabled = true): { status: HealthStatus } {
  const q = useQuery({
    queryKey: ["health"],
    queryFn: () => api.health.ping(),
    enabled,
    retry: false,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  return { status: healthStatus({ isLoading: q.isLoading, isError: q.isError }) };
}
