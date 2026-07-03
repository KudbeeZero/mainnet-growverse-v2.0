"use client";

import { useCallback, useEffect } from "react";
import type { RefObject } from "react";
import { BOOST_APPLIED_EVENT } from "@/lib/arcade/boostEngine";
import { CARE_REACTION_EVENT } from "@/components/plant/careReactionsData";

// Arcade juice on the plant canvas (see the rulebook,
// docs/memory/design/12-arcade-animation-system.md). Two canonical motions,
// each the "receipt" for an event, played on the plant <canvas> inside `ref`:
//   • boost  → `gpe-plant-bounce` (shrink → pop → bounce back), auto-fired on
//     every arcade boost (BOOST_APPLIED_EVENT); returned `bounce()` is reused by
//     the ⚡ growth boost.
//   • prune  → `gpe-plant-trim` (canopy relaxes lighter), auto-fired on the
//     prune care reaction — the motion says "mass came off".
// Reduced-motion is honored by the CSS (the classes are no-ops there).
export function usePlantBounce(ref: RefObject<HTMLElement | null>) {
  const play = useCallback(
    (cls: string) => {
      const el = ref.current?.querySelector("canvas");
      if (!el) return;
      // Under reduced-motion the CSS kills the animation, so animationend never
      // fires — bailing here prevents a permanent listener + class leak.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      el.classList.remove(cls);
      void (el as HTMLCanvasElement).offsetWidth; // reflow → restart cleanly
      el.classList.add(cls);
      // Scope the cleanup to THIS animation name; without the check any concurrent
      // animation (e.g. trim ending while bounce is mid-flight) would strip the
      // wrong class and cancel the still-running one.
      const onEnd = (e: Event) => {
        if ((e as AnimationEvent).animationName !== cls) return;
        el.classList.remove(cls);
        el.removeEventListener("animationend", onEnd);
      };
      el.addEventListener("animationend", onEnd);
    },
    [ref],
  );

  const bounce = useCallback(() => play("gpe-plant-bounce"), [play]);

  useEffect(() => {
    const onBoost = () => bounce();
    const onCare = (e: Event) => {
      if ((e as CustomEvent).detail === "prune") play("gpe-plant-trim");
    };
    window.addEventListener(BOOST_APPLIED_EVENT, onBoost);
    window.addEventListener(CARE_REACTION_EVENT, onCare);
    return () => {
      window.removeEventListener(BOOST_APPLIED_EVENT, onBoost);
      window.removeEventListener(CARE_REACTION_EVENT, onCare);
    };
  }, [bounce, play]);

  return bounce;
}
