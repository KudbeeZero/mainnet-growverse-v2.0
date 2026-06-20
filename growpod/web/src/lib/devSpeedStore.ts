"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Lightweight "last visit" tracker, used to surface the welcome-back / neglect
// prompt after a long absence. (The global 10× speed faucet is now server-owned
// via `useTurbo` and toggled only in the Grow Chamber; the legacy localStorage
// key name below is kept so existing visit timestamps survive the migration.)
interface VisitState {
  lastVisitMs: number;
  markVisit: () => void;
}

export const useDevSpeedStore = create<VisitState>()(
  persist(
    (set) => ({
      lastVisitMs: 0,
      markVisit: () => set({ lastVisitMs: Date.now() }),
    }),
    {
      name: "gpe.devSpeed",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
