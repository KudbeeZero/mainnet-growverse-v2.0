import { describe, it, expect } from "vitest";
import { buildPlantMetadata } from "@/lib/chain/algorand/plantNFT";
import { mintTruthMetadata, nominalGrowDay } from "@/lib/chamber/morphology";
import type { PlantState } from "@/lib/types";

// Regression coverage for the mint-metadata-consistency bug: grow_stage and
// trich_density must always read straight off server state (`plant`), and
// grow_day/bud_dev must always come from whatever the caller passes as
// `opts.growDay`/`opts.budDev` — buildPlantMetadata itself has no way to see
// (and must never see) the chamber's boosted/previewed display values. This
// file locks that contract down so a future edit can't quietly wire
// buildPlantMetadata itself to a client-side "day" derived from Date.now()
// or similar, and separately proves the `mintTruthMetadata` helper the
// chamber page now feeds it stays correct under boost/preview.

function plant(over: Partial<PlantState> = {}): PlantState {
  return {
    id: "plant-1",
    player_id: "player-1",
    pod_id: "pod-1",
    strain_id: "g13",
    growth_stage: "flowering",
    planted_at: "2026-01-01T00:00:00Z",
    height: 40,
    health: 90,
    water_level: 60,
    nutrient_level: 60,
    pest_level: 0,
    disease_level: 0,
    condition_flags: [],
    is_alive: true,
    harvested: false,
    recent_events: [],
    trichomes: {
      active: true,
      density: 0.42,
      head_development: 0.5,
      clear_pct: 50,
      cloudy_pct: 40,
      amber_pct: 10,
      dominant: "cloudy",
      harvest_window: "peak",
      recommendation: "",
    },
    ...over,
  };
}

describe("buildPlantMetadata — server-truth fields", () => {
  it("reads grow_stage and trich_density straight off plant state, ignoring opts entirely", () => {
    const p = plant({ growth_stage: "late_flower" });
    const meta = buildPlantMetadata(p, { growDay: 999, budDev: 0.01 });
    expect(meta.properties.grow_stage).toBe("late_flower");
    expect(meta.properties.trich_density).toBeCloseTo(0.42);
  });

  it("defaults trich_density to 0 when server telemetry is absent (never invents a value)", () => {
    const p = plant({ trichomes: undefined });
    const meta = buildPlantMetadata(p);
    expect(meta.properties.trich_density).toBe(0);
  });

  it("passes grow_day/bud_dev through from opts unchanged — the caller (chamber page) is solely responsible for sourcing them from server truth", () => {
    const p = plant();
    const meta = buildPlantMetadata(p, { growDay: 47, budDev: 0.83 });
    expect(meta.properties.grow_day).toBe(47);
    expect(meta.properties.bud_dev).toBeCloseTo(0.83);
  });

  it("defaults grow_day/bud_dev to 0 when the caller passes nothing (never falls back to a client clock)", () => {
    const p = plant();
    const meta = buildPlantMetadata(p);
    expect(meta.properties.grow_day).toBe(0);
    expect(meta.properties.bud_dev).toBe(0);
  });

  it("end-to-end: feeding mintTruthMetadata's output in keeps grow_day/bud_dev consistent with grow_stage/trich_density (the bug this guards)", () => {
    // A plant that's server-side deep in flowering (so trich_density/grow_stage
    // read as mature), fed the mintTruthMetadata output computed the same way
    // the chamber page now computes it (from liveNominalDay, not a boosted or
    // previewed day).
    const flMid = 60;
    const liveNominalDay = nominalGrowDay("flowering", 80, flMid);
    const truth = mintTruthMetadata(liveNominalDay, flMid);
    const p = plant({
      growth_stage: "flowering",
      trichomes: {
        active: true,
        density: 0.7,
        head_development: 0.6,
        clear_pct: 20,
        cloudy_pct: 60,
        amber_pct: 20,
        dominant: "cloudy",
        harvest_window: "peak",
        recommendation: "",
      },
    });

    const meta = buildPlantMetadata(p, { growDay: truth.growDay, budDev: truth.budDev });

    // grow_day/bud_dev must land in the same mature ballpark as the
    // server-truth grow_stage/trich_density — not near zero (which is what a
    // pre-flower boosted/previewed leak or a missing-opts default would give).
    expect(meta.properties.grow_stage).toBe("flowering");
    expect(meta.properties.grow_day).toBeGreaterThan(44); // past VEG_END
    expect(meta.properties.bud_dev).toBeGreaterThan(0);
    expect(meta.properties.trich_density).toBeCloseTo(0.7);
  });
});
