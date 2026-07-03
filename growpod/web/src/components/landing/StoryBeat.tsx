"use client";

// A reusable scroll-driven "story beat": an eyebrow + heading + copy in a glass
// card, optionally beside a visual. Reveals on scroll-in. Several of these stack
// between the hero and the login card, each shifting the backdrop tint as the page
// scrolls past it (the tint cross-fade lives in CinematicBackdrop).

import { useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useReveal } from "@/lib/scroll/reveal";

export function StoryBeat({
  eyebrow,
  title,
  body,
  visual,
  flip = false,
}: {
  eyebrow: string;
  title: ReactNode;
  body: ReactNode;
  visual?: ReactNode;
  /** Put the visual on the left instead of the right. */
  flip?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  useReveal(ref, !reduced);

  return (
    <section
      ref={ref}
      className="relative flex items-center justify-center px-6 py-16 sm:py-20"
    >
      <div
        className={`grid w-full max-w-5xl items-center gap-8 ${
          visual ? "lg:grid-cols-2" : "max-w-2xl"
        } ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}
      >
        <div className="panel p-7 shadow-glow-soft">
          <div data-reveal className="instrument-label mb-2 text-grow-400">
            {eyebrow}
          </div>
          <h2 data-reveal className="text-2xl font-bold tracking-tight text-gray-50 sm:text-3xl">
            {title}
          </h2>
          <div data-reveal className="mt-3 text-sm leading-relaxed text-gray-300 sm:text-base">
            {body}
          </div>
        </div>
        {visual && (
          <div data-reveal className="relative h-[300px] sm:h-[360px]">
            {visual}
          </div>
        )}
      </div>
    </section>
  );
}
