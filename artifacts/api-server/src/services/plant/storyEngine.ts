// ============================================================================
// FRONTIER — Clone Room :: Story event engine (Manual Section 4)
// ----------------------------------------------------------------------------
// Deterministic story-event selection and outcome application. Events fire at
// stage transitions, present 2-3 choices, and the chosen outcome modifies the
// grow's effective traits / yield / rarity. Selection is seeded from on-chain
// derived data so the same conditions reproduce the same draw.
//
// Pure module — no DB or network access. The route layer is responsible for
// persisting the resolved choice to the story_events table.
// ============================================================================

import type { PlantGrow, PlantStage, SeedTraits, StoryOutcome } from "@workspace/db";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type StoryEventType =
  | "spider_mite_outbreak"
  | "nutrient_deficiency"
  | "unexpected_mutation"
  | "environmental_anomaly"
  | "perfect_trichome_window"
  | "hermaphrodite_risk"
  | "root_bound_alert";

/** Extra context not stored on the grow row (resolved server-side). */
export interface StoryContext {
  /** Biome of the parent FRONTIER plot, e.g. "volcanic". */
  biome?: string;
  /** Whether the LED photoperiod has been set for this grow. */
  photoperiodSet?: boolean;
}

export interface StoryChoice {
  id: string;
  label: string;
  outcome: StoryOutcome;
}

export interface StoryEventDef {
  type: StoryEventType;
  label: string;
  /** Eligibility predicate for the current grow conditions. */
  trigger: (
    grow: PlantGrow,
    traits: SeedTraits,
    ctx: StoryContext,
    now: number,
  ) => boolean;
  choices: StoryChoice[];
}

const HOUR_MS = 60 * 60 * 1000;
const stageOf = (grow: PlantGrow) => grow.stage as PlantStage;

// ----------------------------------------------------------------------------
// 4.1  Story Event Registry
// ----------------------------------------------------------------------------

