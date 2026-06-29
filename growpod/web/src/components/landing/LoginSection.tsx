"use client";

// The destination — the login/create card. Wraps the existing OnboardingPanel
// (auth wiring untouched) in a glowing reveal. Anchor target #login for the hero cue.

import { useRef } from "react";
import { OnboardingPanel } from "@/components/onboarding/OnboardingPanel";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useReveal } from "@/lib/scroll/reveal";

export function LoginSection() {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  useReveal(ref, !reduced, { start: "top 80%", stagger: 0.1 });

  return (
    <section
      ref={ref}
      id="login"
      className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 py-20"
    >
      <div data-reveal className="instrument-label mb-4 text-grow-400">
        Enter the greenhouse
      </div>
      <div data-reveal className="w-full max-w-md rounded-2xl shadow-glow-grow">
        <OnboardingPanel />
      </div>
    </section>
  );
}
