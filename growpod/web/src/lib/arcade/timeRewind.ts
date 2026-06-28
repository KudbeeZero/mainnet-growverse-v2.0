"use client";

// Arcade Mode — time rewind.
//
// A circular buffer of recent bud "looks" (the scalar props BudGL renders) plus an
// animated backward scrub. Rewinding is purely visual: it overrides the bud scalars
// the chamber feeds to BudGL so the bud appears to "un-grow" (pistils retract, frost
// recedes, bud shrinks). It never touches server/plant state, the DB, or the chain.

import { create } from "zustand";

/** The bud's renderable scalar state — mirrors the props BudGL accepts. */
export interface BudScalars {
  budDev: number;
  ripe: number;
  brown: number;
  trich: number;
  purple: number;
}

export interface Snapshot extends BudScalars {
  /** Nominal grow day at capture (for the scrubber marker label). */
  day: number;
  /** Growth stage at capture. */
  stage: string;
  /** ms epoch at capture. */
  at: number;
}

export const MAX_SNAPSHOTS = 20;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Linear interpolate every scalar from→to at t∈[0,1]. Pure (exported for tests). */
export function lerpScalars(from: BudScalars, to: BudScalars, t: number): BudScalars {
  const k = clamp01(t);
  const mix = (a: number, b: number) => a + (b - a) * k;
  return {
    budDev: mix(from.budDev, to.budDev),
    ripe: mix(from.ripe, to.ripe),
    brown: mix(from.brown, to.brown),
    trich: mix(from.trich, to.trich),
    purple: mix(from.purple, to.purple),
  };
}

function pickScalars(s: BudScalars): BudScalars {
  return { budDev: s.budDev, ripe: s.ripe, brown: s.brown, trich: s.trich, purple: s.purple };
}

interface RewindState {
  snapshots: Snapshot[];
  /** When non-null, the chamber renders these scalars instead of the live ones. */
  override: BudScalars | null;
  /** True while a rewind is engaged (drives the VHS filter + scrubber markers). */
  rewindActive: boolean;
  /** rAF handle for an in-flight scrub animation (so a new scrub cancels the old). */
  _raf: number | null;
  captureSnapshot: (snap: Omit<Snapshot, "at">) => void;
  getSnapshots: () => Snapshot[];
  /** Animate the bud backward to snapshot `index`. Reduced-motion → instant. */
  rewindTo: (index: number, opts?: { reducedMotion?: boolean; durationMs?: number }) => void;
  /** Drop the override + filter and return the chamber to live rendering. */
  exitRewind: () => void;
}

export const useRewindStore = create<RewindState>((set, get) => ({
  snapshots: [],
  override: null,
  rewindActive: false,
  _raf: null,

  captureSnapshot: (snap) => {
    const at = Date.now();
    set((s) => ({ snapshots: [...s.snapshots, { ...snap, at }].slice(-MAX_SNAPSHOTS) }));
  },

  getSnapshots: () => get().snapshots,

  rewindTo: (index, opts = {}) => {
    const s = get();
    const target = s.snapshots[index];
    if (!target) return;
    if (s._raf !== null && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(s._raf);

    const to = pickScalars(target);
    const from = s.override ?? (s.snapshots.length ? pickScalars(s.snapshots[s.snapshots.length - 1]) : to);

    const canAnimate =
      !opts.reducedMotion && typeof requestAnimationFrame !== "undefined" && typeof performance !== "undefined";

    if (!canAnimate) {
      set({ override: to, rewindActive: true, _raf: null });
      return;
    }

    // Scrub at ~3× perceived speed: short, eased interpolation backward.
    const duration = opts.durationMs ?? 500;
    const start = performance.now();
    set({ rewindActive: true });
    const step = (t: number) => {
      const p = clamp01((t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 2); // ease-out
      set({ override: lerpScalars(from, to, eased) });
      if (p < 1) {
        set({ _raf: requestAnimationFrame(step) });
      } else {
        set({ override: to, _raf: null });
      }
    };
    set({ _raf: requestAnimationFrame(step) });
  },

  exitRewind: () => {
    const s = get();
    if (s._raf !== null && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(s._raf);
    set({ override: null, rewindActive: false, _raf: null });
  },
}));
