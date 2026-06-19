import { describe, it, expect } from "vitest";
import {
  buildPacketsForPlant,
  buildStagePacket,
  buildMetricsPacket,
  classifyLevel,
  classifyPressure,
  worst,
} from "@/lib/mission/packets";
import { buildWiringRows, wiringSummary, type WiringSignals } from "@/lib/mission/wiring";
import type { PlantState, StageForecast } from "@/lib/types";

const NOW = "2026-06-19T18:00:00.000Z";

function forecast(over: Partial<StageForecast> = {}): StageForecast {
  return {
    stage: "germination",
    stage_index: 1,
    stage_count: 7,
    age_hours: 24,
    hours_in_stage: 24,
    next_stage: "seedling",
    stage_progress_pct: 20,
    stage_base_hours: 120,
    stage_total_hours: 132,
    next_stage_eta: "2026-06-23T18:00:00.000Z",
    hours_to_harvest: 2000,
    harvest_eta: "2026-09-01T00:00:00.000Z",
    is_harvest_ready: false,
    ...over,
  };
}

function plant(over: Partial<PlantState> = {}): PlantState {
  return {
    id: "plant-123456789",
    player_id: "p1",
    pod_id: "pod1",
    strain_id: "s1",
    growth_stage: "germination",
    planted_at: "2026-06-18T18:00:00.000Z",
    height: 2,
    health: 90,
    water_level: 70,
    nutrient_level: 60,
    pest_level: 0,
    disease_level: 0,
    condition_flags: [],
    is_alive: true,
    harvested: false,
    forecast: forecast(),
    recent_events: [],
    ...over,
  };
}

describe("classification helpers", () => {
  it("classifyLevel: higher is better", () => {
    expect(classifyLevel(80)).toBe("good");
    expect(classifyLevel(30)).toBe("watch");
    expect(classifyLevel(10)).toBe("alert");
  });
  it("classifyPressure: higher is worse", () => {
    expect(classifyPressure(0)).toBe("good");
    expect(classifyPressure(30)).toBe("watch");
    expect(classifyPressure(70)).toBe("alert");
  });
  it("worst combines to the most urgent", () => {
    expect(worst("good", "alert")).toBe("alert");
    expect(worst("watch", "good")).toBe("watch");
  });
});

describe("germination stage packet", () => {
  it("uses the germination-watch framing with real forecast data", () => {
    const p = buildStagePacket(plant(), NOW);
    expect(p.kind).toBe("stage");
    expect(p.title).toBe("Germination Packet");
    expect(p.lines[0]).toBe("Germination watch started.");
    expect(p.lines.some((l) => l.includes("day 2 of ~5-day window"))).toBe(true);
    expect(p.lines).toContain("Moisture stable.");
    expect(p.lines).toContain("Nutrients in range.");
    expect(p.health).toBe("good");
    expect(p.actionNeeded).toBe(false);
  });

  it("flags an alert when moisture is critically low", () => {
    const p = buildStagePacket(plant({ water_level: 5 }), NOW);
    expect(p.health).toBe("alert");
    expect(p.actionNeeded).toBe(true);
    expect(p.lines.some((l) => l.includes("Moisture LOW"))).toBe(true);
  });
});

describe("metrics packet honesty", () => {
  it("is 'unknown' when no metrics are reported (no fake green)", () => {
    const p = buildMetricsPacket(plant({ metrics: undefined }), NOW);
    expect(p.health).toBe("unknown");
    expect(p.actionNeeded).toBe(false);
  });
  it("passes the environment check when VPD/PPFD are in the reference band", () => {
    const p = buildMetricsPacket(
      plant({ metrics: { vpd_kpa: 1.0, ppfd: 600, dli_mol: 30, photoperiod_hours: 18 } }),
      NOW,
    );
    expect(p.health).toBe("good");
    expect(p.summary).toBe("Environment check passed.");
  });
});

describe("buildPacketsForPlant", () => {
  it("returns stage + vitals + metrics, plus an event packet when events exist", () => {
    const withEvent = plant({
      recent_events: [
        { id: "e1", plant_id: "plant-123456789", timestamp: NOW, event_type: "stage_change", severity: "mild", payload: null },
      ],
    });
    const packets = buildPacketsForPlant(withEvent, NOW);
    expect(packets.map((p) => p.kind)).toEqual(["stage", "vitals", "metrics", "event"]);
  });
});

describe("wiring map honesty", () => {
  const signals: WiringSignals = {
    plantConnected: true,
    forecastConnected: true,
    metricsConnected: false,
    eventsConnected: false,
    flagsReachable: true,
    healthReachable: null,
    qaSpeedReadable: true,
  };

  it("never fakes green for PR/deploy/staking", () => {
    const rows = buildWiringRows(signals);
    const byName = Object.fromEntries(rows.map((r) => [r.system, r.status]));
    expect(byName["PR feed (GitHub)"]).toBe("not-wired");
    expect(byName["Deploy feed"]).toBe("not-wired");
    expect(byName["Staking"]).toBe("intentional");
    expect(byName["Plant state"]).toBe("connected");
  });

  it("marks health unavailable (not green) when the probe fails", () => {
    const rows = buildWiringRows({ ...signals, healthReachable: false });
    const health = rows.find((r) => r.system.startsWith("Backend health"));
    expect(health?.status).toBe("unavailable");
  });

  it("summary counts add up to the number of rows", () => {
    const rows = buildWiringRows(signals);
    const sum = wiringSummary(rows);
    const total = Object.values(sum).reduce((a, b) => a + b, 0);
    expect(total).toBe(rows.length);
  });
});
