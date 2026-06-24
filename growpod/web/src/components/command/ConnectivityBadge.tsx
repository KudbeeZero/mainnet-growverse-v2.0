"use client";

import { isDevBypassEnabled } from "@/lib/features";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { healthDotClass, healthLabel } from "@/lib/health";

/**
 * Dev/tester-only connectivity readout. A tester who can't fast-forward needs to
 * know instantly whether the backend is even reachable — this pings `/health`
 * through the same proxy the time controls use and shows green/red. Hidden in
 * production (gated on the dev bypass), and the poll is disabled there too.
 */
export function ConnectivityBadge() {
  const enabled = isDevBypassEnabled();
  const { status } = useBackendHealth(enabled);
  if (!enabled) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-[#0a1722] px-2 py-0.5"
      title={`Backend connectivity (tester build) — ${healthLabel(status)}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${healthDotClass(status)}`} aria-hidden />
      <span className="instrument-label text-[8px] text-cyan-200/55">{healthLabel(status)}</span>
    </span>
  );
}
