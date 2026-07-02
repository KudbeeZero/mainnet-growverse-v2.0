"use client";

// Arcade Mode — Trichome Rush.
//
// A short (30-60s) timed session: glowing trichome "targets" appear over the
// plant view and the player taps them before they fade. This is a PURELY
// VISUAL / local mini-game — scores are NOT economy. The sim is
// server-authoritative (compute-on-read), so a session never advances real
// plant state, never calls api.plants.boost / api.plants.growthBoost, and
// never touches health, genetics, or GROW balance. No DB writes, no API
// calls. localStorage IS used for score history (arcade scores aren't
// economy — see docs/memory/design/12-arcade-layer.md).
//
// State lives in a Zustand store, driven by an external `tick(now)` call (the
// component owns the rAF/interval loop, same pattern as ArcadeHUD's cooldown
// clock). Every finished session emits a `growpod:trichome-rush-result`
// CustomEvent so any component (a future cosmetic-frost listener, sound,
// on-chain event log) can react without prop drilling — mirrors
// `boostEngine.ts`'s `growpod:boost-applied` pattern.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { clamp, mulberry32 } from "@/lib/chamber/morphology";

export type RushPhase = "idle" | "countdown" | "playing" | "results";

/** A single on-screen target, positioned in 0..1 relative viewport space. */
export interface RushTarget {
  id: number;
  x: number;
  y: number;
  /** Diameter in px. */
  size: number;
  spawnedAt: number;
  ttlMs: number;
}

/** The bounded, cosmetic reward a session's score converts into. Mirrors the
 *  multiplier/duration shape of `boostEngine.ts`'s `BoostConfig` — a temporary,
 *  capped `highlightBoost` offset a chamber-visual listener MAY apply; never a
 *  server/economy value. */
export interface FrostBoostReward {
  /** Bounded 0..FROST_BOOST_MAX cosmetic highlight/frost bump. */
  highlightBoost: number;
  /** How long the cosmetic bump should be considered "active" (ms). */
  durationMs: number;
}

export interface SessionResult {
  score: number;
  hits: number;
  misses: number;
  comboPeak: number;
  accuracy: number;
  durationMs: number;
  frostBoost: FrostBoostReward;
  seed: number;
  at: number;
}

// ---- Tuning ----------------------------------------------------------

export const COUNTDOWN_MS = 3_000;
export const SESSION_MS = 45_000; // 30-60s spec window
export const TARGET_TTL_MS = 1_400;
export const SPAWN_INTERVAL_MS = 550;
export const MAX_CONCURRENT_TARGETS = 3;
export const MAX_HISTORY = 10;
const TARGET_MARGIN = 0.1; // keep spawns off the very edge, in 0..1 space
const TARGET_MIN_SIZE = 34;
const TARGET_SIZE_RANGE = 22;

const FROST_BOOST_MAX = 0.35; // stays well inside BudDNA.highlightBoost's 0..1 clamp
const FROST_BOOST_DURATION_MIN_MS = 8_000;
const FROST_BOOST_DURATION_MAX_MS = 20_000;
const FROST_BOOST_SCORE_CAP = 1_500; // score at/above this earns the max reward

/** Event name dispatched on the window when a session finishes. */
export const TRICHOME_RUSH_RESULT_EVENT = "growpod:trichome-rush-result";

// ---- Pure helpers (unit-tested) ---------------------------------------

/** Deterministic target spawn given an rng cursor — pure, no Date.now(). */
export function spawnTarget(rng: () => number, now: number, ttlMs: number, id: number): RushTarget {
  const x = TARGET_MARGIN + rng() * (1 - 2 * TARGET_MARGIN);
  const y = TARGET_MARGIN + rng() * (1 - 2 * TARGET_MARGIN);
  const size = TARGET_MIN_SIZE + rng() * TARGET_SIZE_RANGE;
  return { id, x, y, size, spawnedAt: now, ttlMs };
}

export interface ScoreInput {
  hits: number;
  misses: number;
  comboPeak: number;
  /** ms left on the session clock when it ended (0 for a normal timeout). */
  timeRemainingMs?: number;
  sessionMs?: number;
}

