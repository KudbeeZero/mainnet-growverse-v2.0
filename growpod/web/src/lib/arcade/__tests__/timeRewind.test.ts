import { describe, it, expect, beforeEach } from "vitest";
import { useRewindStore, lerpScalars, MAX_SNAPSHOTS, type Snapshot } from "@/lib/arcade/timeRewind";

function snap(day: number): Omit<Snapshot, "at"> {
  return { budDev: day / 100, ripe: 0, brown: 0, trich: day / 100, purple: 0, day, stage: "flowering" };
}

function reset() {
  useRewindStore.setState({ snapshots: [], override: null, rewindActive: false, _raf: null });
}

describe("lerpScalars", () => {
  it("interpolates each scalar at the midpoint", () => {
    const from = { budDev: 0, ripe: 0, brown: 0, trich: 0, purple: 0 };
    const to = { budDev: 1, ripe: 1, brown: 1, trich: 1, purple: 1 };
    expect(lerpScalars(from, to, 0.5)).toEqual({ budDev: 0.5, ripe: 0.5, brown: 0.5, trich: 0.5, purple: 0.5 });
  });
  it("clamps t outside [0,1]", () => {
    const from = { budDev: 0, ripe: 0, brown: 0, trich: 0, purple: 0 };
    const to = { budDev: 1, ripe: 1, brown: 1, trich: 1, purple: 1 };
    expect(lerpScalars(from, to, 2).budDev).toBe(1);
    expect(lerpScalars(from, to, -1).budDev).toBe(0);
  });
});

describe("rewind snapshot buffer", () => {
  beforeEach(reset);

  it("captures snapshots and reads them back", () => {
    const { captureSnapshot, getSnapshots } = useRewindStore.getState();
    captureSnapshot(snap(10));
    captureSnapshot(snap(20));
    const s = getSnapshots();
    expect(s.length).toBe(2);
    expect(s[0].day).toBe(10);
    expect(s[1].at).toBeTypeOf("number");
  });

  it("is a circular buffer capped at MAX_SNAPSHOTS", () => {
    const { captureSnapshot } = useRewindStore.getState();
    for (let d = 1; d <= MAX_SNAPSHOTS + 5; d++) captureSnapshot(snap(d));
    const s = useRewindStore.getState().snapshots;
    expect(s.length).toBe(MAX_SNAPSHOTS);
    // Oldest five dropped → first retained snapshot is day 6.
    expect(s[0].day).toBe(6);
    expect(s[s.length - 1].day).toBe(MAX_SNAPSHOTS + 5);
  });

  it("rewindTo restores the target scalars (instant when no rAF) and engages rewind", () => {
    const { captureSnapshot, rewindTo } = useRewindStore.getState();
    captureSnapshot(snap(10));
    captureSnapshot(snap(80));
    rewindTo(0, { reducedMotion: true });
    const s = useRewindStore.getState();
    expect(s.rewindActive).toBe(true);
    expect(s.override).toEqual({ budDev: 0.1, ripe: 0, brown: 0, trich: 0.1, purple: 0 });
  });

  it("rewindTo on an invalid index is a no-op", () => {
    const { rewindTo } = useRewindStore.getState();
    rewindTo(99, { reducedMotion: true });
    expect(useRewindStore.getState().override).toBeNull();
  });

  it("exitRewind clears the override and filter", () => {
    const { captureSnapshot, rewindTo, exitRewind } = useRewindStore.getState();
    captureSnapshot(snap(10));
    rewindTo(0, { reducedMotion: true });
    exitRewind();
    const s = useRewindStore.getState();
    expect(s.override).toBeNull();
    expect(s.rewindActive).toBe(false);
  });
});
