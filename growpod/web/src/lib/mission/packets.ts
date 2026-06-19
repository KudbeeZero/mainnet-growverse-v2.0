// Mission Control v0 — pure packet logic.
//
// Turns REAL, already-readable plant data (PlantState from GET .../state) into
// "mission packets": small status objects the board renders as smart cards.
// This module is pure + deterministic (no fetch, no React) so it is unit-tested.
//
// Reference bands below are documented constants mirroring the backend tuning
// (data/balance.yaml `simulation:`) — VPD [0.8,1.6] kPa, PPFD [300,900]. The web
// does not yet receive the live bands, so these are labeled "reference" in the UI
// and must not be presented as authoritative engine output.

import type { PlantState } from "@/lib/types";
import { STAGE_INFO } from "@/lib/stageInfo";

export type PacketHealth = "good" | "watch" | "alert" | "unknown";

export interface MissionPacket {
  /** Stable id (plant id + kind) so React keys are stable across polls. */
  id: string;
  title: string;
  /** Which real system/data fed this packet (shown for transparency). */
  source: string;
  kind: "stage" | "vitals" | "metrics" | "event";
  health: PacketHealth;
  summary: string;
  /** Status lines, already plain-English. */
  lines: string[];
  /** ISO instant the packet was assembled (client now). */
  timestamp: string;
  /** Human "next review" hint, when derivable. */
  nextCheckpoint?: string;
  actionNeeded: boolean;
}

// ── Reference bands (documented; not the live engine bands) ──────────────────
export const REFERENCE_BANDS = {
  vpd_kpa: [0.8, 1.6] as const,
  ppfd: [300, 900] as const,
};

/** Worst-of combiner so a packet reflects its most urgent line. */
export function worst(a: PacketHealth, b: PacketHealth): PacketHealth {
  const rank: Record<PacketHealth, number> = { good: 0, unknown: 1, watch: 2, alert: 3 };
  return rank[a] >= rank[b] ? a : b;
}

/** A 0..100 "higher is better" resource (water/nutrient/health). */
export function classifyLevel(v: number, good = 50, watch = 25): PacketHealth {
  if (v >= good) return "good";
  if (v >= watch) return "watch";
  return "alert";
}

/** A 0..100 "higher is worse" pressure (pests/disease). */
export function classifyPressure(v: number, alert = 50, watch = 20): PacketHealth {
  if (v >= alert) return "alert";
  if (v >= watch) return "watch";
  return "good";
}

function inBand(v: number, [lo, hi]: readonly [number, number]): boolean {
  return v >= lo && v <= hi;
}

function fmtHours(h: number): string {
  if (!isFinite(h) || h < 0) return "—";
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24);
  const r = Math.round(h % 24);
  return r ? `${d}d ${r}h` : `${d}d`;
}

function fmtEta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffH = (t - Date.now()) / 3_600_000;
  if (diffH <= 0) return "now";
  return `in ${fmtHours(diffH)}`;
}

/**
 * Stage packet — the headline "where is this grow" card. Germination gets the
 * product's "germination watch" framing; other stages get a generic stage card.
 */
export function buildStagePacket(state: PlantState, now: string): MissionPacket {
  const info = STAGE_INFO[state.growth_stage];
  const f = state.forecast;
  const lines: string[] = [];
  let health: PacketHealth = "good";

  if (state.growth_stage === "germination") {
    lines.push("Germination watch started.");
  }

  if (f) {
    const dayInStage = Math.floor(f.hours_in_stage / 24) + 1;
    const windowDays = Math.max(1, Math.round(f.stage_base_hours / 24));
    lines.push(`Current stage: ${info.label} — day ${dayInStage} of ~${windowDays}-day window.`);
    lines.push(`Stage progress: ${Math.round(f.stage_progress_pct)}%.`);
    if (f.is_harvest_ready) {
      lines.push("Harvest-ready ✓");
    } else if (f.next_stage) {
      lines.push(`Next stage (${STAGE_INFO[f.next_stage].label}) ${fmtEta(f.next_stage_eta)}.`);
    }
  } else {
    lines.push(`Current stage: ${info.label}. (Forecast not reported.)`);
    health = "unknown";
  }

  // Moisture / nutrient context, honestly derived from the live scalars.
  const water = classifyLevel(state.water_level);
  const nutrient = classifyLevel(state.nutrient_level);
  lines.push(
    water === "good" ? "Moisture stable." : water === "watch" ? "Moisture getting low." : "Moisture LOW — water soon.",
  );
  lines.push(
    nutrient === "good" ? "Nutrients in range." : nutrient === "watch" ? "Nutrients dipping." : "Nutrients LOW.",
  );
  health = worst(worst(health, water), nutrient);

  const nextCheckpoint = f?.next_stage_eta ? fmtEta(f.next_stage_eta) : undefined;

  return {
    id: `${state.id}:stage`,
    title: state.growth_stage === "germination" ? "Germination Packet" : `${info.label} Packet`,
    source: "plant /state · forecast",
    kind: "stage",
    health,
    summary: `${info.icon} ${info.label} — ${health === "good" ? "on track" : health === "alert" ? "needs attention" : health === "watch" ? "watch" : "status unknown"}.`,
    lines,
    timestamp: now,
    nextCheckpoint,
    actionNeeded: health === "alert",
  };
}

