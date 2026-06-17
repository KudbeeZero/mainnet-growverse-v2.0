"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface DevSpeedState {
  devSpeed: boolean;
  elapsedHours: number;
  lastVisitMs: number;
  toggle: () => void;
  setDevSpeed: (v: boolean) => void;
  incrementHours: () => void;
  resetElapsed: () => void;
  markVisit: () => void;
}

export const useDevSpeedStore = create<DevSpeedState>()(
  persist(
    (set) => ({
      devSpeed: false,
      elapsedHours: 0,
      lastVisitMs: 0,
      toggle: () =>
        set((s) => ({
          devSpeed: !s.devSpeed,
          elapsedHours: 0,
        })),
      setDevSpeed: (v) => set({ devSpeed: v, elapsedHours: 0 }),
      incrementHours: () => set((s) => ({ elapsedHours: s.elapsedHours + 1 })),
      resetElapsed: () => set({ elapsedHours: 0 }),
      markVisit: () => set({ lastVisitMs: Date.now() }),
    }),
    {
      name: "gpe.devSpeed",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
