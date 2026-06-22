import { describe, expect, it } from "vitest";
import { nextAction, recommendedActionKey } from "@/lib/nextAction";
import type { PlantState } from "@/lib/types";

// nextAction only reads a handful of fields; build minimal fixtures.
function plant(over: Partial<PlantState>): PlantState {
  return {
    is_alive: true,
    harvested: false,
    growth_stage: "vegetative",
    water_level: 80,
    nutrient_level: 80,
    condition_flags: [],
    ...over,
  } as PlantState;
}

describe("nextAction", () => {
  it("returns null for a healthy, well-stocked plant", () => {
    expect(nextAction(plant({}))).toBeNull();
  });

  it("returns null for dead or harvested plants", () => {
    expect(nextAction(plant({ is_alive: false }))).toBeNull();
    expect(nextAction(plant({ harvested: true }))).toBeNull();
  });

  it("prioritises harvest readiness above everything", () => {
    const a = nextAction(
      plant({ water_level: 5, forecast: { is_harvest_ready: true } as PlantState["forecast"] }),
    );
    expect(a?.kind).toBe("harvest");
  });

  it("recommends water when thirsty / low, feed when nutrients are low", () => {
    expect(nextAction(plant({ condition_flags: [{ condition: "wilting" } as never] }))?.kind).toBe("water");
    expect(nextAction(plant({ water_level: 12 }))?.kind).toBe("water");
    expect(nextAction(plant({ nutrient_level: 10 }))?.kind).toBe("feed");
  });

  it("never tells you to feed during seed/germination", () => {
    expect(nextAction(plant({ growth_stage: "seed", nutrient_level: 5 }))).toBeNull();
    expect(nextAction(plant({ growth_stage: "germination", nutrient_level: 5 }))).toBeNull();
  });

  it("maps nutrient burn to flush and overwatering to easing off", () => {
    expect(nextAction(plant({ condition_flags: [{ condition: "nutrient_burn" } as never] }))?.kind).toBe("flush");
    expect(nextAction(plant({ condition_flags: [{ condition: "overwatered" } as never] }))?.kind).toBe("ease_water");
  });
});

describe("recommendedActionKey", () => {
  it("maps to a care-bar button key", () => {
    expect(recommendedActionKey(plant({ water_level: 10 }))).toBe("water");
    expect(recommendedActionKey(plant({ nutrient_level: 10 }))).toBe("feed");
    expect(recommendedActionKey(plant({ condition_flags: [{ condition: "nutrient_burn" } as never] }))).toBe("water"); // flush
  });

  it("is null when healthy or when no single button maps (harvest)", () => {
    expect(recommendedActionKey(plant({}))).toBeNull();
    expect(
      recommendedActionKey(plant({ forecast: { is_harvest_ready: true } as PlantState["forecast"] })),
    ).toBeNull();
  });
});
