# 🔍 Audit — Seed-NFT claiming · Store · Equipment sim · Cure→Mint (2026-07-07)

> **What this is.** The verified defect registry behind
> [ROADMAP_90D_2026Q3.md](ROADMAP_90D_2026Q3.md) (the owner's 90-day execution plan for Sonnet).
> Produced by three parallel read-only audits on 2026-07-07 (seed-NFT flow, store system,
> simulation + cure/mint), spot-checked against source. **No code was changed in the auditing
> session** — every item below is a work order, not a shipped fix.
>
> Labels follow the Global Evidence layer: everything here is **Verified** (file:line evidence)
> unless marked *Needs owner decision*. Baseline at audit time: 1,183 backend tests passing,
> 91.88% coverage, `main` green.
>
> Defect IDs (N/S/E/C) are referenced by the roadmap's branch specs. When a fix ships, tick it
> here in the same PR.

---

## A. Seed-NFT claiming (N1–N10) — headline: **the flow does not exist for players**

The seed→ASA machinery is real and unit-tested, but it lives in the legacy TypeScript
"Clone Room" api-server (`../artifacts/api-server`, a separate pnpm workspace at the repo root)
that `web/` **never calls** (zero references to `/api/plant/*`, `/api/chain/*`, `mint-seed`,
or `start-grow` anywhere under `web/src`; corroborated by the repo's own
`../CLONE_ROOM_QA_REPORT.md`). What the shipped UI calls "seeds" are in-game inventory rows,
not NFTs.

| ID | Severity | Defect | Evidence |
|---|---|---|---|
| N1 | 🔴 | No player-reachable seed-NFT claim flow at all; the entire seed→ASA lifecycle is stranded in the legacy TS api-server, outside the shipped product | `../artifacts/api-server/src/routes/plant.ts` (mint-seed :51-95, start-grow :101-135); web grep: 0 hits |
| N2 | 🔴 | Seed ASA mint is admin-gated and implicit — no claim action, no player signature, no path handing a seed ASA to a player wallet | `api/chain_api.py:27-67` (`@require_admin`); `../artifacts/api-server/src/services/chain/seedService.ts:39-66` |
| N3 | 🔴 | Three non-reconciling asset layers: Python `MintingService`→`NFTAsset` (unit `GPNFT`), Clone Room `plant_seeds.asaId` (`GPSEED`), and browser-signed ARC-69 plant mints — none writes into the others' store | `services/minting_service.py:59-171`; `../artifacts/api-server/src/services/chain/seedService.ts:24-66`; `web/src/lib/chain/algorand/plantNFT.ts:104-132` |
| N4 | 🟠 | Arcade "mint plant NFT" is a dead end: sets only local state, never informs the backend, never invalidates queries; simulate-mode default makes it a silent no-op (`assetId: 0`) | `web/src/components/arcade/ChainRow.tsx:33-52`; `web/src/lib/chain/algorand/client.ts:34-35` |
| N5 | 🟠 | Factions "Connect wallet" is cosmetic — fills a text field, never runs challenge/sign/link, and uses a different wallet stack than the profile linker | `web/src/app/factions/page.tsx:143` vs `web/src/lib/chain/algorand/wallet.ts` |
| N6 | 🟡 | NFT empty-state advertises a mint path that is OFF in default config (`nft_marketplace` flag) — instructions lead to a 404 | `web/src/components/nft/NFTCollection.tsx:56-64`; `data/balance.yaml` flag default; `api/nft_api.py:46-52` |
| N7 | 🟡 | Token-claim banner promises "Claim your 5,000 tokens" but routes to a page whose only claim control is the daily stipend — dead CTA | `web/src/components/onboarding/TokenClaimBanner.tsx:28-45`; `web/src/app/profile/page.tsx:405-413` |
| N8 | 🟡 | Stake-for-curing passes `game_item_id` as `harvestId` unconditionally (untyped assumption; wrong for future non-harvest assets) | `web/src/components/nft/NFTCollection.tsx:228` |
| N9 | ⚪ | Intended Clone Room UI is an interaction-free 3D scaffold — there is no partial claim UI to finish; it must be designed | `../artifacts/mockup-sandbox/src/pages/clone-room.tsx:9-11` |
| N10 | ⚪ | Profile "🔒 Stake GROW" card is a permanently disabled stub with hardcoded `0 GC` | `web/src/app/profile/page.tsx:449-465` |

Wired-route check: every route the web **does** call matches its backend exactly (seeds/buy,
nft collection/mint, stakes, wallet challenge/link, harvests/mint). The gap is missing flows,
not broken paths.

**Test gaps:** no e2e exercises seed-mint→plant→ASA-stamp across the TS↔Python bridge; no
frontend test covers any claim UI (none exists); `ChainRow`/`mintPlantNFT` send path untested.

---

## B. Store (S1–S7) — routes are sound; two real bugs + a discoverability gap

All 15 store frontend calls map to real backend routes with matching method/params
(`web/src/lib/api/store.ts` ↔ `api/game_api.py:424-2311`). The defects are in behavior:

| ID | Severity | Defect | Evidence |
|---|---|---|---|
| S1 | 🟠 | Featured **strain** cards are un-buyable: `store_featured` computes a price only for `consumable` items, so a pinned strain renders with no Buy button at all | `api/game_api.py:2014-2022` (price stays `None`); `web/src/app/store/page.tsx:179,189` |
| S2 | 🟡 | Featured-shelf consumable purchase never invalidates `wallet`/`player` queries — GC balance elsewhere goes stale | `web/src/app/store/page.tsx:129-135` vs the seasonal/strain branches :125-127, :142-144 |
| S3 | 🔴 | **Fans and soils are pure GROW sinks with zero effect and no use path** — 8 of ~13 gear SKUs do nothing; no equip route, no sim hook, and the store copy *claims* effects ("strengthens stems", "full-tent ventilation") | `data/balance.yaml:453-486`; `db/models.py:324-343` ("owned-only for now"); `web/src/components/plant/GearPanel.tsx:27` (hard-filters to `["light"]`) |
| S4 | 🟠 | The grow pod does NOT represent purchased/installed equipment: chamber climate hardcodes `fan: 45`, the grow-light glow is explicitly cosmetic and ignores equipped PPFD, fans/soils are invisible everywhere | `web/src/components/command/PodCommandCenter.tsx:288` (literal), :321-323 (cosmetic glow); `web/src/components/viz/GrowChamber.tsx` (no gear refs) |
| S5 | 🟡 | Consumables are buyable in the store with no in-store path or pointer to USE them (apply lives only on the plant view) | `api/game_api.py:671`; `web/src/lib/consumableAction.ts` |
| S6 | ⚪ | Store unit test exercises a gear key that doesn't exist (`led_240w`) — misleading fixture | `web/src/lib/api/__tests__/store.test.ts:127,137,147` vs `data/balance.yaml:433-452` |
| S7 | ⚪ | Featured shelf never refetches after purchase (no owned-count/repeat-state refresh) | `web/src/app/store/page.tsx` handleBuy |

**What already works (don't rebuild):** lights are fully functional
(`equip_light` → `pod.light_intensity` → engine light/DLI stress, `services/game_service.py:615-654`,
`simulation/engine.py:184,230-244`); consumables have real effects
(`services/simulation_service.py:426-435`); all 14 research nodes' 9 effect keys are consumed;
bundles/partners/seeds/seasonal purchase paths all work. `GearInventory.equipped_pod_id` is
already a generic FK to `grow_pods` — **equipping fans/soils needs no migration.**

**Test gaps:** no backend test asserts `equip_light → pod.light_intensity`; nothing anchors
fans/soils' intended behavior; no purchase→UI-refresh test; no store e2e.

---

## C. Simulation / environment (E1–E3) — what's real, what's decorative

The engine simulates water, nutrients, temperature, humidity, pH (×10 weight), light/PPFD,
derived VPD, pests (humidity-driven spawn), disease/mildew (humidity-driven growth), and
health→growth coupling (`simulation/engine.py:177-335`). Verified levers: pod automation
(auto water/feed), weather events, equipped lights.

| ID | Severity | Defect | Evidence |
|---|---|---|---|
| E1 | 🟠 | **CO₂ is a decorative sensor**: stored, settable, weather-clamped, serialized — never read by `_env_for` or any health/growth term. Players tune it for zero consequence. (The `co2_enrichment` research node is an unrelated flat yield bonus.) | `db/models.py:361`; `services/simulation_service.py:452`; `simulation/engine.py:177-192` (omits co2); `data/balance.yaml:353-355` |
| E2 | 🔴 | No airflow concept at all — despite humidity driving both pests and mildew, no fan can mitigate anything (this is the sim half of S3) | `simulation/engine.py:283-284,296-302`; no airflow field on `GrowPod` |
| E3 | 🟡 | Trichome model is telemetry-only by design; its only gameplay effect is the harvest-window quality delta — fine, but undocumented for players | `simulation/engines/flowers/trichome_resin_gland.py:11-13`; `simulation/pricing.py:90-97` |

---

## D. Harvest → Cure → Mint (C1–C11)

The flow diagram and all route matches are in the roadmap's Workstream B. Defects:

| ID | Severity | Defect | Evidence |
|---|---|---|---|
| C1 | 🟠 | **Staking "curing room" reward is always 0 for legitimately minted harvests**: mint rejects sold harvests, `sale_value` is set only on sale, reward = `sale_value × pct` → `None → 0`. Tests mask it by force-setting `sale_value` | `services/minting_service.py:69-70`; `services/staking.py:236-239`; `tests/test_nft_economy_security.py:66,93,106,156` |
| C2 | 🟠 | Mint button shows for every unsold harvest with no rarity/wallet gate — commons (the starter path!) always error at "below the mint threshold" | `web/src/components/harvest/HarvestsPanel.tsx:129-133`; `services/minting_service.py:79-83` |
| C3 | 🟡 | No cure countdown/ETA: "Finish cure" is clickable immediately and just error-toasts until done; `Countdown`/`useCountdown` primitives already exist unused here; serializer already exposes `cure_started_at` + `cure_target_hours` | `web/src/components/harvest/HarvestsPanel.tsx:121-125`; `services/game_service.py:1311-1315`; `api/serialize.py:157-158` |
| C4 | 🟡 | "Sell" stays active mid-cure → guaranteed error toast | `HarvestsPanel.tsx:126-128`; `services/game_service.py:1266-1267` |
| C5 | 🟠 | Minting mid-cure is allowed and permanently strands state: ARC-3 metadata + IPFS pin snapshot pre-cure quality; `finish_cure` then diverges DB from chain forever | `services/minting_service.py:59-83` (no `cure_status` check); `chain/metadata.py:104-123`; `services/nft_mint.py:82-83` |
| C6 | 🟠 | Mint `PENDING` can strand on partial failure (crash between `create_asset` and final commit) — every retry then hits "already in progress" forever; only `ChainError` is compensated; no reconciliation | `services/minting_service.py:143-170` |
| C7 | 🟡 | Two different systems both named "curing" ship on the same page (quality cure vs staking lock) — the CuringRoom explainer describes staking, not the cure the player just did; collision acknowledged in code | `web/src/components/nft/CuringRoom.tsx:159-172`; `services/staking.py:3-9` |
| C8 | 🟡 | Quality cure ignores the per-player turbo clock: plants grow in minutes under turbo but cure on wall clock (72 real hours) — inconsistent pacing | `services/game_service.py:1290,1307` (`self.clock.now()`) vs `_player_now` used at :1123 |
| C9 | 🟡 | Split mint paths: game mint goes to treasury with no wallet needed; marketplace wrap 403s without a linked wallet; player sees a raw error after the asset already exists on-chain | `api/nft_api.py:134-135`; `HarvestsPanel.tsx:134` |
| C10 | ⚪ | (= N6) marketplace/staking flags default OFF while UI copy assumes ON | `data/balance.yaml` flags |
| C11 | ⚪ | No frontend test covers HarvestsPanel, cure flow, mint gating, NFTCollection, or CuringRoom | web test grep: 0 hits |

**Backend cure/mint unit coverage is otherwise good** (`tests/test_curing.py`,
`tests/test_minting.py`, `tests/test_harvest_gate.py`, `tests/test_e2e_grow_loop.py`).
The specific defects above are exactly the untested seams.

---

## E. Owner decision register (carried into the roadmap)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Seed-NFT architecture: port Clone Room seed-ASA logic into the Python game API vs wire web to the TS api-server | **Port to Python** — DB-authoritative, one server, provider ABCs + CI mocks already exist; TS server stays archived |
| D2 | Staking reward basis (C1): what does an unsold, minted harvest earn? | Reward on the **appraised value** (`simulation/pricing.py` estimate) × `reward_pct` — economy faucet change, needs owner numbers + Economy Balancer sim |
| D3 | Cure clock (C8): wall clock or player-effective turbo clock? | Player-effective clock for consistency; keep a floor (e.g. ≥1h wall) so cures stay a beat, not a click |
| D4 | Mint-mid-cure policy (C5) | **Block mint while `cure_status == "curing"`** — metadata should snapshot final quality |
| D5 | Staking surface rename (C7) | Rename staking UI ("Reserve Vault" / "Humidor" — owner taste); "curing" stays the quality-cure verb |
| D6 | Seed cost 0→25 restore (pre-launch, p08) | Unchanged from GROWVERSE_ROADMAP — owner-gated |
| D7 | Fan/soil/CO₂ effect *numbers* (new `balance.yaml` keys) | Direction owner-approved 2026-07-07 ("items must impact the plant"); ship conservative defaults, tune via `balance.yaml` |

---

*Audit frozen 2026-07-07. Fix slices, sequencing, and Sonnet prompts live in
[ROADMAP_90D_2026Q3.md](ROADMAP_90D_2026Q3.md). When a defect ships fixed, tick it here in the
same PR (per the memory-never-lies rule).*
