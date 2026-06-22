import { describe, expect, it } from "vitest";
import { harvestMarkers, maxPreviewDay, resolvePreview } from "@/lib/chamber/growthPreview";

describe("resolvePreview", () => {
  it("returns the live values verbatim when previewDay is null", () => {
    const v = resolvePreview(null, 12, 60, "vegetative");
    expect(v.previewing).toBe(false);
    expect(v.day).toBe(12);
    expect(v.stage).toBe("vegetative");
  });

  it("previews the scrubbed day and derives its stage", () => {
    const early = resolvePreview(0, 40, 60, "flowering");
    expect(early.previewing).toBe(true);
    expect(early.day).toBe(0);
    expect(early.stage).toBe("seed"); // day 0 is the seed stage regardless of live stage

    const late = resolvePreview(80, 5, 60, "seedling");
    expect(late.previewing).toBe(true);
    expect(late.day).toBe(80);
    // far along the cycle → a late stage, not the live "seedling"
    expect(late.stage).not.toBe("seedling");
  });
});

describe("maxPreviewDay", () => {
  it("covers a full cycle plus a tail and grows with flowering length", () => {
    expect(maxPreviewDay(60)).toBeGreaterThan(60);
    expect(maxPreviewDay(80)).toBeGreaterThan(maxPreviewDay(50));
  });
});

describe("harvestMarkers", () => {
  it("puts the ready window before the harvest day, both within range", () => {
    const m = harvestMarkers(60);
    const max = maxPreviewDay(60);
    expect(m.readyFromDay).toBeGreaterThan(0);
    expect(m.readyFromDay).toBeLessThanOrEqual(m.harvestDay);
    expect(m.harvestDay).toBeLessThanOrEqual(max);
  });

  it("pushes harvest later for a longer-flowering strain", () => {
    expect(harvestMarkers(80).harvestDay).toBeGreaterThan(harvestMarkers(50).harvestDay);
  });
});
