"use client";

import { useEffect, useState } from "react";
import { countdown, msUntil } from "@/lib/format";

/** Live ticking countdown to an ISO deadline. */
export function Countdown({
  to,
  className = "",
  prefix,
}: {
  to: string | null | undefined;
  className?: string;
  prefix?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = msUntil(to);
  return (
    <span className={`instrument-value ${ms <= 0 ? "text-red-300" : ""} ${className}`}>
      {prefix && <span className="mr-1 text-gray-500">{prefix}</span>}
      {countdown(ms)}
    </span>
  );
}
