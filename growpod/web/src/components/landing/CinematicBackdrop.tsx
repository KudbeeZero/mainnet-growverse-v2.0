"use client";

// The fixed cinematic background stack — three of the six baked-in effects:
//   • particles — the leaf-mode Constellation canvas (reused, view-locked, faint)
//   • vignette  — the .canvas-dark radial base + an edge-darkening overlay
//   • color tints — grow → cyan → violet, cross-faded by overall scroll progress
// Sits behind all content (-z-10), pointer-events off. Under reduced-motion the
// tint is static and no ScrollTrigger is created.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { gsap, ScrollTrigger } from "@/lib/scroll/useSmoothScroll";

// Constellation paints to a canvas — load it client-only.
const Constellation = dynamic(
  () => import("@/components/viz/Constellation").then((m) => m.Constellation),
  { ssr: false, loading: () => null },
);

const TINTS = {
  grow: "radial-gradient(1100px 700px at 50% 18%, rgba(118,192,36,0.16), transparent 62%)",
  cyan: "radial-gradient(1000px 700px at 70% 40%, rgba(56,189,248,0.16), transparent 60%)",
  violet: "radial-gradient(1100px 800px at 35% 70%, rgba(167,139,250,0.18), transparent 62%)",
} as const;

export function CinematicBackdrop() {
  const reduced = usePrefersReducedMotion();
  const [vh, setVh] = useState(900);
  const growRef = useRef<HTMLDivElement>(null);
  const cyanRef = useRef<HTMLDivElement>(null);
  const violetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setVh(window.innerHeight);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // Cross-fade the three tints across the page's scroll progress (0→1).
  useEffect(() => {
    if (reduced || typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);
    const triangle = (p: number, center: number) => Math.max(0, 1 - Math.abs(p - center) / 0.5);
    const st = ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        const p = self.progress;
        if (growRef.current) growRef.current.style.opacity = String(Math.max(triangle(p, 0), 0.25));
        if (cyanRef.current) cyanRef.current.style.opacity = String(triangle(p, 0.5));
        if (violetRef.current) violetRef.current.style.opacity = String(triangle(p, 1));
      },
    });
    return () => st.kill();
  }, [reduced]);

  return (
    <div className="canvas-dark pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* particles */}
      <div className="absolute inset-0 opacity-50">
        {/* Ambient decoration only — 340 was tuned for desktop and, combined
            with the old fixed-pixel particle size, read as slow/oversized
            blobs on mobile (both are now fixed in Constellation itself); this
            count is also lighter so the frame cost drops on every device. */}
        <Constellation mode="leaf" frameless lockView height={vh} leafCount={160} showCount={false} accent="#76c024" />
      </div>

      {/* color tints (opacity animated on scroll; static defaults for reduced-motion) */}
      <div ref={growRef} className="absolute inset-0" style={{ background: TINTS.grow, opacity: 0.6 }} />
      <div ref={cyanRef} className="absolute inset-0" style={{ background: TINTS.cyan, opacity: reduced ? 0 : 0 }} />
      <div ref={violetRef} className="absolute inset-0" style={{ background: TINTS.violet, opacity: reduced ? 0 : 0 }} />

      {/* vignette — darken the edges to keep the eye centered */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(3,6,9,0.85) 100%)" }}
      />
    </div>
  );
}
