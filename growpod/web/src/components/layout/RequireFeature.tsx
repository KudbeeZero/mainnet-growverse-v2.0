"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFeatureFlags, type FeatureName } from "@/lib/features";
import { LoadingBlock } from "@/components/ui/Spinner";

/**
 * Guard a route behind an MVP feature flag. When the feature is off the user is
 * sent back to the dashboard, so a deep-link to a hidden system never renders.
 * Reads the backend's live flag state (`useFeatureFlags`, falling back to the
 * env-driven default until that request resolves), so a backend kill switch
 * actually blocks the route, not just the API.
 */
export function RequireFeature({
  feature,
  children,
}: {
  feature: FeatureName;
  children: ReactNode;
}) {
  const router = useRouter();
  const flags = useFeatureFlags();
  const enabled = flags[feature];

  useEffect(() => {
    if (!enabled) router.replace("/dashboard");
  }, [enabled, router]);

  if (!enabled) return <LoadingBlock label="Redirecting…" />;
  return <>{children}</>;
}
