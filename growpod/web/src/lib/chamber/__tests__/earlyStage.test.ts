import { describe, expect, it } from "vitest";
import { earlyStageBoost } from "@/lib/chamber/earlyStage";

describe("earlyStageBoost", () => {
  it("enlarges the youngest stages the most, easing to 1× later", () => {
    expect(earlyStageBoost("seed")).toBeGreaterThan(earlyStageBoost("germination"));
    expect(earlyStageBoost("germination")).toBeGreaterThan(earlyStageBoost("seedling"));
    expect(earlyStageBoost("seedling")).toBeGreaterThan(1);
  });

  it("is a no-op (1×) for vegetative and later stages", () => {
    for (const s of ["vegetative", "flowering", "late_flower", "harvest", "anything"]) {
      expect(earlyStageBoost(s)).toBe(1);
    }
  });
});
