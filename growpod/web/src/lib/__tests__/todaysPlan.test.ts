import { describe, it, expect } from "vitest";
import { buildTodaysPlan } from "@/lib/todaysPlan";
import { careAvailability } from "@/lib/careAvailability";
import type { Plant } from "@/lib/types";

function plant(over: Partial<Plant> = {}): Plant {
  return {
    id: "p", player_id: "pl", pod_id: "pod", strain_id: "s",
    growth_stage: "vegetative", planted_at: "2026-06-14T00:00:00Z",
    height: 10, health: 90, water_level: 80, nutrient_level: 80,
    pest_level: 0, disease_level: 0, condition_flags: [],
    is_alive: true, harvested: false, ...over,
  };
}
const planFor = (p: Plant, h?: number | null) => buildTodaysPlan(p, careAvailability(p, []), h);

describe("buildTodaysPlan", () => {
  it("ranks harvest first when harvest-ready", () => {
    const plan = planFor(plant({ growth_stage: "harvest", water_level: 20 }));
    expect(plan[0]).toMatchObject({ kind: "harvest", urgency: "now" });
  });

  it("marks low water/nutrients Do-Now under 35, Soon under 60", () => {
    const p1 = planFor(plant({ water_level: 20, nutrient_level: 50 }));
    expect(p1.find((e) => e.kind === "water")?.urgency).toBe("now");
    expect(p1.find((e) => e.kind === "feed")?.urgency).toBe("soon");
  });

  it("surfaces treatments only under active pressure", () => {
    expect(planFor(plant()).some((e) => e.kind === "treatPests")).toBe(false);
    expect(planFor(plant({ pest_level: 15 }))[0]).toMatchObject({ kind: "treatPests", urgency: "now" });
  });

  it("includes an upcoming harvest-review row from the forecast", () => {
    const plan = planFor(plant({ water_level: 100, nutrient_level: 100 }), 36);
    const row = plan.find((e) => e.title === "Harvest review");
    expect(row).toMatchObject({ kind: null, urgency: "upcoming" });
    expect(row!.why).toMatch(/1d 12h/);
  });

  it("is empty for dead or harvested plants, and caps at 3 rows sorted by urgency", () => {
    expect(planFor(plant({ is_alive: false, water_level: 5 }))).toEqual([]);
    const busy = planFor(plant({ water_level: 10, nutrient_level: 10, pest_level: 9, disease_level: 9 }), 40);
    expect(busy.length).toBeLessThanOrEqual(3);
    const ranks = busy.map((e) => ({ now: 0, soon: 1, upcoming: 2 })[e.urgency]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});
