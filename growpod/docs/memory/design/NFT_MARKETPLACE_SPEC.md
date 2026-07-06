# NFT Marketplace & Staking Specification (Sprint 4)

**Owner Vision:** Player-owned tradeable NFTs for seeds and harvested buds. Harvest flow: plant → mass/bud → curing room (staking) → market-ready NFT → trade/hold.

**Scope:** TestNet/mock MVP — an early, partial step toward Phase 7 of `docs/memory/GROWVERSE_ROADMAP.md` ("Algorand Ownership Layer"), not a full implementation of that phase. No mainnet config, no real signing, no real money anywhere.

---

## System Architecture

### 1. Entity Model (DB layer)

```
NFTAsset (marketplace-tracking wrapper around an already-minted ASA)
├── asset_id (PK, Algorand ASA ID — set by the existing MintingService mint)
├── asset_type enum [HARVEST] (SEED reserved, not wired up)
├── owner_address (Algorand account)
├── game_item_id (FK → Harvest.id)
├── mint_txid (nullable — MintingService's create_asset doesn't surface one)
├── ipfs_hash (metadata URI)
├── metadata_snapshot JSON (name, image hash, traits, generation)
├── status enum [MINTED, LISTED, STAKING, TRADED]
├── created_at, synced_at

NFTListing (marketplace post)
├── listing_id (PK, UUID)
├── nft_asset_id (FK)
├── seller_address (Algorand account)
├── price_ualgos
├── status enum [ACTIVE, SOLD, CANCELLED, EXPIRED]
├── expires_at
├── created_at

NFTTrade (settlement record)
├── trade_id (PK, UUID)
├── listing_id (FK)
├── buyer_address
├── seller_address
├── price_ualgos
├── txid (the atomic swap transaction, once confirmed)
├── status enum [PENDING, CONFIRMED, FAILED]
├── completed_at

StakingLock (curing room representation — "cure = staking")
├── lock_id (PK, UUID)
├── nft_asset_id (FK)
├── player_id (FK → Player)
├── cure_start_at
├── cure_end_at (calculated: start + cure_target_hours)
├── curing_progress_pct (computed, not stored)
├── status enum [ACTIVE, COMPLETE, WITHDRAWN]
├── rewards_amount (bonus GC, computed at lock time from harvest.sale_value)
└── created_at
```

**Note on `Harvest.nft_asset_id` / `nft_status`:** these two columns (added by
an earlier migration, alongside the `chain`-gated `MintingService`) remain the
single source of truth for "has this harvest been minted on-chain" — that mint
is idempotent and optimistic-locked via `Harvest.version`. `NFTAsset` above is
purely additive: it never mints on its own, it wraps an already-minted harvest
with the owner address, IPFS pin, and marketplace/staking status those flows
need. This keeps exactly one code path that can ever call
`provider.create_asset()` for a given harvest.

### 2. Service Layer

**NFTMintService** (`services/nft_mint.py`)
- Delegates the actual on-chain mint to the existing `MintingService`
  (idempotent + optimistic-locked on `Harvest.version`) — never mints directly.
- Builds ARC-3 metadata via `chain.metadata.harvest_metadata` (the SAME
  document `MintingService` hashed on-chain) and pins it to IPFS.
- Creates/returns the `NFTAsset` wrapper row. Idempotent on harvest_id.

**MarketplaceService** (`services/marketplace.py`)
- Create/cancel listings (idempotent)
- Execute a DB-recorded swap (seller → buyer ownership transfer + a `pending`
  `NFTTrade`); price history and floor/24h-average aggregation
- Optimistic-locked on `NFTListing.version` (same pattern as `Wallet`/
  `MarketListing`/`Harvest`) so two concurrent buyers can't both win the
  same listing

**StakingService** (`services/staking.py`, uses the existing `economy.ledger.post`)
- Lock an already-minted NFTAsset for a duration (curing room)
- Drip a bonus-GC reward on claim, once the lock completes
- Track progress (% time complete)

### 3. API Surface (`api/nft_api.py`)

All routes are feature-gated (OFF by default): `nft_bp`/`market_bp` share the
`nft_marketplace` flag; `stakes_bp` (the curing room) uses `nft_staking`.

#### NFT Management (`nft_bp`, `/api/nft`)
- `GET /api/nft/players/{id}/collection` — list player's NFTs, status, metadata
- `POST /api/nft/players/{id}/mint` — mint/wrap a harvest → NFT (idempotent on harvest_id)

