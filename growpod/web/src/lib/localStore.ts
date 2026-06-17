"use client";

// Tracks which pod and plant IDs belong to the active player, persisted to
// localStorage. The backend list endpoints are authoritative, but this store
// lets locally-created entities appear instantly and survive transient read
// failures, and supports manual "import by id" recovery on a fresh device.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface IdsByPlayer {
  [playerId: string]: { podIds: string[]; plantIds: string[] };
}

interface IdStoreState {
  ids: IdsByPlayer;
  addPod: (playerId: string, podId: string) => void;
  addPlant: (playerId: string, plantId: string) => void;
  removePlant: (playerId: string, plantId: string) => void;
  removePod: (playerId: string, podId: string) => void;
  podIds: (playerId: string) => string[];
  plantIds: (playerId: string) => string[];
  clearPlayer: (playerId: string) => void;
}

function bucket(ids: IdsByPlayer, playerId: string) {
  return ids[playerId] ?? { podIds: [], plantIds: [] };
}

export const useIdStore = create<IdStoreState>()(
  persist(
    (set, get) => ({
      ids: {},
      addPod: (playerId, podId) =>
        set((s) => {
          const b = bucket(s.ids, playerId);
          if (b.podIds.includes(podId)) return s;
          return {
            ids: { ...s.ids, [playerId]: { ...b, podIds: [...b.podIds, podId] } },
          };
        }),
      addPlant: (playerId, plantId) =>
        set((s) => {
          const b = bucket(s.ids, playerId);
          if (b.plantIds.includes(plantId)) return s;
          return {
            ids: { ...s.ids, [playerId]: { ...b, plantIds: [...b.plantIds, plantId] } },
          };
        }),
      removePlant: (playerId, plantId) =>
        set((s) => {
          const b = bucket(s.ids, playerId);
          return {
            ids: {
              ...s.ids,
              [playerId]: { ...b, plantIds: b.plantIds.filter((id) => id !== plantId) },
            },
          };
        }),
      removePod: (playerId, podId) =>
        set((s) => {
          const b = bucket(s.ids, playerId);
          return {
            ids: {
              ...s.ids,
              [playerId]: { ...b, podIds: b.podIds.filter((id) => id !== podId) },
            },
          };
        }),
      podIds: (playerId) => bucket(get().ids, playerId).podIds,
      plantIds: (playerId) => bucket(get().ids, playerId).plantIds,
      clearPlayer: (playerId) =>
        set((s) => {
          const next = { ...s.ids };
          delete next[playerId];
          return { ids: next };
        }),
    }),
    {
      name: "gpe.ids",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