export interface ScoreResult {
  score: number;
  accuracy: number;
}

/** Score is a pure function of (hits, misses→accuracy, comboPeak, time-left bonus). */
export function computeScore(input: ScoreInput): ScoreResult {
  const attempts = input.hits + input.misses;
  const accuracy = attempts > 0 ? input.hits / attempts : 0;
  const base = input.hits * 100;
  const comboBonus = input.comboPeak * 30;
  const accuracyBonus = Math.round(accuracy * 200);
  const timeBonus =
    input.timeRemainingMs && input.sessionMs
      ? Math.round(clamp(input.timeRemainingMs / input.sessionMs, 0, 1) * 150)
      : 0;
  return { score: base + comboBonus + accuracyBonus + timeBonus, accuracy };
}

/** Score → a bounded cosmetic frost reward. Never unbounded, never economy. */
export function computeFrostReward(score: number): FrostBoostReward {
  const t = clamp(score / FROST_BOOST_SCORE_CAP, 0, 1);
  return {
    highlightBoost: Math.round(t * FROST_BOOST_MAX * 100) / 100,
    durationMs: Math.round(
      FROST_BOOST_DURATION_MIN_MS + t * (FROST_BOOST_DURATION_MAX_MS - FROST_BOOST_DURATION_MIN_MS),
    ),
  };
}

/** Static, factual copy — no AI call, no server fetch. Rotated deterministically
 *  by session seed so the tip varies session to session without RNG state. */
export const TRICHOME_FACTS: readonly string[] = [
  "Trichomes are the tiny, mushroom-shaped glands on buds and sugar leaves — they contain the cannabinoids and terpenes that give a strain its effects and aroma.",
  "\"Frost\" is trichome density: the crystal-like shimmer you see up close is thousands of individual resin glands catching the light.",
  "Trichomes evolved as a defense — the resin's bitterness and stickiness deter grazing insects and animals, and the compounds inside also filter UV light.",
  "Clear trichomes are still developing; cloudy trichomes hold peak cannabinoid levels; amber trichomes mean the compounds have started to degrade into more sedating forms.",
];

export function factForSeed(seed: number): string {
  const idx = Math.abs(Math.floor(seed)) % TRICHOME_FACTS.length;
  return TRICHOME_FACTS[idx];
}

// ---- Store --------------------------------------------------------------

interface TrichomeRushState {
  phase: RushPhase;
  seed: number;
  targets: RushTarget[];
  hits: number;
  misses: number;
  combo: number;
  comboPeak: number;
  countdownEndsAt: number;
  sessionEndsAt: number;
  lastSpawnAt: number;
  lastResult: SessionResult | null;
  history: SessionResult[];
  bestScore: number;
  _idSeq: number;
  _rng: (() => number) | null;

  /** Begin a new countdown → playing session. `seed` defaults to a fresh
   *  wall-clock-derived value (tests should pass one explicitly). */
  startSession: (opts?: { seed?: number; now?: number }) => void;
  /** Advance the state machine. Call every animation frame / short interval
   *  from the component that owns the game loop. */
  tick: (now: number) => void;
  /** Register a tap that hit an on-screen target. */
  hitTarget: (id: number) => void;
  /** Register a tap that missed every target (resets the combo, like a timeout). */
  registerMiss: () => void;
  /** Abandon the current session without recording a result (closing the overlay mid-game). */
  abortSession: () => void;
  /** Return to idle after viewing results. */
  dismissResults: () => void;
}

function nextSeed(): number {
  // Wall-clock + a bit of entropy from Math.random — fine for "which session
  // is this" purposes; determinism only matters for tests, which pass seed.
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function emitResult(result: SessionResult) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SessionResult>(TRICHOME_RUSH_RESULT_EVENT, { detail: result }));
}