#### Marketplace (`market_bp`, `/api/market`)
- `GET /api/market/listings?sort=price_ualgos&limit=20&offset=0` — browse active listings
- `GET /api/market/listings/{id}` — listing detail + NFT metadata snapshot
- `POST /api/market/players/{id}/listings` — create listing (owner only)
- `DELETE /api/market/players/{id}/listings/{id}` — cancel (seller only)
- `POST /api/market/players/{id}/execute/{listing_id}` — buyer accepts; records a pending trade
- `GET /api/market/history/{asset_id}` — price history for graphing

#### Staking (`stakes_bp`, `/api/stakes`)
- `POST /api/stakes/players/{id}` — lock an NFT for curing
- `GET /api/stakes/players/{id}` — active/completed locks + progress
- `GET /api/stakes/players/{id}/{lock_id}` — a single lock's progress
- `POST /api/stakes/players/{id}/{lock_id}/claim` — claim post-cure rewards

---

## Frontend Integration

### 1. Profile → NFT Collection + Curing Room sections
Location: `/profile` (gated behind `nft_marketplace` / `nft_staking` client flags)
- Card grid: each owned NFT (harvest only, for now)
  - Metadata snapshot (name, traits) from the IPFS-pinned ARC-3 JSON
  - Status badge (MINTED, STAKING, LISTED, TRADED)
  - Action buttons:
    - MINTED → "List for sale" or "Stake for curing"
    - STAKING → progress ring, unlock date, claim button once complete
    - LISTED → price, "Delist" button
- Curing Room: active locks (progress ring + countdown), ready-to-claim locks,
  a collapsed history of withdrawn locks

### 2. Marketplace
Location: `/market` → new "NFT Market" tab (alongside the existing seed marketplace)
- Listings grid: ASA id, price in µALGO, seller (truncated address), listed/expiry date
- Listing detail panel + "Buy Now" (calls `execute` — TestNet MVP, no wallet-sign
  step yet; see Trading Flow below)

### 3. Entry point from harvest
A minted harvest (`harvest.nft_status === "minted"`) surfaces a link from the
harvest vault (`HarvestsPanel`) into `/profile`'s NFT Collection section, where
the per-asset "Stake for curing" action is the actual entry to the curing room.

---

## Blockchain Flow (Algorand, TestNet)

### Mint Flow (wrap an existing harvest mint)
1. Frontend calls `POST /api/nft/players/{id}/mint` with `harvest_id`.
2. Backend delegates to `MintingService.mint_harvest` (idempotent,
   optimistic-locked) if the harvest isn't already minted; otherwise reuses
   its existing `nft_asset_id`.
3. Backend builds ARC-3 metadata, pins to IPFS (mock hash offline / Pinata
   when `PINATA_JWT` is set), and creates the `NFTAsset` wrapper row.
4. Frontend shows the asset in the Collection view once the request returns
   (this MVP is synchronous — no polling loop yet).

### Trading Flow (buyer buys a listing) — TestNet/mock, no custodial signing
1. Buyer clicks "Buy" on a marketplace listing.
2. Frontend calls `POST /api/market/players/{id}/execute/{listing_id}`.
3. Backend (`MarketplaceService.execute_trade`) is **DB-only**: it records a
   `pending` `NFTTrade`, transfers `NFTAsset.owner_address` to the buyer, and
   marks the listing `sold`. It does **not** call `chain_provider.transfer_asset`
   and does **not** sign anything on any player's behalf — there is no
   `sender_mnemonic` escape hatch anywhere in this flow (a security review
   already removed a similar unused parameter from `ChainProvider.transfer_asset`
   elsewhere in the codebase; this service never had one).
4. A real wallet-signed on-chain settlement (buyer signs a payment, an atomic
   group swaps the ASA) is **not implemented in this MVP** — `confirm_trade`/
   `fail_trade` exist on `MarketplaceService` for a follow-up reconciliation
   step to call once that signing flow lands, but nothing currently invokes
   them. Treat every `NFTTrade` in this MVP as a DB-recorded intent to trade,
   not a settled on-chain transfer.

### Opt-In Flow (player first receives an ASA)
- Not implemented in this MVP. A player must have `algorand_address` linked
  (the existing `chain`-gated wallet-link flow) before minting/buying; ASA
  opt-in automation is future work, called out in the risk table below.

---

## IPFS Integration

