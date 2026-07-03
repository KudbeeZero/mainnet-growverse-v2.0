"use client";

// Arcade Mode — boost engine.
//
// A boost is a timed grow-speed multiplier. This is a PURELY VISUAL layer: the sim
// is server-authoritative (compute-on-read), so a boost never advances real plant
// state — it multiplies an in-memory "visual grow" driver in the chamber so the bud
// *appears* to swell/frost faster. No DB writes, no API calls, no localStorage.
//
// State lives in a Zustand store. Every apply emits a `growpod:boost-applied`
// CustomEvent so any component (NutrientPop, sound hooks, on-chain event log) can
// react without being wired through React props.

import { create } from "zustand";

export type BoostType =
  | "NUTRIENT_SURGE"
  | "LIGHT_BLAST"
  | "MYCORRHIZAL_POP"
  | "ROOT_JUICE";

export interface BoostConfig {
  /** Grow-speed multiplier while active. */
  multiplier: number;
  /** Active duration in milliseconds. */
  durationMs: number;
  /** Display label for the HUD badge. */
  label: string;
  /** Per-cooldown lockout for the HUD button (ms). */
  cooldownMs: number;
}

// Tuning per spec: type → (multiplier, duration). Cooldown is a fixed 30s/type so
// the strongest boosts can't be spammed.
export const BOOST_CONFIG: Record<BoostType, BoostConfig> = {
  NUTRIENT_SURGE: { multiplier: 2, durationMs: 30_000, label: "NUTRIENT SURGE", cooldownMs: 30_000 },
  LIGHT_BLAST: { multiplier: 3, durationMs: 15_000, label: "LIGHT BLAST", cooldownMs: 30_000 },
  MYCORRHIZAL_POP: { multiplier: 1.5, durationMs: 60_000, label: "MYCORRHIZAL POP", cooldownMs: 30_000 },
  ROOT_JUICE: { multiplier: 2.5, durationMs: 20_000, label: "ROOT JUICE", cooldownMs: 30_000 },
};

export const BOOST_TYPES = Object.keys(BOOST_CONFIG) as BoostType[];

/** Two-tone palette per boost type — shared by the FX burst and the HUD glow. */
export const BOOST_COLORS: Record<BoostType, [string, string]> = {
  NUTRIENT_SURGE: ["#f5c842", "#7ecb35"],
  LIGHT_BLAST: ["#ffffff", "#00f5ff"],
  MYCORRHIZAL_POP: ["#c084fc", "#92400e"],
  ROOT_JUICE: ["#fb923c", "#166534"],
};

/** HUD glyph per boost type. */
export const BOOST_ICONS: Record<BoostType, string> = {
  NUTRIENT_SURGE: "💧",
  LIGHT_BLAST: "💡",
  MYCORRHIZAL_POP: "🍄",
  ROOT_JUICE: "🧪",
};

export interface BoostHistoryEntry {
  type: BoostType;
  multiplier: number;
  /** ms epoch when applied. */
  at: number;
}

export interface BoostApplyDetail {
  type: BoostType;
  multiplier: number;
  duration: number;
}

/** Event name dispatched on the window when a boost is applied. */
export const BOOST_APPLIED_EVENT = "growpod:boost-applied";

interface BoostState {
  activeBoost: BoostType | null;
  boostMultiplier: number;
  /** ms epoch when the current boost expires (0 when none). */
  boostExpiresAt: number;
  boostHistory: BoostHistoryEntry[];
  /** Per-type cooldown lockout: ms epoch until which the type can't re-apply.
   *  Lives in the store (not any one component's ref) so every boost surface —
   *  ArcadeHUD's tray AND ChamberDock's quick chips — shares one honest clock. */
  cooldownUntil: Partial<Record<BoostType, number>>;
  /** Apply a boost. Same type extends duration; a stronger type replaces a weaker
   *  active one; a weaker type is ignored while a stronger one is still running;
   *  a type on cooldown is rejected. Returns true when the boost actually applied
   *  (so callers only play feedback for real applies). A successful apply starts
   *  the type's cooldown; a rejected one does not. */
  applyBoost: (type: BoostType) => boolean;
  clearBoost: () => void;
  /** Effective multiplier right now (1 when none / expired). */
  getMultiplier: () => number;
  /** Remaining cooldown for a type in ms (0 when ready). */
  getCooldownRemaining: (type: BoostType) => number;
}

function now(): number {
  return Date.now();
}

export const useBoostStore = create<BoostState>((set, get) => ({
  activeBoost: null,
  boostMultiplier: 1,
  boostExpiresAt: 0,
  boostHistory: [],
  cooldownUntil: {},

  applyBoost: (type) => {
    const cfg = BOOST_CONFIG[type];
    const t = now();
    const s = get();
    // On cooldown → rejected. Previously each surface kept its own cooldown ref
    // (ArcadeHUD) or none at all (quick chips), so the lockout is enforced here.
    if ((s.cooldownUntil[type] ?? 0) > t) return false;
    const stillActive = s.activeBoost && s.boostExpiresAt > t;

    let nextType: BoostType;
    let nextMul: number;
    let nextExpiry: number;

    if (stillActive && s.activeBoost === type) {
      // Same type → stack duration onto the remaining time.
      nextType = type;
      nextMul = cfg.multiplier;
      nextExpiry = s.boostExpiresAt + cfg.durationMs;
    } else if (stillActive && cfg.multiplier <= s.boostMultiplier) {
      // A weaker (or equal) different type can't override a stronger active
      // boost. No cooldown is started — the tap did nothing.
      return false;
    } else {
      // No active boost, or the new type is stronger → replace.
      nextType = type;
      nextMul = cfg.multiplier;
      nextExpiry = t + cfg.durationMs;
    }

    set({
      activeBoost: nextType,
      boostMultiplier: nextMul,
      boostExpiresAt: nextExpiry,
      cooldownUntil: { ...s.cooldownUntil, [type]: t + cfg.cooldownMs },
      // Cap history so it can't grow unbounded in a long session.
      boostHistory: [...s.boostHistory, { type, multiplier: cfg.multiplier, at: t }].slice(-50),
    });

    // Broadcast for FX / sound / on-chain logging. Guarded for SSR.
    if (typeof window !== "undefined") {
      const detail: BoostApplyDetail = { type, multiplier: cfg.multiplier, duration: cfg.durationMs };
      window.dispatchEvent(new CustomEvent<BoostApplyDetail>(BOOST_APPLIED_EVENT, { detail }));
    }
    return true;
  },

  // Cooldowns survive clearBoost on purpose: clearing the active boost is not a
  // way to dodge a type's lockout.
  clearBoost: () => set({ activeBoost: null, boostMultiplier: 1, boostExpiresAt: 0 }),

  getMultiplier: () => {
    const s = get();
    if (!s.activeBoost || s.boostExpiresAt <= now()) return 1;
    return s.boostMultiplier;
  },

  getCooldownRemaining: (type) => Math.max(0, (get().cooldownUntil[type] ?? 0) - now()),
}));

/** Non-hook accessor for the current multiplier (for rAF loops outside React). */
export function getBoostMultiplier(): number {
  return useBoostStore.getState().getMultiplier();
}

/** Window event asking the chamber's quick tray (ArcadeHUD) to expand —
 *  dispatched by the inline BOOSTS section's "Add Boost" button. */
export const OPEN_BOOST_TRAY_EVENT = "gpe:open-boost-tray";
