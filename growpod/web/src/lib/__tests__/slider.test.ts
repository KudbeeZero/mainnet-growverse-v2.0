import { describe, it, expect } from "vitest";
import { quantize, nudge } from "@/lib/slider";

describe("quantize", () => {
  it("snaps to the step grid", () => {
    expect(quantize(6.13, 0.05, 4, 9)).toBe(6.15);
    expect(quantize(23.27, 0.1, 10, 40)).toBe(23.3);
  });

  it("clamps to range", () => {
    expect(quantize(3.5, 0.05, 4, 9)).toBe(4);
    expect(quantize(41, 0.1, 10, 40)).toBe(40);
  });

  it("avoids binary float dust", () => {
    // 6.1 + 0.05 in raw JS is 6.150000000000001; quantize must read clean.
    expect(quantize(6.1 + 0.05, 0.05, 4, 9)).toBe(6.15);
  });
});

describe("nudge", () => {
  it("steps up and down by one step", () => {
    expect(nudge(6.15, 1, 0.05, 4, 9)).toBe(6.2);
    expect(nudge(6.15, -1, 0.05, 4, 9)).toBe(6.1);
  });

  it("does not exceed the range edges", () => {
    expect(nudge(40, 1, 0.1, 10, 40)).toBe(40);
    expect(nudge(10, -1, 0.1, 10, 40)).toBe(10);
  });

  it("snaps an off-grid value onto the grid as it nudges", () => {
    // 23.27 + 0.1 = 23.37 → snaps to the nearest 0.1.
    expect(nudge(23.27, 1, 0.1, 10, 40)).toBe(23.4);
  });
});
