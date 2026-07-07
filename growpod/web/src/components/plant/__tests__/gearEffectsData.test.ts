import { describe, it, expect } from "vitest";
import { formatGearEffects } from "@/components/plant/gearEffectsData";

describe("formatGearEffects", () => {
  it("returns nothing for gear with no effects (lights)", () => {
    expect(formatGearEffects(undefined)).toEqual([]);
    expect(formatGearEffects({})).toEqual([]);
  });

  it("previews a fan's pest/disease reduction and humidity offset", () => {
    const lines = formatGearEffects({
      pest_spawn_mult: 0.75,
      disease_growth_mult: 0.60,
      humidity_offset_pct: -8,
      temp_offset_c: -2,
    });
    expect(lines).toContain("-25% pest risk");
    expect(lines).toContain("-40% mildew growth");
    expect(lines).toContain("-8% humidity");
    expect(lines).toContain("-2°C");
  });

  it("previews the coco-coir water/nutrient tradeoff with opposite signs", () => {
    const lines = formatGearEffects({
      water_decay_mult: 0.85,
      nutrient_decay_mult: 1.15,
    });
    expect(lines).toContain("-15% water use");
    expect(lines).toContain("+15% nutrient use");
  });

  it("previews a flat flowering quality bonus", () => {
    expect(formatGearEffects({ flowering_quality_bonus: 2 })).toContain(
      "+2 quality (flowering)"
    );
  });

  it("omits neutral (1.0 / 0) fields", () => {
    const lines = formatGearEffects({
      pest_spawn_mult: 1,
      disease_growth_mult: 1,
      humidity_offset_pct: 0,
      temp_offset_c: 0,
      water_decay_mult: 1,
      nutrient_decay_mult: 1,
      flowering_quality_bonus: 0,
    });
    expect(lines).toEqual([]);
  });
});
