"use client";

// Tiny GSAP reveal helper used by the landing sections. Animates every
// `[data-reveal]` descendant up + in when the section scrolls into view. Scoped
// with gsap.context so cleanup fully reverts inline styles. When `enabled` is false
// (reduced motion / SSR) it no-ops and the markup stays in its natural visible state.

import { useEffect, type RefObject } from "react";
import { gsap, ScrollTrigger } from "./useSmoothScroll";

interface RevealOpts {
  start?: string;
  stagger?: number;
  y?: number;
}

export function useReveal(ref: RefObject<HTMLElement | null>, enabled: boolean, opts: RevealOpts = {}): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !ref.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      if (!targets.length) return;
      gsap.from(targets, {
        y: opts.y ?? 42,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: opts.stagger ?? 0.12,
        scrollTrigger: { trigger: ref.current, start: opts.start ?? "top 78%", once: true },
      });
    }, ref);
    return () => ctx.revert();
  }, [enabled, ref, opts.start, opts.stagger, opts.y]);
}
