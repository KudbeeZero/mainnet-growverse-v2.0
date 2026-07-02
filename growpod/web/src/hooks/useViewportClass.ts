"use client";

import { useEffect, useState } from "react";

/**
 * Device-aware viewport tiers *below* Tailwind's own `sm` (640px) breakpoint,
 * where a single "mobile" bucket hides real differences: a small phone
 * (iPhone SE / 12-13 mini class, ~375px and under) is meaningfully more
 * cramped than a standard-to-large phone (iPhone 14/15/16 through Pro Max,
 * ~390-430px). Tailwind's default scale doesn't distinguish them, so the
 * Command Center's mobile rework needs its own tier below `sm`.
 *
 * - "phone-sm"    — <= 375px  (iPhone SE, iPhone 12/13 mini)
 * - "phone"       — 376-639px (iPhone 14/15/16 standard through Pro Max, and
 *                    anything else still under Tailwind's `sm`)
 * - "tablet-plus" — >= 640px  (Tailwind `sm` and up — tablets, desktop)
 *
 * Pure layout/density tweaks (padding, gaps, grid-cols) should prefer the
 * `xs` Tailwind breakpoint (see tailwind.config.ts, set to match
 * PHONE_SM_MAX_WIDTH+1) since CSS media queries are simpler and can't drift
 * out of sync with a JS re-render. This hook exists for the cases that
 * genuinely need a JS-level decision (e.g. picking different copy) rather
 * than just a class toggle.
 */
export type ViewportClass = "phone-sm" | "phone" | "tablet-plus";

export const PHONE_SM_MAX_WIDTH = 375;
export const PHONE_MAX_WIDTH = 639;

/** Pure classifier — no DOM, trivially unit-testable. */
export function classifyViewportWidth(width: number): ViewportClass {
  if (width <= PHONE_SM_MAX_WIDTH) return "phone-sm";
  if (width <= PHONE_MAX_WIDTH) return "phone";
  return "tablet-plus";
}

/**
 * Reactive viewport tier via `matchMedia` (never user-agent sniffing — UA
 * strings lie and aren't updated for new devices). SSR-safe: defaults to
 * "tablet-plus" (the least-cramped assumption, so server-rendered markup
 * never presents a falsely-squeezed layout) until mounted, then syncs and
 * stays live across resizes/orientation changes.
 */
export function useViewportClass(): ViewportClass {
  const [cls, setCls] = useState<ViewportClass>("tablet-plus");

  useEffect(() => {
    const mqSmall = window.matchMedia(`(max-width: ${PHONE_SM_MAX_WIDTH}px)`);
    const mqPhone = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`);
    const sync = () => setCls(classifyViewportWidth(window.innerWidth));
    sync();
    mqSmall.addEventListener?.("change", sync);
    mqPhone.addEventListener?.("change", sync);
    return () => {
      mqSmall.removeEventListener?.("change", sync);
      mqPhone.removeEventListener?.("change", sync);
    };
  }, []);

  return cls;
}
