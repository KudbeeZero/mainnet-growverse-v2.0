"use client";

// Arcade Mode — boost-reactive ambient glow layer (Phase 1, DOM/CSS only).
//
// Mount as a sibling of `PlantReactionLayer` inside the chamber stage's
// `relative` container. Three pieces, layered together:
//   a) a rim/backlight "pop" bloom behind the plant column — ALWAYS on, not
//      boost-gated. Uses `mix-blend-mode: screen` because the chamber canvas
//      beneath is fully opaque (a CSS drop-shadow can't bleed through it, but
//      a screen-blended gradient lightens it like a real backlight).
//   b) a boost-tinted ring pulse over the chamber's floor-ring area, visible
//      only while `activeBoost` is set and unexpired.
//   c) drifting sparkle bokeh, boost-tinted, visible only while boosted.
//
// This is Phase 1: pure DOM/CSS overlay, zero chamberCore.ts edits (two other
// agents are mid-flight on that file's bud-drawing functions on separate
// branches). Phase 2 — modulating the in-canvas ring/soil glow directly — is
// deferred until those branches land. See docs/memory/BACKLOG.md.

import { useEffect, useState, type CSSProperties } from "react";
import { useBoostStore, BOOST_COLORS } from "@/lib/arcade/boostEngine";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const SPARKLE_COUNT = 8;

interface Sparkle {
  id: number;
  left: number; // % of stage width
  top: number; // % of stage height
  angle: number; // deg — drift direction (gpe-arcade-particle's --angle)
  dist: number; // px — drift distance (--dist)
  dur: number; // ms — drift period (--dur)
  delay: number; // ms, negative to desync each particle's starting phase
  size: number; // px
}

function makeSparkles(): Sparkle[] {
  return Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
    id: i,
    left: 20 + Math.random() * 60,
    top: 26 + Math.random() * 54,
    angle: Math.random() * 360,
    dist: 16 + Math.random() * 26,
    dur: 2800 + Math.random() * 2400,
    delay: -(Math.random() * 4000),
    size: 2.5 + Math.random() * 2.5,
  }));
}

export function BoostAmbientLayer() {
  const activeBoost = useBoostStore((s) => s.activeBoost);
  const boostExpiresAt = useBoostStore((s) => s.boostExpiresAt);
  const reducedMotion = usePrefersReducedMotion();

  // The store doesn't emit an event on expiry, so re-check `boostExpiresAt >
  // now` on a light tick while a boost is active — same pattern as ArcadeHUD's
  // countdown.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeBoost) return;
    const id = window.setInterval(() => setTick((t) => (t + 1) % 1_000_000), 250);
    return () => window.clearInterval(id);
  }, [activeBoost]);

  const boosted = !!activeBoost && boostExpiresAt > Date.now();
  const colors = activeBoost ? BOOST_COLORS[activeBoost] : null;

  // Re-roll sparkle layout only when a fresh boost starts, not on every tick.
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  useEffect(() => {
    if (boosted) setSparkles(makeSparkles());
  }, [activeBoost, boosted]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[8] overflow-hidden" aria-hidden>
      {/* a) rim/backlight pop — static, always on. */}
      <div
        className="gpe-glow-rim absolute inset-0"
        style={{
          background:
            "radial-gradient(46% 60% at 50% 38%, rgba(94,234,212,0.22), rgba(56,189,248,0.10) 45%, transparent 72%)",
        }}
      />

      {boosted && colors && (
        <>
          {/* b) boost ring pulse over the floor-ring area. Chamber canvas draws
              its floor ring ~83% down the stage (see chamberCore.ts `floorY`);
              positioned here so it reads over the pot/soil band rather than
              behind the action-tile bar that sits at the very bottom in
              portrait layouts. */}
          <div className="absolute inset-x-0 bottom-[13%] flex justify-center">
            <span
              data-testid="boost-ambient-ring"
              className={`h-11 w-[42%] rounded-[50%] ${
                reducedMotion ? "gpe-glow-ring-static" : "gpe-glow-ring-pulse"
              }`}
              style={
                {
                  "--gpe-glow-tint": colors[0],
                  "--gpe-glow-tint2": colors[1],
                } as CSSProperties
              }
            />
          </div>

          {/* c) drifting sparkle bokeh. */}
          {!reducedMotion &&
            sparkles.map((p) => (
              <span
                key={p.id}
                className="gpe-glow-sparkle absolute block rounded-full"
                style={
                  {
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    width: p.size,
                    height: p.size,
                    background: colors[1],
                    boxShadow: `0 0 6px ${colors[0]}`,
                    animationDelay: `${p.delay}ms`,
                    "--angle": `${p.angle}deg`,
                    "--dist": `${p.dist}px`,
                    "--dur": `${p.dur}ms`,
                  } as CSSProperties
                }
              />
            ))}
        </>
      )}
    </div>
  );
}
