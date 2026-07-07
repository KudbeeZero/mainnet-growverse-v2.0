import { describe, it, expect } from "vitest";
import { ownedConsumableOptions, pickApplyTarget } from "@/lib/consumableAction";
import type { ConsumableItem } from "@/lib/api/store";
import type { Plant } from "@/lib/types";

const item = (over: Partial<ConsumableItem> = {}): ConsumableItem => ({
  key: "cal_mag",
  name: "Cal-Mag",
  cost: 20,
  description: "Corrects deficiency",
  stage_req: null,
  owned: 2,
  ...over,
});

const plant = (over: Partial<Plant> = {}): Plant =>
  ({ growth_stage: "flowering", is_alive: true, harvested: false, ...over } as Plant);

describe("ownedConsumableOptions", () => {
  it("returns [] with no items or no plant", () => {
    expect(ownedConsumableOptions(undefined, plant())).toEqual([]);
    expect(ownedConsumableOptions([item()], null)).toEqual([]);
  });

  it("drops consumables the player doesn't own", () => {
    const out = ownedConsumableOptions([item({ owned: 0 }), item({ key: "b", owned: 1 })], plant());
    expect(out.map((o) => o.key)).toEqual(["b"]);
  });

  it("marks an owned, stage-free consumable applicable", () => {
    const [o] = ownedConsumableOptions([item()], plant());
    expect(o.applicable).toBe(true);
    expect(o.reason).toBe("");
  });

  it("gates a stage_req consumable to its stage", () => {
    const items = [item({ stage_req: "flowering" }), item({ key: "veg_boost", stage_req: "vegetative" })];
    const out = ownedConsumableOptions(items, plant({ growth_stage: "flowering" }));
    expect(out.find((o) => o.key === "cal_mag")!.applicable).toBe(true);
    const veg = out.find((o) => o.key === "veg_boost")!;
    expect(veg.applicable).toBe(false);
    expect(veg.reason).toMatch(/vegetative/i);
  });

  it("blocks everything on a harvested or dead plant, with a reason", () => {
    const harvested = ownedConsumableOptions([item()], plant({ harvested: true }));
    expect(harvested[0].applicable).toBe(false);
    expect(harvested[0].reason).toMatch(/harvest/i);
    const dead = ownedConsumableOptions([item()], plant({ is_alive: false }));
    expect(dead[0].applicable).toBe(false);
    expect(dead[0].reason).toMatch(/survive/i);
  });
});

describe("pickApplyTarget", () => {
  const p = (id: string, over: Partial<Plant> = {}) =>
    ({ id, growth_stage: "flowering", is_alive: true, harvested: false, ...over }) as Plant;

  it("returns undefined with no plants", () => {
    expect(pickApplyTarget(undefined, null)).toBeUndefined();
    expect(pickApplyTarget([], null)).toBeUndefined();
  });

  it("skips harvested/dead plants", () => {
    const plants = [p("a", { harvested: true }), p("b", { is_alive: false }), p("c")];
    expect(pickApplyTarget(plants, null)).toBe("c");
  });

  it("prefers a plant matching stage_req over the first live one", () => {
    const plants = [p("a", { growth_stage: "vegetative" }), p("b", { growth_stage: "flowering" })];
    expect(pickApplyTarget(plants, "flowering")).toBe("b");
  });

  it("falls back to the first live plant when none match stage_req", () => {
    const plants = [p("a", { growth_stage: "vegetative" }), p("b", { growth_stage: "seedling" })];
    expect(pickApplyTarget(plants, "flowering")).toBe("a");
  });

  it("ignores stage_req entirely when the item has none", () => {
    const plants = [p("a", { growth_stage: "vegetative" })];
    expect(pickApplyTarget(plants, null)).toBe("a");
  });
});
