"use client";

import { useRef } from "react";

/**
 * Synchronous in-flight guard for buy/purchase (and other one-shot POST)
 * click handlers.
 *
 * The `busy`/`buying` React *state* these handlers already use to disable
 * their button is only reflected in the DOM after React re-renders. A fast
 * double-click (or a duplicate synthetic click event some browsers fire)
 * can invoke the handler twice before that re-render lands — both
 * invocations read the same stale, pre-update `false`/`null` state and both
 * fire the request, so what the player experienced as one click becomes two
 * real purchases (confirmed 2026-07-05 on gear + seasonal-strain purchase:
 * a 60 GC item debited 120 GC and delivered 2 units).
 *
 * A `useRef` mutation, by contrast, is visible synchronously to the very
 * next invocation of the same closure — no render involved. Checking and
 * setting it at the very top of the handler, before any `await`, closes that
 * gap. This is a belt-and-suspenders addition: keep the existing
 * state-based `disabled` prop too (it's still the right UX for the *visual*
 * disabled state and covers the slow-network case).
 */
export function useInFlightGuard<K = true>() {
  // A Set, not a single slot: sections that share one guard across many items
  // (e.g. the store's FeaturedShelf) can have item A's request still in
  // flight when item B starts. A single-slot `ref = B` overwrite would forget
  // A — re-opening the exact double-charge window for A that this hook exists
  // to close. Each key is tracked independently.
  const inFlight = useRef<Set<K>>(new Set());

  /** Returns true and marks `key` in-flight, or false if it already is. */
  function start(key: K): boolean {
    if (inFlight.current.has(key)) return false;
    inFlight.current.add(key);
    return true;
  }

  /** Clears the in-flight marker for `key` (no-op if it's already cleared).
   * Call in a `finally`/`onSettled`. */
  function stop(key: K): void {
    inFlight.current.delete(key);
  }

  return { start, stop };
}
