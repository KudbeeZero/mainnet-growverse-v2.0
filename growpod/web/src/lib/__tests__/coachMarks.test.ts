import { describe, it, expect } from "vitest";
import {
  DASHBOARD_COACH_MARKS,
  ALL_DISMISSED,
  nextCoachMark,
  remainingCount,
  type CoachMarkDef,
} from "@/lib/coachMarks";

const DEFS: CoachMarkDef[] = [
  { id: "a", target: "a", title: "A", body: "a" },
  { id: "b", target: "b", title: "B", body: "b" },
  { id: "c", target: "c", title: "C", body: "c" },
];

const present = (...t: string[]) => (target: string) => t.includes(target);

describe("DASHBOARD_COACH_MARKS", () => {
  it("has unique ids and non-empty copy", () => {
    const ids = DASHBOARD_COACH_MARKS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of DASHBOARD_COACH_MARKS) {
      expect(m.target.length).toBeGreaterThan(0);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.body.length).toBeGreaterThan(0);
    }
  });
});

describe("nextCoachMark", () => {
  it("returns the first non-dismissed mark whose target is present", () => {
    expect(nextCoachMark(DEFS, [], present("a", "b", "c"))?.id).toBe("a");
  });

  it("skips dismissed marks", () => {
    expect(nextCoachMark(DEFS, ["a"], present("a", "b", "c"))?.id).toBe("b");
    expect(nextCoachMark(DEFS, ["a", "b"], present("a", "b", "c"))?.id).toBe("c");
  });

  it("skips marks whose target is absent from the page", () => {
    // 'a' has no anchor yet → fall through to the first present one.
    expect(nextCoachMark(DEFS, [], present("b", "c"))?.id).toBe("b");
  });

  it("returns null when everything is dismissed", () => {
    expect(nextCoachMark(DEFS, ["a", "b", "c"], present("a", "b", "c"))).toBeNull();
  });

  it("returns null once the whole sequence is skipped", () => {
    expect(nextCoachMark(DEFS, [ALL_DISMISSED], present("a", "b", "c"))).toBeNull();
  });

  it("returns null when no target is present", () => {
    expect(nextCoachMark(DEFS, [], present())).toBeNull();
  });
});

describe("remainingCount", () => {
  it("counts only showable (present, non-dismissed) marks", () => {
    expect(remainingCount(DEFS, [], present("a", "b", "c"))).toBe(3);
    expect(remainingCount(DEFS, ["a"], present("a", "b", "c"))).toBe(2);
    expect(remainingCount(DEFS, [], present("a"))).toBe(1);
  });

  it("is zero when the sequence is skipped", () => {
    expect(remainingCount(DEFS, [ALL_DISMISSED], present("a", "b", "c"))).toBe(0);
  });
});
