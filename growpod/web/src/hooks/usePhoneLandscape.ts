"use client";

import { useEffect, useState } from "react";

/**
 * True on a landscape-oriented SHORT viewport — i.e. a phone held sideways —
 * where the chamber switches from the docked side rail to the slide-out HUD
 * overlays (owner mockup: "Landscape Mobile Overlay System"). Desktop windows
 * are landscape too but tall, so the max-height guard keeps them on the
 * always-visible rail. SSR-safe: defaults to `false` until mounted, then syncs
 * to the media query (same pattern as usePrefersReducedMotion).
 */
export function usePhoneLandscape(): boolean {
  const [phoneLandscape, setPhoneLandscape] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 520px)");
    const sync = () => setPhoneLandscape(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  return phoneLandscape;
}
