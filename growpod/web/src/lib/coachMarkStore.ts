"use client";

// Per-player memory of which coach-marks have been seen/dismissed, persisted to
// localStorage (mirrors `useIdStore`). This is the "non-nagging" guarantee — a
// dismissed mark never returns for that player. Per-player *server* persistence
// (so a brand-new device starts fresh, or to suppress tips for pre-existing
// veterans) would be a Backend Work Order; this is the frontend-only baseline.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ALL_DISMISSED } from "./coachMarks";

interface CoachMarkState {
  /** playerId → dismissed mark ids (may include the ALL_DISMISSED sentinel). */
  dismissed: Record<string, string[]>;
  dismiss: (playerId: string, markId: string) => void;
  dismissAll: (playerId: string) => void;
}

export const useCoachMarkStore = create<CoachMarkState>()(
  persist(
    (set) => ({
      dismissed: {},
      dismiss: (playerId, markId) =>
        set((s) => {
          const cur = s.dismissed[playerId] ?? [];
          if (cur.includes(markId)) return s;
          return { dismissed: { ...s.dismissed, [playerId]: [...cur, markId] } };
        }),
      dismissAll: (playerId) =>
        set((s) => {
          const cur = s.dismissed[playerId] ?? [];
          if (cur.includes(ALL_DISMISSED)) return s;
          return { dismissed: { ...s.dismissed, [playerId]: [...cur, ALL_DISMISSED] } };
        }),
    }),
    { name: "gpe.coach", storage: createJSONStorage(() => localStorage) },
  ),
);
