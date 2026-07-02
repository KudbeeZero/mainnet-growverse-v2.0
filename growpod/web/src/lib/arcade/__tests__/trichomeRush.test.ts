import { describe, it, expect, beforeEach } from "vitest";
import { mulberry32 } from "@/lib/chamber/morphology";
import {
  useTrichomeRushStore,
  spawnTarget,
  computeScore,
  computeFrostReward,
  factForSeed,
  TRICHOME_FACTS,
  COUNTDOWN_MS,
  SESSION_MS,
  TARGET_TTL_MS,
  SPAWN_INTERVAL_MS,
  MAX_HISTORY,
} from "@/lib/arcade/trichomeRush";

function reset() {
  useTrichomeRushStore.setState({
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
  });
}

describe("spawnTarget", () => {
  it("is deterministic given the same rng seed", () => {
    const a = spawnTarget(mulberry32(42), 1_000, TARGET_TTL_MS, 1);
    const b = spawnTarget(mulberry32(42), 1_000, TARGET_TTL_MS, 1);
    expect(a).toEqual(b);
  });

  it("keeps targets within the 0..1 margin-clamped viewport", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const t = spawnTarget(rng, 0, TARGET_TTL_MS, i);
      expect(t.x).toBeGreaterThanOrEqual(0.1);
      expect(t.x).toBeLessThanOrEqual(0.9);
      expect(t.y).toBeGreaterThanOrEqual(0.1);
      expect(t.y).toBeLessThanOrEqual(0.9);
    }
  });

  it("a different seed produces a different spawn sequence", () => {
    const a = spawnTarget(mulberry32(1), 0, TARGET_TTL_MS, 1);
    const b = spawnTarget(mulberry32(2), 0, TARGET_TTL_MS, 1);
    expect(a).not.toEqual(b);
  });
});

describe("computeScore", () => {
  it("is a pure function of hits/misses/comboPeak/time bonus", () => {
    const r1 = computeScore({ hits: 10, misses: 2, comboPeak: 5 });
    const r2 = computeScore({ hits: 10, misses: 2, comboPeak: 5 });
    expect(r1).toEqual(r2);
  });

  it("more hits and a higher combo peak score higher", () => {
    const low = computeScore({ hits: 5, misses: 5, comboPeak: 2 });
    const high = computeScore({ hits: 10, misses: 0, comboPeak: 10 });
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.accuracy).toBe(1);
  });

  it("accuracy is 0 when there were no attempts", () => {
    expect(computeScore({ hits: 0, misses: 0, comboPeak: 0 }).accuracy).toBe(0);
  });

  it("time-remaining bonus only applies when both time fields are given", () => {
    const noBonus = computeScore({ hits: 5, misses: 0, comboPeak: 5 });
    const withBonus = computeScore({ hits: 5, misses: 0, comboPeak: 5, timeRemainingMs: 5000, sessionMs: 10000 });
    expect(withBonus.score).toBeGreaterThan(noBonus.score);
  });
});

describe("computeFrostReward", () => {
  it("is bounded regardless of an extreme score", () => {
    const reward = computeFrostReward(1_000_000);
    expect(reward.highlightBoost).toBeLessThanOrEqual(0.35);
    expect(reward.durationMs).toBeLessThanOrEqual(20_000);
  });

  it("a score of 0 yields no reward", () => {
    const reward = computeFrostReward(0);
    expect(reward.highlightBoost).toBe(0);
    expect(reward.durationMs).toBe(8_000);
  });

  it("scales monotonically with score", () => {
    const low = computeFrostReward(200);
    const high = computeFrostReward(1000);
    expect(high.highlightBoost).toBeGreaterThanOrEqual(low.highlightBoost);
    expect(high.durationMs).toBeGreaterThanOrEqual(low.durationMs);
  });
});

describe("factForSeed", () => {
  it("always returns one of the static facts", () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(TRICHOME_FACTS).toContain(factForSeed(seed));
    }
  });
});

