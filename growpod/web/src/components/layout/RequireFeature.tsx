"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FEATURES, type FeatureName } from "@/lib/features";
import { LoadingBlock } from "@/components/ui/Spinner";

/**
 * Guard a route behind an MVP feature flag. When the feature is off the user is
 * sent back to the dashboard, so a deep-link to a hidden system never renders.
 * Flags are build-time constants (identical on server and client), so there is
 * no hydration flash when the feature is on.
 */
export function RequireFeature({
  feature,
  children,
}: {
  feature: FeatureName;
  children: ReactNode;
}) {
  const router = useRouter();
  const enabled = FEATURES[feature];

  useEffect(() => {
    if (!enabled) router.replace("/dashboard");
  }, [enabled, router]);

  if (!enabled) return <LoadingBlock label="Redirecting…" />;
  return <>{children}</>;
}
