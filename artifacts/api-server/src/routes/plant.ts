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
import { db, plantGrows, storyEvents } from "@workspace/db";
import { requireAdminKey } from "../middlewares/requireAdminKey";
import {
  checkStageProgress,
  getGrowTraits,
  plantSeed,
  tendPlant,
} from "../services/plant/plantService";
import { selectEvent } from "../services/plant/storyEngine";
import { mintSeed } from "../services/chain/seedService";
import { getBlockHashProvider } from "../services/chain/blockHash";

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
    res.status(201).json({ grow });
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

export default router;
