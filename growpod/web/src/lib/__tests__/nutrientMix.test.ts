import { describe, expect, it } from "vitest";
import { STAGE_ORDER } from "@/lib/stageInfo";
import { LEVEL_LABEL, nutrientMix } from "@/lib/nutrientMix";

describe("nutrientMix", () => {
  it("gives a mix for every growth stage with labelled levels", () => {
    for (const stage of STAGE_ORDER) {
      const mix = nutrientMix(stage);
      expect(mix.micros.length, stage).toBeGreaterThan(0);
      expect(mix.note.length, stage).toBeGreaterThan(0);
      for (const v of [mix.npk.n, mix.npk.p, mix.npk.k]) {
        expect(LEVEL_LABEL[v], stage).toBeTypeOf("string");
      }
    }
  });

  it("is nitrogen-forward in veg and phosphorus/potassium-forward in flower", () => {
    const veg = nutrientMix("vegetative").npk;
    expect(veg.n).toBeGreaterThan(veg.p);
    expect(veg.n).toBeGreaterThan(veg.k);

    const flower = nutrientMix("flowering").npk;
    expect(flower.p).toBeGreaterThan(flower.n);
    expect(flower.k).toBeGreaterThan(flower.n);
  });

  it("feeds nothing at seed and harvest (flushed)", () => {
    for (const stage of ["seed", "harvest"] as const) {
      const { n, p, k } = nutrientMix(stage).npk;
      expect(n + p + k, stage).toBe(0);
    }
  });
});
