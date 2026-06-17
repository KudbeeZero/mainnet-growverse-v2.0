import { describe, it, expect } from "vitest";
import { silhouetteFor, budColorForStrain } from "../strainVisuals";

describe("silhouetteFor", () => {
  it("returns the authored silhouette for curated strains (by slug or name)", () => {
    const g13 = silhouetteFor("g13", 0.5);
    const byName = silhouetteFor("G13", 0.5);
    expect(g13).toEqual(byName); // name is slugified to the same key
    // G13 is a slim spear: tighter vertical stacking, short top, modest skirt.
    expect(g13.vertStack).toBeGreaterThan(1);
    expect(g13.upperShorten).toBeGreaterThan(0.4);

    // PDP is short + wide + chunky: heavy lateral spread and a fat top.
    const pdp = silhouetteFor("purple-diddy-punch", 0.5);
    expect(pdp.lowerSpread).toBeGreaterThan(g13.lowerSpread);
    expect(pdp.colaScale).toBeGreaterThan(g13.colaScale);
    expect(pdp.branchletFrac).toBeGreaterThan(g13.branchletFrac);

    // Animal Mints is the densest canopy of the three.
    const am = silhouetteFor("animal-mints", 0.5);
    expect(am.nodeDensity).toBeGreaterThan(pdp.nodeDensity);

    // Bud-weight physics knobs (PR #26): G13 is the strong/light spear (stiffest
    // stems, lightest buds → least droop); PDP is the chunky sagger (weakest
    // stems, heaviest buds); Animal Mints sits balanced between them.
    expect(g13.branchStrength).toBeGreaterThan(am.branchStrength);
    expect(am.branchStrength).toBeGreaterThan(pdp.branchStrength);
    expect(pdp.budWeightMul).toBeGreaterThan(am.budWeightMul);
    expect(am.budWeightMul).toBeGreaterThan(g13.budWeightMul);
  });

  it("derives a silhouette from indica dominance for unknown strains", () => {
    const sativa = silhouetteFor("some-unknown-haze", 0);
    const indica = silhouetteFor("some-unknown-kush", 1);
    // Indica trends bushier/wider/denser than sativa.
    expect(indica.nodeDensity).toBeGreaterThan(sativa.nodeDensity);
    expect(indica.lowerSpread).toBeGreaterThan(sativa.lowerSpread);
    expect(indica.colaScale).toBeGreaterThan(sativa.colaScale);
    // Indica has sturdier stems and heavier buds than sativa.
    expect(indica.branchStrength).toBeGreaterThan(sativa.branchStrength);
    expect(indica.budWeightMul).toBeGreaterThan(sativa.budWeightMul);
  });

  it("clamps out-of-range ratios and is deterministic", () => {
    expect(silhouetteFor(undefined, -1)).toEqual(silhouetteFor(undefined, 0));
    expect(silhouetteFor(undefined, 2)).toEqual(silhouetteFor(undefined, 1));
    expect(silhouetteFor(undefined, 0.42)).toEqual(silhouetteFor(undefined, 0.42));
  });
});

describe("budColorForStrain (regression — unchanged by silhouette work)", () => {
  it("returns the authored purple for Purple Diddy Punch", () => {
    const c = budColorForStrain("purple-diddy-punch", 110, 1);
    expect(c.anthocyanin).toBeGreaterThan(0.5);
    expect(c.calyxHue).toBeGreaterThan(255);
  });
});

describe("Launch Strain Integration Pack — authored visuals + identity", () => {
  const LAUNCH = ["white-rhino", "white-fire-og", "gelato", "wedding-cake"] as const;

  it("gives each launch strain an authored silhouette (not the indica-derived default)", () => {
    for (const slug of LAUNCH) {
      expect(silhouetteFor(slug, 0.6), `${slug} silhouette authored`).not.toEqual(silhouetteFor(undefined, 0.6));
    }
  });

  it("carries the PR #26 bud-weight physics knobs on every launch silhouette", () => {
    for (const slug of LAUNCH) {
      const s = silhouetteFor(slug, 0.6);
      expect(s.branchStrength, `${slug} branchStrength`).toBeGreaterThan(0);
      expect(s.budWeightMul, `${slug} budWeightMul`).toBeGreaterThan(0);
    }
    // White Rhino is the heaviest, chunkiest cola (most droop): highest budWeightMul.
    expect(silhouetteFor("white-rhino", 0.6).budWeightMul).toBeGreaterThan(silhouetteFor("white-fire-og", 0.6).budWeightMul);
  });

  it("frosty-WHITE strains carry no anthocyanin (frost, not purple)", () => {
    expect(budColorForStrain("white-rhino", 110, 1).anthocyanin).toBe(0);
    expect(budColorForStrain("white-fire-og", 110, 1).anthocyanin).toBe(0);
  });

  it("purple-dessert strains carry high anthocyanin + a purple accent", () => {
    const gelato = budColorForStrain("gelato", 110, 1);
    expect(gelato.anthocyanin).toBeGreaterThan(0.5);
    expect(gelato.accentHue).toBeGreaterThan(255);

    const weddingCake = budColorForStrain("wedding-cake", 110, 1);
    expect(weddingCake.anthocyanin).toBeGreaterThan(0.4);
    expect(weddingCake.accentHue).toBeGreaterThan(255);
  });
});
