import { describe, expect, it } from "vitest";
import { VITAL_BAR, VITAL_TEXT, vitalSeverity } from "@/lib/vitals";

describe("vitalSeverity", () => {
  it("bands the level good / low / critical", () => {
    expect(vitalSeverity(80)).toBe(0);
    expect(vitalSeverity(50)).toBe(0);
    expect(vitalSeverity(40)).toBe(1);
    expect(vitalSeverity(25)).toBe(1);
    expect(vitalSeverity(10)).toBe(2);
    expect(vitalSeverity(0)).toBe(2);
  });

  it("has a colour for every severity", () => {
    for (const sev of [0, 1, 2] as const) {
      expect(VITAL_BAR[sev]).toBeTruthy();
      expect(VITAL_TEXT[sev]).toBeTruthy();
    }
  });
});
