"use client";

// Per-player onboarding memory, persisted to localStorage (mirrors the
// coach-mark store). Holds two flags per player: whether the guided tutorial is
// done (so returning users aren't forced through it) and whether the
// claim-your-tokens banner has been dismissed. The live run state (which step
// you're on) is NOT persisted — it's ephemeral provider state.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface OnboardingState {
  /** playerId → guided tutorial completed/skipped. */
  completed: Record<string, boolean>;
  /** playerId → token-claim banner dismissed. */
  bannerDismissed: Record<string, boolean>;
  isCompleted: (playerId: string) => boolean;
  markCompleted: (playerId: string) => void;
  /** Clear completion so "Restart tutorial" can run the flow again. */
  reset: (playerId: string) => void;
  isBannerDismissed: (playerId: string) => boolean;
  dismissBanner: (playerId: string) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      completed: {},
      bannerDismissed: {},
      isCompleted: (playerId) => Boolean(get().completed[playerId]),
      markCompleted: (playerId) =>
        set((s) => ({ completed: { ...s.completed, [playerId]: true } })),
      reset: (playerId) =>
        set((s) => ({ completed: { ...s.completed, [playerId]: false } })),
      isBannerDismissed: (playerId) => Boolean(get().bannerDismissed[playerId]),
      dismissBanner: (playerId) =>
        set((s) => ({ bannerDismissed: { ...s.bannerDismissed, [playerId]: true } })),
    }),
    { name: "gpe.onboarding", storage: createJSONStorage(() => localStorage) },
  ),
);
