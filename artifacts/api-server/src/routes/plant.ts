// ============================================================================
// FRONTIER — Clone Room :: Plant API routes (Manual Section 9)
// ----------------------------------------------------------------------------
// CLONE-06: the first three endpoints, mounted under /api by the root router:
//   POST /api/plant/start-grow      -> plant a seed (stage = germinating)
//   POST /api/plant/tend/:growId    -> register a tend action
//   GET  /api/plant/grow/:growId    -> full grow state (+ pending story event)
//
// CLONE-09 (seed minting): derive genetics off-chain and persist the seed.
//   POST /api/plant/mint-seed       -> mint a seed (genetics baked in, no ASA)
//
// All routes are gated behind requireAdminKey until wallet-signature auth ships
// (Section 9). The on-chain ASA mint is deferred to plant time (CLONE-10).
// ============================================================================

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, plantGrows, plantSeeds, storyEvents } from "@workspace/db";
import { requireAdminKey } from "../middlewares/requireAdminKey";
import {
  checkStageProgress,
  getGrowTraits,
  plantSeed,
  tendPlant,
} from "../services/plant/plantService";
import { selectEvent, type StoryEventType } from "../services/plant/storyEngine";
import { mintSeed, mintSeedOnChain } from "../services/chain/seedService";
import { getBlockHashProvider } from "../services/chain/blockHash";
import { cutClone } from "../services/plant/cloneService";
import { resolveStoryEvent } from "../services/plant/storyService";
import { harvestPlant } from "../services/plant/harvestService";

const router: IRouter = Router();

// Gate every /plant route with the temporary admin-key guard.
router.use("/plant", requireAdminKey);

/**
 * POST /api/plant/mint-seed
 * Body: {
 *   ownerAddress: string,        // Algorand wallet address (genetics input)
 *   playerId?: string,           // optional in-game account link
 *   blockHash?: string,          // entropy; resolved from the chain if omitted
 *   parentSeedId?: string,       // lineage for bred seeds (null = Gen 0)
 *   generationNum?: number,      // breeding generation (default 0)
 * }
 *
 * Derives the seed's genetics off-chain and persists the authoritative
 * plant_seeds row. No ASA is created here — the NFT is minted at plant time.
 */
router.post("/plant/mint-seed", async (req, res) => {
  const { ownerAddress, playerId, blockHash, parentSeedId, generationNum } =
    req.body ?? {};

  if (typeof ownerAddress !== "string" || ownerAddress.length === 0) {
    res.status(400).json({ error: "ownerAddress is required" });
    return;
  }
  if (playerId !== undefined && typeof playerId !== "string") {
    res.status(400).json({ error: "playerId must be a string" });
    return;
  }
  if (blockHash !== undefined && typeof blockHash !== "string") {
    res.status(400).json({ error: "blockHash must be a string" });
    return;
  }
  if (parentSeedId !== undefined && typeof parentSeedId !== "string") {
    res.status(400).json({ error: "parentSeedId must be a string" });
    return;
  }
  if (generationNum !== undefined && typeof generationNum !== "number") {
    res.status(400).json({ error: "generationNum must be a number" });
    return;
  }

  try {
    const hash =
      typeof blockHash === "string" && blockHash.length > 0
        ? blockHash
        : await getBlockHashProvider().latest();

    const seed = await mintSeed({
      ownerAddress,
      ownerPlayerId: typeof playerId === "string" ? playerId : null,
      blockHash: hash,
      parentSeedId: typeof parentSeedId === "string" ? parentSeedId : null,
      generationNum: typeof generationNum === "number" ? generationNum : 0,
    });

    res.status(201).json({ seed });
  } catch (err) {
    req.log?.error({ err }, "mint-seed failed");
    res.status(500).json({ error: "failed_to_mint_seed" });
  }
});

/**
 * POST /api/plant/start-grow
 * Body: { seedId: string, playerId: string, plotId?: number }
 */
router.post("/plant/start-grow", async (req, res) => {
  const { seedId, playerId, plotId } = req.body ?? {};

  if (typeof seedId !== "string" || seedId.length === 0) {
    res.status(400).json({ error: "seedId is required" });
    return;
  }
  if (typeof playerId !== "string" || playerId.length === 0) {
    res.status(400).json({ error: "playerId is required" });
    return;
  }
  if (plotId !== undefined && typeof plotId !== "number") {
    res.status(400).json({ error: "plotId must be a number" });
    return;
  }

  try {
    const grow = await plantSeed(seedId, playerId, plotId);

    // Record the seed on-chain at plant time (CLONE-10). Best-effort: a chain
    // failure must never block the grow — the DB row is authoritative and the
    // seed can be minted on a later retry / reconcile. Mint is idempotent.
    let seed = null;
    try {
      seed = await mintSeedOnChain(seedId);
    } catch (mintErr) {
      req.log?.warn({ err: mintErr, seedId }, "seed on-chain mint failed (deferred)");
    }

    res.status(201).json({ grow, seed });
  } catch (err) {
    req.log?.error({ err }, "start-grow failed");
    res.status(500).json({ error: "failed_to_start_grow" });
  }
});

/**
 * POST /api/plant/tend/:growId
 * Increments tendActions, advances the stage if due, and reports any pending
 * story event surfaced by the tend.
 */
