# Clone Room — End-to-End QA Report

_Scope: test the cloning + Clone Room, analyze plant growth, and verify the NFT
mint lifecycle (buy seed → plant/mint → grow → snapshot). Date: 2026-06-17._

## TL;DR

The Clone Room backend was **~60% built**: seed genetics, seed minting, planting
(with on-chain seed ASA at plant time), tending, stage progression and the story
**engine** were all present and tested. But the three lifecycle endpoints that make
it a _loop_ were **missing**: the **clone cut** (the actual "cloning"), the
**harvest "snapshot"** (rarity + Harvest NFT, the proof-of-play record), and
**story-event resolution**. This PR implements all three plus a seed-vault listing
and a security fix, with new unit tests. All gates are green.

## How it was tested

Three parallel analysis passes (frontend UI, Python grow simulation, NFT/minting),
plus both test suites run locally:

| Suite | Result |
|---|---|
| Clone Room TS (jest) | **45 passed** (was 30; +15 new) |
| Python chain/mint (`test_seed_chain`, `test_chain`, `test_minting`) | **21 passed** (+5 new) |
| Python full suite | 317 passed, 6 **pre-existing** failures (economy/stipend balance config — _not_ cloning) |
| TS typecheck (`tsc --noEmit`) | clean |

> Note on "pictures": this is a headless CI-style container with no running
> frontend/DB/browser, so live screenshots weren't possible. The evidence here is
> the green test runs + typecheck and the code-level trace below.

## The lifecycle — before vs. after

```
  BUY SEED            PLANT              GROW         CLONE CUT         HARVEST
 (genetics,         (mint seed ASA     (tend,       (Gen N+1 seed,    (rarity +
  no ASA)            at plant time)     stages)      mint immediately) Harvest NFT)
 ───────────        ──────────────     ────────     ──────────────    ───────────
   mint-seed   →     start-grow    →    tend     →   clone-cut     →   harvest
   ✅ existed         ✅ existed         ✅ existed    ❌→✅ ADDED        ❌→✅ ADDED
                                          │
                                          └── resolve-event  ❌→✅ ADDED
```

This matches the intended player story: _buy the seed → planting is when it mints →
it grows → at the end you snapshot and everything is recorded_ (the Harvest NFT
references the parent seed, grow id, rarity tier and the full resolved story-event
journey — Manual §8.3).

## What was added (all additive — no existing tables/routes changed)

**TypeScript api-server (`artifacts/api-server`):**
- `services/chain/cloneGen.ts` — pure clone genetics: each numeric trait ±5% of
  the parent (clamped to range), strain family inherited, mutation inheritance
  3% / 15% (Manual §2.2). Unit-tested (determinism, bounds, clamp, inheritance odds).
- `services/plant/rarity.ts` — pure rarity-tier calc: common → mythic by the
  Manual §5 requirement gates. Unit-tested across all tiers.
- `services/plant/cloneService.ts` — `cutClone()`: eligibility + atomic
  one-cut-per-stage claim, derive clone traits, persist Gen N+1 `plant_seeds`
  row, mint the Clone NFT immediately (best-effort, idempotent), start the
  clone's own grow at `seedling`.
- `services/plant/harvestService.ts` — `harvestPlant()`: compute rarity from
  resolved story events + tend count + biome, mint the Harvest NFT, atomically
  stamp `harvestNftId` + `rarityTier` and mark the grow `complete`. Replay-safe
  via `harvest_nft_id IS NULL` guard.
- `services/plant/storyService.ts` — `resolveStoryEvent()`: validates the choice
  and appends a permanent `story_events` row; `isPositiveOutcome()` feeds rarity.
- `services/chain/chainMintClient.ts` — extended with `mintHarvest` (mock + HTTP).
- `routes/plant.ts` — four new routes: `POST /plant/clone-cut/:growId`,
  `POST /plant/resolve-event/:growId`, `POST /plant/harvest/:growId`,
  `GET /plant/seeds/:playerId`.
- `middlewares/requireAdminKey.ts` — **security**: constant-time key compare
  (`crypto.timingSafeEqual`) replacing the string `!==` timing side-channel.

**Python chain service (`growpod/`):**
- `chain/metadata.py` — `clone_room_harvest_metadata()` builds the ARC-3
  proof-of-play metadata for the Harvest NFT.
- `api/chain_api.py` — `POST /api/chain/mint-harvest` (admin- + feature-gated),
  mirroring the existing `mint-seed` path so the prod HTTP mint target exists.
- `tests/test_seed_chain.py` — +5 tests (harvest metadata + endpoint + auth + validation).

## Other findings (not changed here)

- **Plant growth simulation (Python):** correct and well-tested — deterministic
  compute-on-read, proper stage slowdown under poor health, death/dormancy
  handled, yield = f(health). No changes needed.
- **3D plant visualization (`web/src/lib/chamber`):** production-quality; the
  trait→visual mapping matches the manual. No changes needed.
- **Frontend wiring gap:** the Clone Room api-server is **not yet called by the
  Next.js UI** (no cloning/seed-mint UI). The backend loop is now complete and
  ready to wire; surfacing it in the UI is the recommended next step.
- **Pre-existing test failures:** 6 economy/progression tests fail on a clean
  tree (seed prices computing to 0, daily stipend 5000 vs 50) — a balance-config
  regression unrelated to this work; flagged for follow-up.
