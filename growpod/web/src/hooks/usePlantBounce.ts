"use client";

import { useCallback, useEffect } from "react";
import type { RefObject } from "react";
import { BOOST_APPLIED_EVENT } from "@/lib/arcade/boostEngine";

// Arcade juice — the boost squash-stretch-bounce (owner: "the plant shrinks a
// teeny bit and then pops it gets bigger and then it kinda bounces back").
// Plays the `gpe-plant-bounce` keyframe on the plant <canvas> inside `ref` and
// auto-fires on every arcade boost (BOOST_APPLIED_EVENT), so the reaction is
// consistent wherever a plant canvas + boosts coexist. Returns a `bounce()` so
// non-arcade boosts (e.g. the ⚡ growth boost) can trigger the same motion.
// Reduced-motion is honored by the CSS (the class is a no-op there).
export function usePlantBounce(ref: RefObject<HTMLElement | null>) {
  const bounce = useCallback(() => {
    const el = ref.current?.querySelector("canvas");
    if (!el) return;
    el.classList.remove("gpe-plant-bounce");
    // Force reflow so a rapid re-boost restarts the animation cleanly.
    void (el as HTMLCanvasElement).offsetWidth;
    el.classList.add("gpe-plant-bounce");
    el.addEventListener(
      "animationend",
      () => el.classList.remove("gpe-plant-bounce"),
      { once: true },
    );
  }, [ref]);

  useEffect(() => {
    window.addEventListener(BOOST_APPLIED_EVENT, bounce);
    return () => window.removeEventListener(BOOST_APPLIED_EVENT, bounce);
  }, [bounce]);

  return bounce;
}
