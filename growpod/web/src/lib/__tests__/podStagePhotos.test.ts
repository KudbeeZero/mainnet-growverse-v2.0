import { describe, it, expect } from "vitest";
import { resolvePodPhoto, podPhotoForStage, hasAnyPodPhoto } from "@/lib/podStagePhotos";
import type { GrowthStage } from "@/lib/types";
import { STAGE_ORDER } from "@/lib/stageInfo";

const FIX: Partial<Record<GrowthStage, string>> = {
  seed: "/pod/seed.jpg",
  flowering: "/pod/flowering.jpg",
};

describe("resolvePodPhoto", () => {
  it("returns the still for a mapped stage", () => {
    expect(resolvePodPhoto(FIX, "seed")).toBe("/pod/seed.jpg");
    expect(resolvePodPhoto(FIX, "flowering")).toBe("/pod/flowering.jpg");
  });
  it("returns null for an unmapped stage / empty input (2D fallback)", () => {
    expect(resolvePodPhoto(FIX, "harvest")).toBeNull();
    expect(resolvePodPhoto(FIX, null)).toBeNull();
    expect(resolvePodPhoto(FIX, "")).toBeNull();
  });
});

describe("podPhotoForStage (live manifest)", () => {
  it("covers every real growth stage with a still", () => {
    // The shipped set is a full seed→harvest sequence, so the pod is photoreal at
    // every stage (no 2D fallback in normal play).
    for (const stage of STAGE_ORDER) {
      expect(podPhotoForStage(stage)).toMatch(/^\/pod\/.+\.jpg$/);
    }
    expect(hasAnyPodPhoto()).toBe(true);
  });
  it("returns null for a non-stage string", () => {
    expect(podPhotoForStage("not-a-stage")).toBeNull();
  });
});
