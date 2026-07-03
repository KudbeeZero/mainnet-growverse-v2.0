"use client";

// Lets panel CONTENT (the real action/insight components rendered inside the
// left/right overlays) tell the shell "I just finished, compact me" — e.g. a
// care action resolves, or the player taps outside. The shell owns the actual
// open/tab state (see GameShell.tsx); this context is just the wire back up.

import { createContext, useContext } from "react";

export type EdgeSide = "left" | "right";

export interface GameShellApi {
  /** Slide the given panel back to its slim compact edge tab. */
  collapse: (side: EdgeSide) => void;
}

const GameShellContext = createContext<GameShellApi | null>(null);

export function GameShellProvider({ value, children }: { value: GameShellApi; children: React.ReactNode }) {
  return <GameShellContext.Provider value={value}>{children}</GameShellContext.Provider>;
}

/** Safe to call outside a GameShell (e.g. in Storybook/tests) — no-ops instead of throwing. */
export function useGameShell(): GameShellApi {
  return useContext(GameShellContext) ?? { collapse: () => {} };
}