export const EVENT_REGISTRY: StoryEventDef[] = [
  {
    type: "spider_mite_outbreak",
    label: "Spider Mite Outbreak",
    trigger: (grow) => stageOf(grow) === "veg" && (grow.tendActions ?? 0) < 3,
    choices: [
      { id: "spray", label: "Spray", outcome: { yieldMod: -0.3, tag: "yield_loss" } },
      {
        id: "prune",
        label: "Prune",
        outcome: { yieldMod: -0.1, tag: "clone_eligible" },
      },
      {
        id: "let_it_ride",
        label: "Let it ride",
        outcome: { tag: "mutation_unlocked" },
      },
    ],
  },
  {
    type: "nutrient_deficiency",
    label: "Nutrient Deficiency",
    trigger: (_grow, traits) => traits.leafDensity < 0.4,
    choices: [
      {
        id: "feed_heavy",
        label: "Feed heavy",
        outcome: { traitModifiers: { growthRate: 0.2 }, tag: "growth_up" },
      },
      {
        id: "flush",
        label: "Flush",
        outcome: {
          traitModifiers: { growthRate: -0.1, resinProfile: 0.15 },
          tag: "resin_up",
        },
      },
      { id: "ignore", label: "Ignore", outcome: { tag: "stage_stagger" } },
    ],
  },
  {
    type: "unexpected_mutation",
    label: "Unexpected Mutation",
    trigger: (_grow, traits) => traits.mutationFlag === true,
    choices: [
      {
        id: "study_it",
        label: "Study it",
        outcome: { rarityMod: 1, tag: "rare_harvest_tier" },
      },
      {
        id: "clone_it",
        label: "Clone it first",
        outcome: { tag: "mutant_clone_minted" },
      },
      { id: "remove", label: "Remove", outcome: { tag: "normal_grow" } },
    ],
  },
  {
    type: "environmental_anomaly",
    label: "Environmental Anomaly",
    trigger: (_grow, _traits, ctx) => ctx.biome === "volcanic",
    choices: [
      {
        id: "embrace",
        label: "Embrace",
        outcome: { traitModifiers: { colorShift: 30 }, tag: "fire_phenotype" },
      },
      { id: "shield", label: "Shield", outcome: { tag: "normal_grow" } },
    ],
  },
  {
    type: "perfect_trichome_window",
    label: "Perfect Trichome Window",
    trigger: (grow, traits) =>
      traits.resinProfile > 0.8 && stageOf(grow) === "harvest",
    choices: [
      {
        id: "harvest_now",
        label: "Harvest now",
        outcome: { rarityMod: 1, tag: "max_rarity" },
      },
      {
        id: "wait_48h",
        label: "Wait 48 hrs",
        outcome: { rarityMod: 2, tag: "legendary_chance" },
      },
    ],
  },
  {
    type: "hermaphrodite_risk",
    label: "Hermaphrodite Risk",
    trigger: (grow, _traits, ctx) =>
      stageOf(grow) === "veg" && ctx.photoperiodSet !== true,
    choices: [
      { id: "flip_12_12", label: "Flip to 12/12", outcome: { tag: "normal_harvest" } },
      {
        id: "extend_veg",
        label: "Extend veg",
        outcome: { tag: "growth_plus_48h" },
      },
      { id: "accept_risk", label: "Accept risk", outcome: { tag: "seed_phenotype" } },
    ],
  },
  {
    type: "root_bound_alert",
    label: "Root Bound Alert",
    trigger: (grow, _traits, _ctx, now) =>
      stageOf(grow) === "veg" &&
      now - grow.stageAt >= 72 * HOUR_MS &&
      (grow.tendActions ?? 0) === 0,
    choices: [
      { id: "up_pot", label: "Up-pot", outcome: { tag: "growth_restored" } },
      {
        id: "root_prune",
        label: "Root prune",
        outcome: { yieldMod: -0.1, tag: "resilient" },
      },
      {
        id: "leave",
        label: "Leave",
        outcome: { yieldMod: -0.3, tag: "stunted" },
      },
    ],
  },
];

// ----------------------------------------------------------------------------
// 4.2  Deterministic RNG + event selector
// ----------------------------------------------------------------------------

/**
 * Deterministic PRNG (mulberry32). Returns a generator that yields the same
 * sequence of floats in [0, 1) for a given integer seed.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build the eligible event pool for the current conditions and deterministically
 * select one (Section 4.2). Returns null when no event is eligible.
 *
 * The seed mirrors the manual: resinProfile × 1000 × (tendActions + 1) ×
 * (now % 1000). `now` is injectable so selection is reproducible in tests.
 */
export function selectEvent(
  grow: PlantGrow,
  traits: SeedTraits,
  ctx: StoryContext = {},
  now: number = Date.now(),
): StoryEventType | null {
  const seed = Math.floor(
    traits.resinProfile * 1000 * ((grow.tendActions ?? 0) + 1) * (now % 1000),
  );
  const rng = seededRandom(seed);

  const pool = EVENT_REGISTRY.filter((e) => e.trigger(grow, traits, ctx, now));
  if (pool.length === 0) return null;

  return pool[Math.floor(rng() * pool.length)].type;
}

// ----------------------------------------------------------------------------
// Outcome application
// ----------------------------------------------------------------------------

/** Look up an event definition by type. */
export function getEventDef(type: StoryEventType): StoryEventDef | undefined {
  return EVENT_REGISTRY.find((e) => e.type === type);
}

/**
 * Resolve a player's choice into its trait / yield / rarity modifications.
 * Returns null if the event type or choice id is unknown.
 */
export function applyOutcome(
  type: StoryEventType,
  choiceId: string,
): StoryOutcome | null {
  const def = getEventDef(type);
  if (!def) return null;
  const choice = def.choices.find((c) => c.id === choiceId);
  if (!choice) return null;
  // Return a fresh copy so callers can persist it without mutating the registry.
  return { ...choice.outcome };
}
