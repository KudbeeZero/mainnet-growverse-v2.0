"use client";

import { useEffect, useRef, useState } from "react";
import { msUntil } from "@/lib/format";

// The plant `/state` poll (~7s) re-issues `forecast.*_eta` ISO strings that can
// shift by sub-second/second amounts (server rounding/recompute). Reading the
// target fresh on every render made the countdown jump backward then tick forward
// again — visible jitter. We anchor to an ABSOLUTE local deadline and only
// re-anchor when the server target moves by more than this, so poll noise is
// ignored but a genuine reschedule still snaps into place.
export const RESYNC_THRESHOLD_MS = 5_000;

/** Whether a freshly-read target differs enough to re-anchor (vs poll noise). */
export function shouldResync(
  currentDeadlineMs: number,
  nextDeadlineMs: number,
  thresholdMs: number = RESYNC_THRESHOLD_MS,
): boolean {
  return Math.abs(nextDeadlineMs - currentDeadlineMs) > thresholdMs;
}

/**
 * Monotonic countdown (ms remaining) to an ISO deadline. Ticks once per second
 * by recomputing `deadline - now` (no accumulated drift, never negative), and
 * re-anchors only when `to` changes meaningfully — so the value counts smoothly
 * down instead of oscillating with the state poll.
 */
export function useCountdown(to: string | null | undefined): number {
  const deadlineRef = useRef<number>(Date.now() + msUntil(to));
  const [ms, setMs] = useState<number>(() =>
    Math.max(0, deadlineRef.current - Date.now()),
  );

  // Re-anchor only on a meaningful change to the target deadline.
  useEffect(() => {
    const nextDeadline = Date.now() + msUntil(to);
    if (shouldResync(deadlineRef.current, nextDeadline)) {
      deadlineRef.current = nextDeadline;
      setMs(Math.max(0, nextDeadline - Date.now()));
    }
  }, [to]);

  // Local 1s tick derived from the absolute deadline (monotonic display).
  useEffect(() => {
    const id = setInterval(() => {
      setMs(Math.max(0, deadlineRef.current - Date.now()));
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  return ms;
}