### Metadata Structure
The pinned JSON is exactly `chain.metadata.harvest_metadata(harvest, strain)`
— the same document `MintingService` hashes for the ASA's on-chain
`metadata_hash` field, so the IPFS content and the on-chain hash are
independently verifiable against each other (no divergent "richer" schema
pinned separately, which would break that guarantee):

```json
{
  "name": "Blue Dream Harvest",
  "description": "GrowPodEmpire harvest — 42.0g of Blue Dream at quality 87.3.",
  "decimals": 0,
  "properties": {
    "type": "harvest",
    "strain": "Blue Dream",
    "rarity": "rare",
    "weight_g": 42.0,
    "quality": 87.3,
    "thc": 21.4,
    "cbd": 0.8,
    "harvested_at": "2026-07-06T00:00:00"
  }
}
```

### Upload Flow
1. On mint/wrap, backend assembles the metadata JSON above.
2. Pins to Pinata (`PINATA_JWT` set) or a self-hosted node (`IPFS_API_URL`
   set); otherwise a deterministic offline mock hash (dev/test/CI — no
   network call, mirrors `MockChainProvider`).
3. Saves the hash → `NFTAsset.ipfs_hash`.

---

## Staking / Curing Room

### Mechanics
- A minted NFTAsset can immediately be listed or staked.
- Staking locks the NFTAsset for `staking.default_cure_hours` (balance.yaml,
  default 168h / 7 days) — during the lock it cannot be listed or re-staked.
- UI shows % progress + unlock date via `StakingService.get_lock_progress`.
- On claim (post-cure): `staking.reward_pct` (default 10%) of the harvest's
  `sale_value` is posted to the player's ledger as a `staking_reward` entry,
  and the NFTAsset returns to `minted` status (listable again).

### DB Representation
```
StakingLock.status = ACTIVE
  ├─ Player can view progress (get_lock_progress)
  └─ NFT asset locked (status = "staking"; cannot list/re-stake)

StakingLock.status = COMPLETE → WITHDRAWN (on claim)
  ├─ Player calls claim; Ledger.post(+bonus_gc, staking_reward)
  └─ NFT asset returns to "minted", ready for sale again
```

---

## Launch Checklist

- [x] Database schema + migrations (Alembic, chained onto the current single head)
- [x] Backend services (NFTMint, Marketplace, Staking)
- [x] API endpoints, feature-gated OFF by default
- [x] IPFS upload helper (mock/Pinata/self-hosted)
- [x] Frontend routes + components (Collection, Marketplace, Curing Room) wired
      into `/profile` and `/market`
- [ ] Wallet-signed atomic swap for trades (currently DB-only; see Trading Flow)
- [ ] Opt-in automation
- [ ] On-chain reconciliation job (verify txids daily; `confirm_trade`/`fail_trade`
      exist but nothing calls them yet)
- [ ] E2E spec: mint → list → buy → stake → claim (full loop)
- [ ] Security review of the wallet-signed trading flow, once it exists

---

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Player loses ASA private key | Pera Wallet (or equivalent) owns keys; the server never signs on a player's behalf anywhere in this flow |
| Double-spend on marketplace | `NFTListing.version` optimistic lock: two concurrent buyers of the same listing can't both commit `status = sold` |
| Double-mint of the same harvest | `NFTMintService` never mints directly — it delegates to the existing optimistic-locked `MintingService`, so there is exactly one code path that can call `provider.create_asset()` for a harvest, regardless of which UI entry point triggered it |
| Stale on-chain state | Not yet reconciled automatically in this MVP — `MarketplaceService.confirm_trade`/`fail_trade` are ready for a future daily reconciliation job |
| IPFS pin loss | Pinata (or self-hosted) in production; offline mock hash keeps dev/CI hermetic |
| Opt-in bottleneck | Not yet automated — future work |

---

## Success Metrics

1. Player mints a harvest → NFT appears in their `/profile` collection
2. Player lists → visible in `/market`'s NFT tab with the correct price
3. Second player buys → ownership transfers, both collections reflect it (trade recorded `pending`, not yet chain-confirmed)
4. Staking lock prevents re-trade/re-stake during the cure window
5. Post-cure claim → NFT returns to `minted` + bonus GC awarded

---

**Status (2026-07-06):** Backend + frontend MVP landed on TestNet/mock rails,
both feature flags OFF by default pending owner review. Next round: wallet-signed
trade settlement, opt-in automation, and the on-chain reconciliation job.
