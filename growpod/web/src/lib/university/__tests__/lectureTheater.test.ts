import { describe, it, expect } from "vitest";
import { fmtTime, initials, hueFor, activeCueIndex } from "@/lib/university/lectureTheater";

describe("lecture theater helpers", () => {
  it("formats times as m:ss and guards bad input", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(5)).toBe("0:05");
    expect(fmtTime(72)).toBe("1:12");
    expect(fmtTime(-3)).toBe("0:00");
    expect(fmtTime(NaN)).toBe("0:00");
  });

  it("derives faculty initials, dropping titles", () => {
    expect(initials("Professor Flora")).toBe("F");
    expect(initials("Dr. Vera Lindqvist")).toBe("VL");
    expect(initials("Dr. Sage Harlow")).toBe("SH");
    expect(initials("")).toBe("P"); // graceful default
  });

  it("hueFor is deterministic and in range", () => {
    expect(hueFor("Professor Flora")).toBe(hueFor("Professor Flora"));
    expect(hueFor("Dr. Sage Harlow")).not.toBe(hueFor("Professor Flora"));
    for (const n of ["Professor Flora", "Dr. Petra Nance", "x"]) {
      const h = hueFor(n);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  it("tracks the active caption as time advances (karaoke sync)", () => {
    const cues = [{ start_s: 0 }, { start_s: 5 }, { start_s: 12 }];
    expect(activeCueIndex(cues, 0)).toBe(0);
    expect(activeCueIndex(cues, 4.9)).toBe(0);
    expect(activeCueIndex(cues, 5)).toBe(1);
    expect(activeCueIndex(cues, 20)).toBe(2);
    expect(activeCueIndex([], 3)).toBe(-1);
  });
});
