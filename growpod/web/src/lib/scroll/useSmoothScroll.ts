"use client";

// Lenis smooth-scroll ↔ GSAP ScrollTrigger bridge — the "scroll pacing" half of the
// method. Lenis drives the scroll; GSAP's ScrollTrigger reads it so scrubbed
// timelines stay in lock-step. Fully gated: when motion is reduced (or there's no
// window) we DON'T hijack scroll at all — the page is just a normal, static document.

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

let registered = false;
function ensureRegistered() {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
}

/**
 * Mount Lenis + wire it into ScrollTrigger for the lifetime of the page.
 * @param enabled pass `false` (e.g. prefers-reduced-motion) to skip entirely.
 */
export function useSmoothScroll(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    ensureRegistered();

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    const onTick = (time: number) => lenis.raf(time * 1000); // gsap time is seconds
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    // Let layout settle, then make sure triggers measured against the right heights.
    ScrollTrigger.refresh();

    return () => {
      lenis.off("scroll", ScrollTrigger.update);
      gsap.ticker.remove(onTick);
      lenis.destroy();
    };
  }, [enabled]);
}

export { gsap, ScrollTrigger };
