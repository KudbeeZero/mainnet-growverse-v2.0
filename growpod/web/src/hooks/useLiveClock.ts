"use client";

import { useEffect, useState } from "react";

/** A ticking wall clock for HUD chrome. Defaults to a 1s cadence. */
export function useLiveClock(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
