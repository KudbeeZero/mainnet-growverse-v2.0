import { computeRarity, type RarityInputs } from "../rarity";

const BASE: RarityInputs = {
  positiveEvents: 0,
  hasMutationEvent: false,
  tendActions: 0,
  trichomeWaited: false,
  perfectPh: false,
  biome: null,
};

describe("computeRarity (Manual Section 5)", () => {
  it("is common for a standard grow with no story events", () => {
    expect(computeRarity(BASE)).toBe("common");
  });

  it("is uncommon with 1+ positive story events", () => {
    expect(computeRarity({ ...BASE, positiveEvents: 1 })).toBe("uncommon");
    expect(computeRarity({ ...BASE, positiveEvents: 3 })).toBe("uncommon");
  });

  it("is rare for a mutation event plus 3+ tend actions", () => {
    expect(
      computeRarity({
        ...BASE,
        positiveEvents: 1,
        hasMutationEvent: true,
        tendActions: 3,
      }),
    ).toBe("rare");
  });

  it("does not reach rare with a mutation but fewer than 3 tends", () => {
    expect(
      computeRarity({
        ...BASE,
        positiveEvents: 1,
        hasMutationEvent: true,
        tendActions: 2,
      }),
    ).toBe("uncommon");
  });

  it("is legendary with mutation + trichome wait + perfect pH", () => {
    expect(
      computeRarity({
        ...BASE,
        positiveEvents: 2,
        hasMutationEvent: true,
        tendActions: 5,
        trichomeWaited: true,
        perfectPh: true,
      }),
    ).toBe("legendary");
  });

  it("is mythic when all Legendary reqs are met on a volcanic plot", () => {
    expect(
      computeRarity({
        ...BASE,
        positiveEvents: 2,
        hasMutationEvent: true,
        tendActions: 5,
        trichomeWaited: true,
        perfectPh: true,
        biome: "volcanic",
      }),
    ).toBe("mythic");
  });

  it("volcanic biome alone does not grant mythic without the Legendary reqs", () => {
    expect(computeRarity({ ...BASE, positiveEvents: 1, biome: "volcanic" })).toBe(
      "uncommon",
    );
  });

  it("requires perfect pH for legendary (missing pH drops to rare)", () => {
    expect(
      computeRarity({
        ...BASE,
        positiveEvents: 2,
        hasMutationEvent: true,
        tendActions: 5,
        trichomeWaited: true,
        perfectPh: false,
      }),
    ).toBe("rare");
  });
});
