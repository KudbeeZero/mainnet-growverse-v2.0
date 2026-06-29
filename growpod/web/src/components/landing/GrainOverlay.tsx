"use client";

// Film grain — one of the six baked-in cinematic effects. A fixed, full-viewport
// SVG fractal-noise texture blended over everything at low opacity, "boiling" via
// the gpe-grain keyframe. Pointer-events off; under reduced-motion it stops boiling
// (the CSS media block kills the animation) and we drop opacity further.

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// Inline SVG fractal noise → data URI (no asset to ship, CSP-clean).
const NOISE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>` +
      `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>` +
      `<feColorMatrix type='saturate' values='0'/></filter>` +
      `<rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
  );

export function GrainOverlay() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      <div
        className={reduced ? "" : "gpe-grain"}
        style={{
          position: "absolute",
          inset: "-50%", // oversized so the boil jitter never reveals an edge
          backgroundImage: `url("${NOISE}")`,
          backgroundRepeat: "repeat",
          opacity: reduced ? 0.04 : 0.08,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}
