import { describe, it, expect } from "vitest";
import { resolveBudPhoto, budPhotoFor, hasAnyBudPhoto, type BudStage } from "@/lib/budPhotos";

const FIX: Record<string, Partial<Record<BudStage, string>>> = {
  "blue-dream": { harvest: "/buds/blue-dream-harvest.webp", flower: "/buds/blue-dream-flower.webp" },
  "og-kush": { flower: "/buds/og-kush-flower.webp" }, // no harvest asset yet
};

describe("resolveBudPhoto", () => {
  it("returns the requested stage when present", () => {
    expect(resolveBudPhoto(FIX, "blue-dream", "harvest")).toBe("/buds/blue-dream-harvest.webp");
    expect(resolveBudPhoto(FIX, "blue-dream", "flower")).toBe("/buds/blue-dream-flower.webp");
  });
  it("falls back to another stage we do have", () => {
    // og-kush has only a flower asset → asking for harvest still resolves to flower.
    expect(resolveBudPhoto(FIX, "og-kush", "harvest")).toBe("/buds/og-kush-flower.webp");
  });
  it("is case/space-insensitive on the key", () => {
    expect(resolveBudPhoto(FIX, "  Blue-Dream  ")).toBe("/buds/blue-dream-harvest.webp");
  });
  it("returns null for unknown / empty keys (3D fallback)", () => {
    expect(resolveBudPhoto(FIX, "does-not-exist")).toBeNull();
    expect(resolveBudPhoto(FIX, null)).toBeNull();
    expect(resolveBudPhoto(FIX, "")).toBeNull();
  });
});

describe("budPhotoFor (live manifest)", () => {
  it("returns null until a licensed asset is registered (currently none)", () => {
    // The shipped manifest is intentionally empty — everything falls back to the 3D
    // bud until we add assets we're allowed to ship. This guards that default.
    expect(budPhotoFor("blue-dream")).toBeNull();
    expect(hasAnyBudPhoto()).toBe(false);
  });
});
