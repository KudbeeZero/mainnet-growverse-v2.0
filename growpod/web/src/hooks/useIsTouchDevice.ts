"use client";

// Branches the HUD between the mobile swipe-gesture interaction and the
// desktop hover/click interaction. Keyed off actual input capability
// (`pointer: coarse`), not viewport width — a touch tablet in landscape should
// still get swipe gestures, and a narrow desktop window shouldn't.

import { useEffect, useState } from "react";

export function useIsTouchDevice(): boolean {
  const [touch, setTouch] = useState(() =>
    typeof window === "undefined" ? false : (window.matchMedia?.("(pointer: coarse)").matches ?? false),
  );

  useEffect(() => {
    const mql = window.matchMedia?.("(pointer: coarse)");
    if (!mql) return;
    const update = () => setTouch(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);

  return touch;
}