router.post("/plant/tend/:growId", async (req, res) => {
  const { growId } = req.params;

  try {
    const tended = await tendPlant(growId);
    if (!tended) {
      res.status(404).json({ error: "grow_not_found" });
      return;
    }

    const grow = await checkStageProgress(tended);
    const traits = await getGrowTraits(grow);
    const pendingEvent = traits ? selectEvent(grow, traits) : null;

    res.status(200).json({ grow, pendingEvent });
  } catch (err) {
    req.log?.error({ err }, "tend failed");
    res.status(500).json({ error: "failed_to_tend" });
  }
});

/**
 * GET /api/plant/grow/:growId
 * Full grow state: grow row, derived traits, resolved story events and any
 * currently-eligible pending story event.
 */
router.get("/plant/grow/:growId", async (req, res) => {
  const { growId } = req.params;

  try {
    const [existing] = await db
      .select()
      .from(plantGrows)
      .where(eq(plantGrows.growId, growId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "grow_not_found" });
      return;
    }

    const grow = await checkStageProgress(existing);
    const traits = await getGrowTraits(grow);
    const events = await db
      .select()
      .from(storyEvents)
      .where(eq(storyEvents.growId, growId));
    const pendingEvent = traits ? selectEvent(grow, traits) : null;

    res.status(200).json({ grow, traits, storyEvents: events, pendingEvent });
  } catch (err) {
    req.log?.error({ err }, "get grow failed");
    res.status(500).json({ error: "failed_to_get_grow" });
  }
});

/**
 * POST /api/plant/resolve-event/:growId
 * Body: { eventType: StoryEventType, choiceId: string }
 *
 * Persist the player's choice for a pending story event. The write is
 * permanent (Section 4) and feeds the Harvest NFT's proof-of-play record.
 */
router.post("/plant/resolve-event/:growId", async (req, res) => {
  const { growId } = req.params;
  const { eventType, choiceId } = req.body ?? {};

  if (typeof eventType !== "string" || eventType.length === 0) {
    res.status(400).json({ error: "eventType is required" });
    return;
  }
  if (typeof choiceId !== "string" || choiceId.length === 0) {
    res.status(400).json({ error: "choiceId is required" });
    return;
  }

  try {
    const [existing] = await db
      .select({ growId: plantGrows.growId })
      .from(plantGrows)
      .where(eq(plantGrows.growId, growId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "grow_not_found" });
      return;
    }

    const event = await resolveStoryEvent(
      growId,
      eventType as StoryEventType,
      choiceId,
    );
    if (!event) {
      res.status(400).json({ error: "unknown_event_or_choice" });
      return;
    }

    res.status(201).json({ event });
  } catch (err) {
    req.log?.error({ err }, "resolve-event failed");
    res.status(500).json({ error: "failed_to_resolve_event" });
  }
});

/**
 * POST /api/plant/clone-cut/:growId
 *
 * Cut a clone from a growing plant (Section 2.2). Derives the clone's genetics
 * from the parent ±5%, mints the Clone NFT immediately, and starts the clone's
 * own grow at the `seedling` stage. One cut per stage is enforced.
 */
router.post("/plant/clone-cut/:growId", async (req, res) => {
  const { growId } = req.params;

  try {
    const result = await cutClone(growId);

    if (result === "grow_not_found" || result === "seed_not_found") {
      res.status(404).json({ error: result });
      return;
    }
    if (result === "not_eligible") {
      res.status(409).json({ error: "clone_not_eligible" });
      return;
    }

    res.status(201).json(result);
  } catch (err) {
    req.log?.error({ err }, "clone-cut failed");
    res.status(500).json({ error: "failed_to_cut_clone" });
  }
});

/**
 * POST /api/plant/harvest/:growId
 * Body: { biome?: string, perfectPh?: boolean }
 *
 * Trigger harvest (Sections 5 & 8.3): compute the rarity tier, mint the Harvest
 * NFT proof-of-play token, stamp harvestNftId + rarityTier and mark the grow
 * `complete`. Idempotent — a second call returns the same recorded snapshot.
 */
router.post("/plant/harvest/:growId", async (req, res) => {
  const { growId } = req.params;
  const { biome, perfectPh } = req.body ?? {};

  if (biome !== undefined && typeof biome !== "string") {
    res.status(400).json({ error: "biome must be a string" });
    return;
  }
  if (perfectPh !== undefined && typeof perfectPh !== "boolean") {
    res.status(400).json({ error: "perfectPh must be a boolean" });
    return;
  }

  try {
    const result = await harvestPlant(growId, {
      biome: typeof biome === "string" ? biome : null,
      perfectPh: perfectPh === true,
    });

    if (result === "grow_not_found" || result === "seed_not_found") {
      res.status(404).json({ error: result });
      return;
    }
    if (result === "not_ready") {
      res.status(409).json({ error: "harvest_not_ready" });
      return;
    }

    res.status(result.minted ? 201 : 200).json(result);
  } catch (err) {
    req.log?.error({ err }, "harvest failed");
    res.status(500).json({ error: "failed_to_harvest" });
  }
});

/**
 * GET /api/plant/seeds/:playerId
 * List every Seed NFT owned by a player (the seed-vault shelf, Section 7.2).
 */
router.get("/plant/seeds/:playerId", async (req, res) => {
  const { playerId } = req.params;

  try {
    const seeds = await db
      .select()
      .from(plantSeeds)
      .where(eq(plantSeeds.ownerPlayerId, playerId));

    res.status(200).json({ seeds });
  } catch (err) {
    req.log?.error({ err }, "list seeds failed");
    res.status(500).json({ error: "failed_to_list_seeds" });
  }
});

export default router;
