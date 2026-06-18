"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import { CARE_FX, buildParticles, type CareKind, type Particle } from "./careFeedbackData";
import { haptic } from "@/lib/haptics";

interface Burst {
  key: number;
  kind: CareKind;
  reduced: boolean;
  particles: Particle[];
}

const TONE_GLOW: Record<"grow" | "accent" | "amber", string> = {
  grow: "rgba(118,192,36,0.30)",
  accent: "rgba(56,189,248,0.30)",
  amber: "rgba(251,146,60,0.30)",
};

/**
 * Care-feedback hook. Call `fire(kind)` the moment a player taps a care action
 * for instant, satisfying confirmation — a little burst of themed glyphs floats
 * up from the action, a soft glow pulses, and supporting phones buzz. Render
 * `layer` inside a `relative` container (the burst is absolutely positioned).
 *
 * Respects `prefers-reduced-motion`: collapses to a single gentle fade.
 */
export function useCareFeedback() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const seq = useRef(0);

  const fire = useCallback((kind: CareKind) => {
    const reduced =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    haptic(CARE_FX[kind].haptic);

    const key = ++seq.current;
    const burst: Burst = { key, kind, reduced, particles: buildParticles(kind, reduced) };
    setBursts((b) => [...b, burst]);

    const ttl = kind === "harvest" ? 1700 : 1300;
    window.setTimeout(() => {
      setBursts((b) => b.filter((x) => x.key !== key));
    }, ttl);
  }, []);

  const layer = <CareFeedbackLayer bursts={bursts} />;
  return { fire, layer };
}

function CareFeedbackLayer({ bursts }: { bursts: Burst[] }) {
  if (bursts.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible" aria-hidden>
      {bursts.map((b) => {
        const fx = CARE_FX[b.kind];
        return (
          <div key={b.key} className="absolute inset-0">
            {/* soft tonal glow pulse behind the action */}
            {!b.reduced && (
              <div
                className="gpe-care-glow absolute inset-x-0 bottom-0 h-16"
                style={{ background: `radial-gradient(60% 100% at 50% 100%, ${TONE_GLOW[fx.tone]}, transparent 70%)` }}
              />
            )}
            {b.particles.map((p) => (
              <span
                key={p.id}
                className={`absolute bottom-3 left-1/2 select-none text-xl ${
                  b.reduced ? "gpe-care-fade" : "gpe-care-float"
                }`}
                style={
                  {
                    "--dx": `${p.dx}px`,
                    animationDelay: `${p.delay}ms`,
                    animationDuration: `${p.dur}ms`,
                  } as CSSProperties
                }
              >
                {p.glyph}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
