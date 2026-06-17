import { describe, it, expect } from "vitest";
import { nextPlantAction } from "@/lib/plantAction";
import type { Plant, Pod } from "@/lib/types";

function plant(over: Partial<Plant> = {}): Plant {
  return {
    id: "plant-1",
    player_id: "p1",
    pod_id: "pod-1",
    strain_id: "s1",
    growth_stage: "vegetative",
    planted_at: "2026-06-14T00:00:00Z",
    height: 10,
    health: 90,
    water_level: 80,
    nutrient_level: 80,
    pest_level: 0,
    disease_level: 0,
    condition_flags: [],
    is_alive: true,
    harvested: false,
    ...over,
  };
}

const podSet = { temperature: 24 } as Pick<Pod, "temperature">;
const podUnset = { temperature: null } as Pick<Pod, "temperature">;

describe("nextPlantAction", () => {
  it("returns a calm, button-less status for a harvested plant", () => {
    const a = nextPlantAction(plant({ harvested: true }));
    expect(a.kind).toBe("none");
    expect(a.urgency).toBe("calm");
  });

  it("returns a calm status for a dead plant", () => {
    expect(nextPlantAction(plant({ is_alive: false })).kind).toBe("none");
  });

  it("prioritises harvest above everything when ripe", () => {
    const a = nextPlantAction(plant({ growth_stage: "harvest", water_level: 0, pest_level: 99 }));
    expect(a.kind).toBe("harvest");
    expect(a.urgency).toBe("critical");
  });

  it("treats disease before pests before resources", () => {
    const a = nextPlantAction(plant({ disease_level: 60, pest_level: 60, water_level: 0 }));
    expect(a.kind).toBe("treatDisease");
    expect(a.urgency).toBe("critical");
  });

  it("escalates threat urgency by level", () => {
    expect(nextPlantAction(plant({ pest_level: 30 })).urgency).toBe("due");
    expect(nextPlantAction(plant({ pest_level: 70 })).urgency).toBe("critical");
  });

  it("ignores trivial threat levels at or below the present threshold", () => {
    expect(nextPlantAction(plant({ pest_level: 20, disease_level: 20 })).kind).toBe("none");
  });

  it("flags critically low water and nutrients", () => {
    expect(nextPlantAction(plant({ water_level: 10 }))).toMatchObject({
      kind: "water",
      urgency: "critical",
    });
    expect(nextPlantAction(plant({ water_level: 80, nutrient_level: 10 }))).toMatchObject({
      kind: "feed",
      urgency: "critical",
    });
  });

  it("surfaces a climate nudge only when the pod is known and unset", () => {
    expect(nextPlantAction(plant(), podUnset).kind).toBe("setClimate");
    expect(nextPlantAction(plant(), podSet).kind).toBe("none");
    // No pod → no climate nudge.
    expect(nextPlantAction(plant()).kind).toBe("none");
  });

  it("ranks critical resources above the climate nudge", () => {
    expect(nextPlantAction(plant({ water_level: 5 }), podUnset).kind).toBe("water");
  });

  it("gives gentle top-up nudges before things turn critical", () => {
    expect(nextPlantAction(plant({ water_level: 40 }), podSet)).toMatchObject({
      kind: "water",
      urgency: "due",
    });
    expect(nextPlantAction(plant({ nutrient_level: 40 }), podSet)).toMatchObject({
      kind: "feed",
      urgency: "due",
    });
  });

  it("reports thriving when all vitals are healthy", () => {
    const a = nextPlantAction(plant(), podSet);
    expect(a.kind).toBe("none");
    expect(a.reason).toMatch(/growing/i);
  });
});
