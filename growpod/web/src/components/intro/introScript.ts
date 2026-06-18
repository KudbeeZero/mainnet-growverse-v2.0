// Scripted timeline for the cinematic "Growth Intro" scene.
//
// This is DATA ONLY — no logic. Phase 1 of the intro is fully self-contained:
// the plant growth stages and the AI-agent "findings" below are scripted, not
// fetched. Phase 2 (see the plan) swaps `findings` for live data from
// advisor.get() + the plant's real condition_flags, and turns the specialist
// fee into a real GROW ledger debit.
//
// The agents deliberately speak the game's real vocabulary: each finding's
// `condition` is a `ConditionKind` (from @/lib/types) whose label/colour come
// from CONDITION_VISUALS (@/lib/conditionVisuals), so the intro matches what a
// player sees on a real plant.

import type { ConditionKind, GrowthStage } from "@/lib/types";

/** A growth stage shown at a point on the timeline. */
export interface StageStep {
  /** Milliseconds from scene start when the plant reaches this stage. */
  atMs: number;
  stage: GrowthStage;
}

/** One AI agent that pops up, recognizes a condition, and offers a specialist. */
export interface AgentFinding {
  id: string;
  /** Milliseconds from scene start when this agent appears. */
  atMs: number;
  /** Anchor position over the plant, as percentages of the stage box. */
  anchor: { xPct: number; yPct: number };
  /** The thing this agent "recognizes" — drives the badge label + colour. */
  condition: ConditionKind;
  /** Short human note shown while the agent reports its finding. */
  note: string;
  /** The specialist a player can summon for this finding. */
  specialist: string;
  /** Mock consult fee in GROW (Phase 2 turns this into a real ledger debit). */
  feeGrow: number;
}

// The plant climbs from a seed to flowering over ~6s of the intro.
export const STAGE_TIMELINE: StageStep[] = [
  { atMs: 0, stage: "seed" },
  { atMs: 1200, stage: "germination" },
  { atMs: 2400, stage: "seedling" },
  { atMs: 3800, stage: "vegetative" },
  { atMs: 5600, stage: "flowering" },
];

// Agents arrive once the plant has some body to inspect, staggered so they
// pop up "one after another" the way the owner described.
export const AGENT_FINDINGS: AgentFinding[] = [
  {
    id: "scout-pests",
    atMs: 4200,
    anchor: { xPct: 30, yPct: 52 },
    condition: "pest_infestation",
    note: "Spotted spider mites on the lower fan leaves.",
    specialist: "Pest Control Specialist",
    feeGrow: 40,
  },
  {
    id: "scout-nutrients",
    atMs: 5400,
    anchor: { xPct: 70, yPct: 40 },
    condition: "nutrient_deficient",
    note: "Yellowing tips suggest a nitrogen shortfall.",
    specialist: "Nutrient Agronomist",
    feeGrow: 35,
  },
  {
    id: "scout-mildew",
    atMs: 6600,
    anchor: { xPct: 52, yPct: 28 },
    condition: "mildew",
    note: "Early powdery mildew forming near the cola.",
    specialist: "Canopy Health Specialist",
    feeGrow: 50,
  },
];

/** Total runtime of the scripted scene (last event + a beat to settle). */
export const SCENE_DURATION_MS =
  Math.max(
    ...STAGE_TIMELINE.map((s) => s.atMs),
    ...AGENT_FINDINGS.map((f) => f.atMs),
  ) + 800;
