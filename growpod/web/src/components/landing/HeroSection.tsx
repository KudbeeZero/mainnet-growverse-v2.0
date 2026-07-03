"use client";

// The hero — full viewport. The living GR🌿VERS wordmark, the brand line, and a
// scroll cue. Animates in on load (its trigger sits at the top of the page) and
// drifts on scroll-out via a scrubbed parallax. Keeps the exact strings the smoke
// e2e asserts ("Real genetics", "GALACTIC SERIES").

import { useEffect, useRef } from "react";
import { GroversWordmark } from "@/components/viz/GroversWordmark";
import { ScrollCue } from "./ScrollCue";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useReveal } from "@/lib/scroll/reveal";
import { gsap, ScrollTrigger } from "@/lib/scroll/useSmoothScroll";

export function HeroSection() {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  // Entrance plays immediately (trigger is at the top of the document).
  useReveal(ref, !reduced, { start: "top 95%", stagger: 0.14 });

  // Scrub parallax: drift + fade the hero content as it scrolls away.
  useEffect(() => {
    if (reduced || typeof window === "undefined" || !innerRef.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.to(innerRef.current, {
        yPercent: -18,
        opacity: 0.25,
        ease: "none",
        scrollTrigger: { trigger: ref.current, start: "top top", end: "bottom top", scrub: true },
      });
    }, ref);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
    >
      <div ref={innerRef} className="flex flex-col items-center gap-5">
        <div data-reveal>
          <GroversWordmark className="w-[min(560px,86vw)]" />
        </div>
        <div data-reveal className="instrument-label text-gray-500">
          GALACTIC SERIES · GROWPOD EMPIRE
        </div>
        <h1 data-reveal className="max-w-2xl text-balance text-4xl font-bold tracking-tight text-gray-50 sm:text-5xl">
          Real genetics. Real time.{" "}
          <span className="text-glow-grow text-grow-300">Provably yours.</span>
        </h1>
        <p data-reveal className="max-w-md text-sm text-gray-400 sm:text-base">
          Cultivate a living simulation, breed discovered cultivars, and register them on a
          verifiable family tree. A genome is a graph — so we render it as one.
        </p>
        {/* Fast path to login — the cinematic scroll is optional, not a gate
            (owner: onboarding "is way too long"). Anyone who just wants in taps
            here and jumps straight to the login card; the story beats stay below
            for first-time visitors who want the pitch. */}
        <a
          data-reveal
          href="#login"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-grow-500 bg-grow-600/90 px-6 py-2.5 text-sm font-semibold text-white shadow-glow-grow transition-colors hover:bg-grow-500"
        >
          Enter the greenhouse →
        </a>
        <div data-reveal className="mt-1">
          <ScrollCue />
        </div>
      </div>
    </section>
  );
}
