import { describe, it, expect } from "vitest";
import { growConsoleRows } from "@/components/plant/growConsoleData";
import type { PlantState, Pod } from "@/lib/types";

// Minimal fixtures — the console logic only reads metrics, growth_stage and the
// pod's ph_level, so we cast partial objects rather than build full entities.
function plant(over: Partial<PlantState> & { metrics?: PlantState["metrics"] }): PlantState {
  return {
    growth_stage: "flowering",
    metrics: { vpd_kpa: 1.2, dli_mol: 30, ppfd: 600, photoperiod_hours: 18 },
    ...over,
  } as unknown as PlantState;
}

const pod = (ph: number | null): Pod => ({ ph_level: ph } as unknown as Pod);

function row(rows: ReturnType<typeof growConsoleRows>, key: string) {
  const r = rows.find((x) => x.key === key);
  if (!r) throw new Error(`row ${key} missing`);
  return r;
}

describe("growConsoleRows — nutrient PPM vs per-stage target", () => {
  it("marks PPM in-band when inside the flowering window (700–1000)", () => {
    const rows = growConsoleRows(
      plant({ growth_stage: "flowering", metrics: { vpd_kpa: 1.2, dli_mol: 30, ppfd: 600, photoperiod_hours: 18, nutrient_ppm: 850, stage_targets: [700, 1000] } }),
    );
    const ppm = row(rows, "ppm");
    expect(ppm.value).toBe(850);
    expect(ppm.band.optimal).toEqual([700, 1000]);
    expect(ppm.severity).toBe(0); // IN RANGE
  });

  it("marks PPM out-of-band when below the flowering window", () => {
    const rows = growConsoleRows(
      plant({ growth_stage: "flowering", metrics: { vpd_kpa: 1.2, dli_mol: 30, ppfd: 600, photoperiod_hours: 18, nutrient_ppm: 300, stage_targets: [700, 1000] } }),
    );
    expect(row(rows, "ppm").severity).not.toBe(0); // out of band (1 or 2)
  });

  it("uses the seedling window so the same PPM flips in/out by stage", () => {
    // 300 ppm: in-band for seedling (100–400), out-of-band for flowering.
    const seedling = growConsoleRows(
      plant({ growth_stage: "seedling", metrics: { vpd_kpa: 1.2, dli_mol: 30, ppfd: 600, photoperiod_hours: 18, nutrient_ppm: 300, stage_targets: [100, 400] } }),
    );
    expect(row(seedling, "ppm").severity).toBe(0);
  });

  it("uses the late_flower window (500–700) — the formerly inert band, now live", () => {
    // 600 ppm: in-band for late_flower (500–700), out-of-band for flowering (700–1000).
    const late = growConsoleRows(
      plant({ growth_stage: "late_flower", metrics: { vpd_kpa: 1.2, dli_mol: 30, ppfd: 600, photoperiod_hours: 18, nutrient_ppm: 600, stage_targets: [500, 700] } }),
    );
    expect(row(late, "ppm").band.optimal).toEqual([500, 700]);
    expect(row(late, "ppm").severity).toBe(0);
    const flowering = growConsoleRows(
      plant({ growth_stage: "flowering", metrics: { vpd_kpa: 1.2, dli_mol: 30, ppfd: 600, photoperiod_hours: 18, nutrient_ppm: 600, stage_targets: [700, 1000] } }),
    );
    expect(row(flowering, "ppm").severity).not.toBe(0);
  });

  it("reports no PPM verdict when the stage has no target band", () => {
    const rows = growConsoleRows(
      plant({ growth_stage: "seed", metrics: { vpd_kpa: 1.2, dli_mol: 30, ppfd: 600, photoperiod_hours: 18, nutrient_ppm: 720, stage_targets: null } }),
    );
    const ppm = row(rows, "ppm");
    expect(ppm.severity).toBeNull();
    expect(ppm.note).toBeTruthy();
  });
});

describe("growConsoleRows — environment metrics", () => {
  it("derives VPD / DLI / PPFD severity from the live metrics", () => {
    const rows = growConsoleRows(
      plant({ metrics: { vpd_kpa: 1.2, dli_mol: 30, ppfd: 600, photoperiod_hours: 18 } }),
    );
    expect(row(rows, "vpd").severity).toBe(0); // 0.8–1.6
    expect(row(rows, "dli").severity).toBe(0); // 20–45
    expect(row(rows, "ppfd").severity).toBe(0); // 300–900
  });

  it("reads pH from the pod setpoint and flags an out-of-band value", () => {
    const rows = growConsoleRows(plant({}), pod(8.5)); // optimal 6–7
    expect(row(rows, "ph").value).toBe(8.5);
    expect(row(rows, "ph").severity).not.toBe(0);
  });

  it("shows a null value (no verdict) when a metric is missing", () => {
    const rows = growConsoleRows(plant({ metrics: undefined }), pod(null));
    expect(row(rows, "vpd").value).toBeNull();
    expect(row(rows, "vpd").severity).toBeNull();
    expect(row(rows, "ph").value).toBeNull();
  });
});
