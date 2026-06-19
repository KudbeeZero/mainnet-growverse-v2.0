"use client";

import { countdown } from "@/lib/format";
import { useCountdown } from "@/hooks/useCountdown";

/** Live ticking countdown to an ISO deadline. Smooth (no jitter across polls). */
export function Countdown({
  to,
  className = "",
  prefix,
}: {
  to: string | null | undefined;
  className?: string;
  prefix?: string;
}) {
  const ms = useCountdown(to);
  return (
    <span className={`instrument-value ${ms <= 0 ? "text-red-300" : ""} ${className}`}>
      {prefix && <span className="mr-1 text-gray-500">{prefix}</span>}
      {countdown(ms)}
    </span>
  );
}
