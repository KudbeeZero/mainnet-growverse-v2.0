"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  API_KEY_STORAGE,
  PLAYER_ID_STORAGE,
} from "@/lib/api/client";
import type { Player } from "@/lib/types";

interface SessionState {
  playerId: string | null;
  apiKey: string | null;
  hydrated: boolean;
  isAuthed: boolean;
  login: (playerId: string, apiKey: string) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPlayerId(window.localStorage.getItem(PLAYER_ID_STORAGE));
    setApiKey(window.localStorage.getItem(API_KEY_STORAGE));
    setHydrated(true);
  }, []);

  const login = useCallback((pid: string, key: string) => {
    window.localStorage.setItem(PLAYER_ID_STORAGE, pid);
    window.localStorage.setItem(API_KEY_STORAGE, key);
    setPlayerId(pid);
    setApiKey(key);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(PLAYER_ID_STORAGE);
    window.localStorage.removeItem(API_KEY_STORAGE);
    setPlayerId(null);
    setApiKey(null);
  }, []);

  const value: SessionState = {
    playerId,
    apiKey,
    hydrated,
    isAuthed: Boolean(playerId && apiKey),
    login,
    logout,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

/** Convenience: the active player id, asserted non-null (for authed pages). */
export function usePlayerId(): string {
  const { playerId } = useSession();
  return playerId ?? "";
}

export type LoginFromPlayer = (player: Player) => void;
