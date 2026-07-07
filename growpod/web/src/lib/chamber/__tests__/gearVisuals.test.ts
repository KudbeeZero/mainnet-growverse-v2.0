import { describe, it, expect } from "vitest";
import {
  equippedOfCategory,
  fanVisualIntensity,
  soilTint,
  lightGlowIntensity,
  gearChips,
} from "@/lib/chamber/gearVisuals";
import type { PodEquippedGear } from "@/lib/types";

const FAN: PodEquippedGear = { gear_key: "inline_exhaust_6in", category: "fan", name: "6\" Inline Exhaust" };
const SOIL: PodEquippedGear = { gear_key: "coco_coir", category: "soil", name: "Coco Coir Brick" };
const LIGHT: PodEquippedGear = { gear_key: "led_700w", category: "light", name: "CanopyMax 700W LED" };

describe("equippedOfCategory", () => {
  it("finds the equipped item of a category", () => {
    expect(equippedOfCategory([FAN, SOIL], "fan")).toBe(FAN);
    expect(equippedOfCategory([FAN, SOIL], "soil")).toBe(SOIL);
  });

  it("returns undefined when nothing of that category is equipped", () => {
    expect(equippedOfCategory([FAN], "soil")).toBeUndefined();
    expect(equippedOfCategory(undefined, "fan")).toBeUndefined();
    expect(equippedOfCategory([], "fan")).toBeUndefined();
  });
});

describe("fanVisualIntensity", () => {
  it("uses the low ambient baseline with no fan equipped (S4 — was hardcoded 45 always)", () => {
    expect(fanVisualIntensity([])).toBe(10);
    expect(fanVisualIntensity([SOIL, LIGHT])).toBe(10);
  });

  it("ranks fans by real airflow character", () => {
    const clip = fanVisualIntensity([{ gear_key: "clip_fan", category: "fan", name: "Clip" }]);
    const osc = fanVisualIntensity([{ gear_key: "oscillating_fan", category: "fan", name: "Osc" }]);
    const exhaust = fanVisualIntensity([FAN]);
    expect(clip).toBeLessThan(osc);
    expect(osc).toBeLessThan(exhaust);
  });

  it("falls back to the baseline for an unrecognized fan key", () => {
    expect(fanVisualIntensity([{ gear_key: "mystery_fan", category: "fan", name: "?" }])).toBe(10);
  });
});

describe("soilTint", () => {
  it("returns the default substrate tint with no soil equipped", () => {
    expect(soilTint([FAN, LIGHT])).toBe("#241a12");
    expect(soilTint([])).toBe("#241a12");
  });

  it("returns a distinct tint per soil SKU", () => {
    const coco = soilTint([SOIL]);
    const worm = soilTint([{ gear_key: "worm_castings", category: "soil", name: "Worm Castings" }]);
    expect(coco).not.toBe(worm);
    expect(coco).toBe("#8a5a34");
  });
});

describe("lightGlowIntensity", () => {
  it("clamps within [0.15, 1]", () => {
    expect(lightGlowIntensity(0)).toBe(0.15);
    expect(lightGlowIntensity(2000)).toBe(1);
  });

  it("scales with PPFD", () => {
    expect(lightGlowIntensity(300)).toBeLessThan(lightGlowIntensity(900));
  });

  it("defaults to the unsensored mid-band value", () => {
    expect(lightGlowIntensity(null)).toBe(lightGlowIntensity(600));
    expect(lightGlowIntensity(undefined)).toBe(lightGlowIntensity(600));
  });
});

describe("gearChips", () => {
  it("returns one chip per equipped item with the right icon", () => {
    const chips = gearChips([FAN, SOIL, LIGHT]);
    expect(chips).toHaveLength(3);
    expect(chips.find((c) => c.key === "inline_exhaust_6in")?.icon).toBe("💨");
    expect(chips.find((c) => c.key === "coco_coir")?.icon).toBe("🌱");
    expect(chips.find((c) => c.key === "led_700w")?.icon).toBe("💡");
  });

  it("returns an empty list with nothing equipped", () => {
    expect(gearChips([])).toEqual([]);
    expect(gearChips(undefined)).toEqual([]);
  });
});
