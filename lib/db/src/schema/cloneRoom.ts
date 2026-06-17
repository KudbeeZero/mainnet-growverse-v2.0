// ============================================================================
// FRONTIER — Clone Room schema (additive)
// ----------------------------------------------------------------------------
// Three NEW tables for the Clone Room feature: plant_seeds, plant_grows and
// story_events. Defined exactly as specified in Section 6 of the Clone Room
// Manual. This module is purely additive — it never modifies any existing
// table definition.
// ============================================================================

import {
  pgTable,
  varchar,
  text,
  jsonb,
  bigint,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ----------------------------------------------------------------------------
// Shared domain types (Section 3.2 — Trait Map)
// ----------------------------------------------------------------------------

export type StrainFamily = "indica" | "sativa" | "hybrid";

/**
 * Deterministic plant genetics derived from a SHA-256 hash of
 * blockHash + playerAddress + nonce. Stored in plant_seeds.traits (jsonb).
 */
export interface SeedTraits {
  strainFamily: StrainFamily;
  growthRate: number; // 0.4 – 1.8× multiplier on stage durations
  internodeSpacing: number; // 0.2 – 1.0 (visual)
  leafDensity: number; // 0.2 – 1.0 (yield + geometry)
  resinProfile: number; // 0.0 – 1.0 (rarity determinant)
  colorShift: number; // 0° – 360° hue rotation
  mutationFlag: boolean; // ~3% true — unlocks mutation branch
  parentSeedId: string | null; // null = Gen 0 original
}

/** Plant lifecycle stages (Section 2.1 — Stage Map). */
export type PlantStage =
  | "planted"
  | "germinating"
  | "seedling"
  | "veg"
  | "harvest"
  | "complete";

/** A single resolved story event record, stored in story_events.outcome. */
export interface StoryOutcome {
  traitModifiers?: Partial<Record<keyof SeedTraits, number>>;
  yieldMod?: number;
  rarityMod?: number;
  /** Qualitative result tag, e.g. "clone_eligible" or "mutation_unlocked". */
  tag?: string;
}

// ----------------------------------------------------------------------------
// 6.1  plant_seeds
// ----------------------------------------------------------------------------

export const plantSeeds = pgTable("plant_seeds", {
  seedId: varchar("seed_id", { length: 36 }).primaryKey(),
  asaId: bigint("asa_id", { mode: "number" }),
  ownerAddress: text("owner_address").notNull(),
  ownerPlayerId: text("owner_player_id"),
  traits: jsonb("traits").$type<SeedTraits>().notNull(), // SeedTraits object
  mintTxId: text("mint_tx_id"),
  mintedAt: bigint("minted_at", { mode: "number" }),
  parentSeedId: text("parent_seed_id"), // null = Gen 0 original
  generationNum: integer("generation_num").default(0),
  nonce: text("nonce").notNull(), // entropy for trait derivation
  blockHash: text("block_hash"), // Algorand block hash at mint
});

// ----------------------------------------------------------------------------
// 6.2  plant_grows
// ----------------------------------------------------------------------------

export const plantGrows = pgTable("plant_grows", {
  growId: varchar("grow_id", { length: 36 }).primaryKey(),
  seedId: text("seed_id").notNull(),
  ownerPlayerId: text("owner_player_id").notNull(),
  stage: varchar("stage", { length: 20 }).notNull().default("planted"),
  // planted | germinating | seedling | veg | harvest | complete
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  stageAt: bigint("stage_at", { mode: "number" }).notNull(),
  stageEvents: jsonb("stage_events").$type<unknown[]>().default([]),
  tendActions: integer("tend_actions").default(0),
  cloneCut: boolean("clone_cut").default(false),
  harvestNftId: text("harvest_nft_id"), // ASA ID once harvested
  rarityTier: varchar("rarity_tier", { length: 16 }),
  parentPlotId: integer("parent_plot_id"), // FRONTIER parcel biome reference
});

// ----------------------------------------------------------------------------
// 6.3  story_events
// ----------------------------------------------------------------------------

export const storyEvents = pgTable("story_events", {
  eventId: varchar("event_id", { length: 36 }).primaryKey(),
  growId: text("grow_id").notNull(),
  eventType: text("event_type").notNull(),
  choiceMade: text("choice_made"),
  outcome: jsonb("outcome").$type<StoryOutcome>(), // { traitModifiers, yieldMod, rarityMod }
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// ----------------------------------------------------------------------------
// Insert schemas + inferred types (repo convention)
// ----------------------------------------------------------------------------

export const insertPlantSeedSchema = createInsertSchema(plantSeeds);
export type InsertPlantSeed = z.infer<typeof insertPlantSeedSchema>;
export type PlantSeed = typeof plantSeeds.$inferSelect;

export const insertPlantGrowSchema = createInsertSchema(plantGrows);
export type InsertPlantGrow = z.infer<typeof insertPlantGrowSchema>;
export type PlantGrow = typeof plantGrows.$inferSelect;

export const insertStoryEventSchema = createInsertSchema(storyEvents);
export type InsertStoryEvent = z.infer<typeof insertStoryEventSchema>;
export type StoryEvent = typeof storyEvents.$inferSelect;
