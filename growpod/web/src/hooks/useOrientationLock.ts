"use client";

// Real orientation detection for the landscape-only game shell — NOT a CSS
// media-query reflow hack. Reads the Screen Orientation API when available
// (`screen.orientation.type`, + its `change` event) and falls back to
// `matchMedia('(orientation: portrait)')` (Safari/older browsers don't expose
// `screen.orientation` reliably). Also tracks whether the device looks like a
// handheld (coarse pointer, narrow max dimension) so a portrait secondary
// monitor on a desktop rig is never mistaken for "please rotate your phone".

import { useEffect, useState } from "react";

function readPortrait(): boolean {
  if (typeof window === "undefined") return false;
  const so = window.screen?.orientation?.type;
  if (so) return so.startsWith("portrait");
  return window.matchMedia?.("(orientation: portrait)").matches ?? window.innerHeight > window.innerWidth;
}

function readHandheld(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const smallish = Math.max(window.innerWidth, window.innerHeight) <= 1024;
  return coarse && smallish;
}

export interface OrientationLockState {
  /** True when the viewport currently reads as portrait (real orientation, not a guess). */
  isPortrait: boolean;
  /** True when this looks like a handheld (touch + small max-dimension) — the
   *  only devices the rotate-prompt should ever block. A portrait desktop
   *  monitor never triggers the gate. */
  isHandheld: boolean;
}

export function useOrientationLock(): OrientationLockState {
  const [state, setState] = useState<OrientationLockState>(() => ({
    isPortrait: readPortrait(),
    isHandheld: readHandheld(),
  }));

  useEffect(() => {
    const update = () => setState({ isPortrait: readPortrait(), isHandheld: readHandheld() });
    update();

    const mql = window.matchMedia?.("(orientation: portrait)");
    mql?.addEventListener?.("change", update);
    const so = window.screen?.orientation;
    so?.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      mql?.removeEventListener?.("change", update);
      so?.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return state;
}