describe("trichomeRush store — session lifecycle", () => {
  beforeEach(reset);

  it("startSession enters countdown with a deterministic seed", () => {
    const { startSession } = useTrichomeRushStore.getState();
    startSession({ seed: 123, now: 0 });
    const s = useTrichomeRushStore.getState();
    expect(s.phase).toBe("countdown");
    expect(s.seed).toBe(123);
    expect(s.countdownEndsAt).toBe(COUNTDOWN_MS);
  });

  it("tick transitions countdown -> playing once the countdown elapses, spawning a target", () => {
    const { startSession, tick } = useTrichomeRushStore.getState();
    startSession({ seed: 1, now: 0 });
    tick(COUNTDOWN_MS - 1); // not yet
    expect(useTrichomeRushStore.getState().phase).toBe("countdown");
    tick(COUNTDOWN_MS);
    const s = useTrichomeRushStore.getState();
    expect(s.phase).toBe("playing");
    expect(s.targets.length).toBe(1);
  });

  it("hitTarget increments hits/combo and removes the target", () => {
    const { startSession, tick, hitTarget } = useTrichomeRushStore.getState();
    startSession({ seed: 1, now: 0 });
    tick(COUNTDOWN_MS);
    const target = useTrichomeRushStore.getState().targets[0];
    hitTarget(target.id);
    const s = useTrichomeRushStore.getState();
    expect(s.hits).toBe(1);
    expect(s.combo).toBe(1);
    expect(s.comboPeak).toBe(1);
    expect(s.targets.find((t) => t.id === target.id)).toBeUndefined();
  });

  it("consecutive hits build combo; comboPeak tracks the max", () => {
    const { startSession, tick, hitTarget } = useTrichomeRushStore.getState();
    startSession({ seed: 5, now: 0 });
    tick(COUNTDOWN_MS);
    let now = COUNTDOWN_MS;
    for (let i = 0; i < 4; i++) {
      const t = useTrichomeRushStore.getState().targets[0];
      hitTarget(t.id);
      // A new target only spawns once the spawn interval elapses.
      now += SPAWN_INTERVAL_MS;
      tick(now);
    }
    const s = useTrichomeRushStore.getState();
    expect(s.combo).toBeGreaterThanOrEqual(4);
    expect(s.comboPeak).toBe(s.combo);
  });

  it("a target left unhit past its ttl expires as a miss and resets the combo", () => {
    const { startSession, tick, hitTarget } = useTrichomeRushStore.getState();
    startSession({ seed: 9, now: 0 });
    tick(COUNTDOWN_MS);
    const t0 = useTrichomeRushStore.getState().targets[0];
    hitTarget(t0.id); // combo = 1
    expect(useTrichomeRushStore.getState().combo).toBe(1);

    // Let the next spawned target expire without hitting it.
    let now = COUNTDOWN_MS;
    now += SPAWN_INTERVAL_MS;
    tick(now); // spawns a fresh target
    const t1 = useTrichomeRushStore.getState().targets.at(-1)!;
    now = t1.spawnedAt + TARGET_TTL_MS + 1;
    tick(now);
    const s = useTrichomeRushStore.getState();
    expect(s.combo).toBe(0);
    expect(s.misses).toBeGreaterThanOrEqual(1);
  });

  it("registerMiss resets the combo without ending the session", () => {
    const { startSession, tick, hitTarget, registerMiss } = useTrichomeRushStore.getState();
    startSession({ seed: 3, now: 0 });
    tick(COUNTDOWN_MS);
    const t = useTrichomeRushStore.getState().targets[0];
    hitTarget(t.id);
    expect(useTrichomeRushStore.getState().combo).toBe(1);
    registerMiss();
    const s = useTrichomeRushStore.getState();
    expect(s.combo).toBe(0);
    expect(s.misses).toBe(1);
    expect(s.phase).toBe("playing");
  });

  it("tick ends the session at sessionEndsAt, computing a result and clearing targets", () => {
    const { startSession, tick } = useTrichomeRushStore.getState();
    startSession({ seed: 2, now: 0 });
    tick(COUNTDOWN_MS); // -> playing
    tick(COUNTDOWN_MS + SESSION_MS); // -> results
    const s = useTrichomeRushStore.getState();
    expect(s.phase).toBe("results");
    expect(s.targets).toEqual([]);
    expect(s.lastResult).not.toBeNull();
    expect(s.lastResult!.durationMs).toBe(SESSION_MS);
  });

  it("session history caps at MAX_HISTORY and tracks the best score", () => {
    const { startSession, tick } = useTrichomeRushStore.getState();
    for (let i = 0; i < MAX_HISTORY + 3; i++) {
      startSession({ seed: i, now: 0 });
      tick(COUNTDOWN_MS);
      tick(COUNTDOWN_MS + SESSION_MS);
    }
    const s = useTrichomeRushStore.getState();
    expect(s.history.length).toBe(MAX_HISTORY);
    expect(s.bestScore).toBeGreaterThanOrEqual(0);
    expect(s.bestScore).toBe(Math.max(...s.history.map((h) => h.score), s.bestScore));
  });

  it("abortSession returns to idle without recording a result", () => {
    const { startSession, tick, abortSession } = useTrichomeRushStore.getState();
    startSession({ seed: 4, now: 0 });
    tick(COUNTDOWN_MS);
    abortSession();
    const s = useTrichomeRushStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.targets).toEqual([]);
    expect(s.history).toEqual([]);
  });

  it("dismissResults clears lastResult and returns to idle", () => {
    const { startSession, tick, dismissResults } = useTrichomeRushStore.getState();
    startSession({ seed: 6, now: 0 });
    tick(COUNTDOWN_MS);
    tick(COUNTDOWN_MS + SESSION_MS);
    expect(useTrichomeRushStore.getState().phase).toBe("results");
    dismissResults();
    const s = useTrichomeRushStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.lastResult).toBeNull();
  });
});
