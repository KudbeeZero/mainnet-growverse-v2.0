"use client";

// Orchestrates the guided first-session tutorial: auto-starts once per player on
// first dashboard load, tracks the current step, advances on navigation for
// nav-tap steps (click/select steps are handled inside the overlay), and
// persists completion so returning players aren't forced through it again.
// Exposes `restart()` for the "Restart tutorial" control.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";
import { useOnboardingStore } from "@/lib/onboarding/onboardingStore";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import { OnboardingOverlay } from "./OnboardingOverlay";

interface OnboardingCtx {
  restart: () => void;
  active: boolean;
}

const Ctx = createContext<OnboardingCtx | null>(null);

export function useOnboarding(): OnboardingCtx {
  return useContext(Ctx) ?? { restart: () => {}, active: false };
}

// Routes where the tutorial overlay must never appear.
const SUPPRESSED = ["/onboarding", "/ftue"];

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { playerId, isAuthed, hydrated } = useSession();
  const isCompleted = useOnboardingStore((s) => s.isCompleted);
  const markCompleted = useOnboardingStore((s) => s.markCompleted);
  const reset = useOnboardingStore((s) => s.reset);

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const total = ONBOARDING_STEPS.length;
  const step = ONBOARDING_STEPS[index];

  // Pathname captured when the current step began — lets route-based steps
  // advance only on a *real* navigation, never instantly on step entry.
  const entryPathRef = useRef(pathname);
  useEffect(() => {
    entryPathRef.current = pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Auto-start once per player, on first dashboard load.
  useEffect(() => {
    if (!hydrated || !isAuthed || !playerId || active) return;
    if (isCompleted(playerId)) return;
    if (!pathname.startsWith("/dashboard")) return;
    setIndex(0);
    setActive(true);
  }, [hydrated, isAuthed, playerId, pathname, active, isCompleted]);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i >= total - 1) {
        if (playerId) markCompleted(playerId);
        setActive(false);
        return 0;
      }
      return i + 1;
    });
  }, [total, playerId, markCompleted]);

  const skip = useCallback(() => {
    if (playerId) markCompleted(playerId); // skip = don't show again
    setActive(false);
    setIndex(0);
  }, [playerId, markCompleted]);

  const restart = useCallback(() => {
    if (playerId) reset(playerId);
    setIndex(0);
    setActive(true);
  }, [playerId, reset]);

  // Route-based advancement for nav-tap steps.
  useEffect(() => {
    if (!active || !step) return;
    const rule = step.advance;
    if (rule.kind !== "route" && rule.kind !== "route-or-click") return;
    const matches = pathname === rule.path || pathname.startsWith(rule.path + "/");
    if (matches && pathname !== entryPathRef.current) advance();
  }, [pathname, active, step, advance]);

  const showOverlay =
    active && hydrated && isAuthed && !!step && !SUPPRESSED.some((p) => pathname.startsWith(p));

  return (
    <Ctx.Provider value={{ restart, active }}>
      {children}
      {showOverlay && (
        <OnboardingOverlay
          step={step}
          index={index}
          total={total}
          onAdvance={advance}
          onSkip={skip}
        />
      )}
    </Ctx.Provider>
  );
}
