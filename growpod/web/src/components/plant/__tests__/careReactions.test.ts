import { describe, it, expect, vi, afterEach } from "vitest";
import {
  CARE_REACTIONS,
  CARE_REACTION_EVENT,
  dispatchCareReaction,
  type ReactionKind,
} from "@/components/plant/careReactionsData";
import { CARE_FX } from "@/components/plant/careFeedbackData";

describe("CARE_REACTIONS", () => {
  it("maps every care kind plus inspect", () => {
    const kinds = [...Object.keys(CARE_FX), "inspect"].sort();
    expect(Object.keys(CARE_REACTIONS).sort()).toEqual(kinds);
  });

  it("targets the owner-specified zones and motions", () => {
    // Owner spec: water → root zone, feed → stem, prune → trim/sparkle,
    // train → branch guide, inspect → scanner sweep.
    expect(CARE_REACTIONS.water).toMatchObject({ zone: "roots", motion: "pulse" });
    expect(CARE_REACTIONS.feed).toMatchObject({ zone: "stem", motion: "rise" });
    expect(CARE_REACTIONS.prune).toMatchObject({ zone: "canopy", motion: "sparkle" });
    expect(CARE_REACTIONS.train).toMatchObject({ zone: "canopy", motion: "guide" });
    expect(CARE_REACTIONS.inspect).toMatchObject({ zone: "full", motion: "sweep" });
  });

  it("every reaction has a positive duration, rgba tint and a label", () => {
    for (const r of Object.values(CARE_REACTIONS)) {
      expect(r.dur).toBeGreaterThan(0);
      expect(r.tint).toMatch(/^rgba\(/);
      expect(r.label.length).toBeGreaterThan(3);
    }
  });
});

describe("dispatchCareReaction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is a safe no-op without a window (SSR)", () => {
    expect(() => dispatchCareReaction("water")).not.toThrow();
  });

  it("dispatches a CustomEvent carrying the kind", () => {
    const dispatched: CustomEvent<ReactionKind>[] = [];
    class FakeCustomEvent<T> {
      type: string;
      detail: T;
      constructor(type: string, init?: { detail: T }) {
        this.type = type;
        this.detail = init?.detail as T;
      }
    }
    vi.stubGlobal("CustomEvent", FakeCustomEvent);
    vi.stubGlobal("window", { dispatchEvent: (e: CustomEvent<ReactionKind>) => dispatched.push(e) });

    dispatchCareReaction("water");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe(CARE_REACTION_EVENT);
    expect(dispatched[0].detail).toBe("water");
  });
});