export const useTrichomeRushStore = create<TrichomeRushState>()(
  persist(
    (set, get) => ({
      phase: "idle",
      seed: 0,
      targets: [],
      hits: 0,
      misses: 0,
      combo: 0,
      comboPeak: 0,
      countdownEndsAt: 0,
      sessionEndsAt: 0,
      lastSpawnAt: 0,
      lastResult: null,
      history: [],
      bestScore: 0,
      _idSeq: 0,
      _rng: null,

      startSession: (opts = {}) => {
        const now = opts.now ?? Date.now();
        const seed = opts.seed ?? nextSeed();
        set({
          phase: "countdown",
          seed,
          targets: [],
          hits: 0,
          misses: 0,
          combo: 0,
          comboPeak: 0,
          countdownEndsAt: now + COUNTDOWN_MS,
          sessionEndsAt: 0,
          lastSpawnAt: now,
          lastResult: null,
          _idSeq: 0,
          _rng: mulberry32(seed >>> 0),
        });
      },

      tick: (now) => {
        const s = get();

        if (s.phase === "countdown") {
          if (now < s.countdownEndsAt) return;
          const rng = s._rng ?? mulberry32(s.seed >>> 0);
          const idSeq = s._idSeq + 1;
          set({
            phase: "playing",
            sessionEndsAt: now + SESSION_MS,
            lastSpawnAt: now,
            targets: [spawnTarget(rng, now, TARGET_TTL_MS, idSeq)],
            _idSeq: idSeq,
          });
          return;
        }

        if (s.phase !== "playing") return;

        // Expire stale (unhit) targets — each is a miss and resets the combo.
        const alive: RushTarget[] = [];
        let expired = 0;
        for (const t of s.targets) {
          if (now - t.spawnedAt >= t.ttlMs) expired += 1;
          else alive.push(t);
        }
        let misses = s.misses;
        let combo = s.combo;
        if (expired > 0) {
          misses += expired;
          combo = 0;
        }

        let targets = alive;
        let lastSpawnAt = s.lastSpawnAt;
        let idSeq = s._idSeq;
        const stillRunning = now < s.sessionEndsAt;
        if (stillRunning && now - lastSpawnAt >= SPAWN_INTERVAL_MS && targets.length < MAX_CONCURRENT_TARGETS) {
          const rng = s._rng ?? mulberry32(s.seed >>> 0);
          idSeq += 1;
          targets = [...targets, spawnTarget(rng, now, TARGET_TTL_MS, idSeq)];
          lastSpawnAt = now;
        }

        if (!stillRunning) {
          const { score, accuracy } = computeScore({
            hits: s.hits,
            misses,
            comboPeak: s.comboPeak,
            timeRemainingMs: 0,
            sessionMs: SESSION_MS,
          });
          const result: SessionResult = {
            score,
            hits: s.hits,
            misses,
            comboPeak: s.comboPeak,
            accuracy,
            durationMs: SESSION_MS,
            frostBoost: computeFrostReward(score),
            seed: s.seed,
            at: now,
          };
          set({
            phase: "results",
            targets: [],
            misses,
            lastResult: result,
            bestScore: Math.max(s.bestScore, score),
            history: [...s.history, result].slice(-MAX_HISTORY),
          });
          emitResult(result);
          return;
        }

        set({ targets, misses, combo, lastSpawnAt, _idSeq: idSeq });
      },

      hitTarget: (id) => {
        const s = get();
        if (s.phase !== "playing") return;
        const idx = s.targets.findIndex((t) => t.id === id);
        if (idx === -1) return; // already expired/removed — no penalty for a late click
        const targets = s.targets.slice();
        targets.splice(idx, 1);
        const combo = s.combo + 1;
        set({
          targets,
          hits: s.hits + 1,
          combo,
          comboPeak: Math.max(s.comboPeak, combo),
        });
      },

      registerMiss: () => {
        const s = get();
        if (s.phase !== "playing") return;
        set({ misses: s.misses + 1, combo: 0 });
      },

      abortSession: () => set({ phase: "idle", targets: [], _rng: null }),

      dismissResults: () => set({ phase: "idle", targets: [], lastResult: null, _rng: null }),
    }),
    {
      name: "gpe.arcade.trichome-rush",
      storage: createJSONStorage(() => localStorage),
      // Persist only the score ledger — never the transient game/session state
      // (which also holds a non-serializable rng closure).
      partialize: (s) => ({ history: s.history, bestScore: s.bestScore }),
    },
  ),
);