/** Vitals packet — water / nutrient / health / pest / disease. */
export function buildVitalsPacket(state: PlantState, now: string): MissionPacket {
  const water = classifyLevel(state.water_level);
  const nutrient = classifyLevel(state.nutrient_level);
  const health = classifyLevel(state.health, 60, 35);
  const pest = classifyPressure(state.pest_level);
  const disease = classifyPressure(state.disease_level);
  const overall = [water, nutrient, health, pest, disease].reduce(worst, "good");

  const lines = [
    `Health: ${Math.round(state.health)} / 100`,
    `Water: ${Math.round(state.water_level)} · Nutrients: ${Math.round(state.nutrient_level)}`,
    `Pests: ${Math.round(state.pest_level)} · Disease: ${Math.round(state.disease_level)}`,
  ];
  if (state.condition_flags.length) {
    lines.push(`Conditions: ${state.condition_flags.map((c) => `${c.condition} (${c.severity})`).join(", ")}`);
  }

  return {
    id: `${state.id}:vitals`,
    title: "Vitals Packet",
    source: "plant /state",
    kind: "vitals",
    health: overall,
    summary: overall === "good" ? "All vitals in range." : overall === "alert" ? "A vital needs attention." : "Vitals trending — keep an eye on it.",
    lines,
    timestamp: now,
    actionNeeded: overall === "alert",
  };
}

/** Metrics packet — derived VPD / DLI / PPFD, when the stage reports them. */
export function buildMetricsPacket(state: PlantState, now: string): MissionPacket {
  const m = state.metrics;
  if (!m || (m.vpd_kpa == null && m.ppfd == null && m.dli_mol == null)) {
    return {
      id: `${state.id}:metrics`,
      title: "Environment Metrics Packet",
      source: "plant /state · metrics",
      kind: "metrics",
      health: "unknown",
      summary: "No derived metrics reported for this stage.",
      lines: ["VPD / DLI / PPFD are not reported outside the lit grow stages."],
      timestamp: now,
      actionNeeded: false,
    };
  }
  const lines: string[] = [];
  let health: PacketHealth = "good";
  if (m.vpd_kpa != null) {
    const ok = inBand(m.vpd_kpa, REFERENCE_BANDS.vpd_kpa);
    lines.push(`VPD: ${m.vpd_kpa.toFixed(2)} kPa ${ok ? "✓ (in reference band)" : "⚠ outside reference band"}`);
    if (!ok) health = worst(health, "watch");
  }
  if (m.ppfd != null) {
    const ok = inBand(m.ppfd, REFERENCE_BANDS.ppfd);
    lines.push(`PPFD: ${Math.round(m.ppfd)} µmol ${ok ? "✓ (in reference band)" : "⚠ outside reference band"}`);
    if (!ok) health = worst(health, "watch");
  }
  if (m.dli_mol != null) lines.push(`DLI: ${m.dli_mol.toFixed(1)} mol·m⁻²·day⁻¹`);
  if (m.nutrient_ppm != null) lines.push(`Nutrient PPM (display): ${Math.round(m.nutrient_ppm)}`);
  lines.push("Bands are reference values (balance.yaml), shown for context — not live engine thresholds.");

  return {
    id: `${state.id}:metrics`,
    title: "Environment Metrics Packet",
    source: "plant /state · metrics",
    kind: "metrics",
    health,
    summary: health === "good" ? "Environment check passed." : "Environment outside reference band.",
    lines,
    timestamp: now,
    actionNeeded: false,
  };
}

/** Recent-event packet — newest entry from the plant event log, if any. */
export function buildEventPacket(state: PlantState, now: string): MissionPacket | null {
  const ev = state.recent_events?.[0];
  if (!ev) return null;
  const health: PacketHealth =
    ev.severity === "severe" ? "alert" : ev.severity === "moderate" ? "watch" : "good";
  return {
    id: `${state.id}:event`,
    title: "Recent Activity Packet",
    source: "plant /events",
    kind: "event",
    health,
    summary: `Latest: ${ev.event_type}`,
    lines: [
      `Event: ${ev.event_type}${ev.severity ? ` (${ev.severity})` : ""}`,
      `When: ${ev.timestamp ? fmtEta(ev.timestamp) : "—"}`,
      `${state.recent_events.length} recent event(s) on record.`,
    ],
    timestamp: now,
    actionNeeded: health === "alert",
  };
}

/** Assemble the ordered packet list for one plant from its live state. */
export function buildPacketsForPlant(state: PlantState, now: string = new Date().toISOString()): MissionPacket[] {
  const packets: MissionPacket[] = [
    buildStagePacket(state, now),
    buildVitalsPacket(state, now),
    buildMetricsPacket(state, now),
  ];
  const ev = buildEventPacket(state, now);
  if (ev) packets.push(ev);
  return packets;
}
