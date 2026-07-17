// Typed client for the FRONTIER Clone Room api-server (`/api/plant/*`).
//
// The Clone Room backend is a separate Express service from the Flask game API.
// Its routes are gated by a shared admin key (x-admin-key) until wallet-
// signature auth ships, so every call below is `raw` (skips the /api/game
// prefix) and carries the configured admin key. The key is read from
// NEXT_PUBLIC_PLANT_ADMIN_KEY — appropriate for this dev/test-gated surface.

import { apiFetch } from "./client";

const PLANT_ADMIN_KEY = process.env.NEXT_PUBLIC_PLANT_ADMIN_KEY?.trim() || "";

// ---- Wire-format types (mirror lib/db/src/schema/cloneRoom.ts) -----------

export type PlantStage =
  | "planted"
  | "germinating"
  | "seedling"
  | "veg"
  | "harvest"
  | "complete";

export interface SeedTraits {
  strainFamily: "indica" | "sativa" | "hybrid";
  growthRate: number;
  internodeSpacing: number;
  leafDensity: number;
  resinProfile: number;
  colorShift: number;
  mutationFlag: boolean;
  parentSeedId: string | null;
}

export interface PlantSeed {
  seedId: string;
  asaId: number | null;
  ownerAddress: string;
  ownerPlayerId: string | null;
  traits: SeedTraits;
  mintTxId: string | null;
  mintedAt: number | null;
  parentSeedId: string | null;
  generationNum: number;
  nonce: string;
  blockHash: string | null;
}

export interface PlantGrow {
  growId: string;
  seedId: string;
  ownerPlayerId: string;
  stage: PlantStage;
  startedAt: number;
  stageAt: number;
  stageEvents: unknown[];
  tendActions: number;
  cloneCut: boolean;
  harvestNftId: string | null;
  rarityTier: string | null;
  parentPlotId: number | null;
}

export interface StoryEvent {
  eventId: string;
  growId: string;
  eventType: string;
  choiceMade: string | null;
  outcome: unknown;
  createdAt: number;
}

export interface PendingEvent {
  eventType: string;
  choiceId: string;
  prompt: string;
  choices: { choiceId: string; label: string }[];
}

export interface CloneCutResult {
  cloneSeed: PlantSeed;
  cloneGrow: PlantGrow;
}

export interface HarvestResult {
  growId: string;
  harvestNftId: string | null;
  rarityTier: string | null;
  minted: boolean;
}

function plant<T>(path: string, opts: Parameters<typeof apiFetch>[1] = {}): Promise<T> {
  return apiFetch<T>(path, { ...opts, raw: true, adminKey: PLANT_ADMIN_KEY });
}

// ---- Endpoints ------------------------------------------------------------

export interface MintSeedInput {
  ownerAddress: string;
  playerId?: string;
  blockHash?: string;
  parentSeedId?: string;
  generationNum?: number;
}

export async function mintSeed(input: MintSeedInput): Promise<{ seed: PlantSeed }> {
  return plant("/api/plant/mint-seed", { method: "POST", body: input });
}

export async function startGrow(
  seedId: string,
  playerId: string,
  plotId?: number,
): Promise<{ grow: PlantGrow; seed: unknown | null }> {
  return plant("/api/plant/start-grow", {
    method: "POST",
    body: { seedId, playerId, plotId },
  });
}

export async function tendPlant(growId: string): Promise<{
  grow: PlantGrow;
  pendingEvent: PendingEvent | null;
}> {
  return plant(`/api/plant/tend/${growId}`, { method: "POST" });
}

export async function getGrow(
  growId: string,
): Promise<{
  grow: PlantGrow;
  traits: SeedTraits | null;
  storyEvents: StoryEvent[];
  pendingEvent: PendingEvent | null;
}> {
  return plant(`/api/plant/grow/${growId}`);
}

export async function resolveEvent(
  growId: string,
  eventType: string,
  choiceId: string,
): Promise<{ event: StoryEvent }> {
  return plant(`/api/plant/resolve-event/${growId}`, {
    method: "POST",
    body: { eventType, choiceId },
  });
}

export async function cloneCut(growId: string): Promise<CloneCutResult> {
  return plant(`/api/plant/clone-cut/${growId}`, { method: "POST" });
}

export async function harvest(
  growId: string,
  opts: { biome?: string; perfectPh?: boolean } = {},
): Promise<HarvestResult> {
  return plant(`/api/plant/harvest/${growId}`, { method: "POST", body: opts });
}

export async function listSeeds(playerId: string): Promise<{ seeds: PlantSeed[] }> {
  return plant(`/api/plant/seeds/${playerId}`);
}
