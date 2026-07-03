# NFT Marketplace & Staking Specification (Sprint 4)

**Owner Vision:** Player-owned tradeable NFTs for seeds and harvested buds. Harvest flow: plant → mass/bud → curing room (staking) → market-ready NFT → trade/hold.

**Scope:** Full MVP marketplace with peer-to-peer trading on Algorand TestNet + IPFS metadata.

---

## System Architecture

### 1. Entity Model (DB layer)

```
PlayerWallet
├── player_id (FK → Player)
├── algorand_address (PK for player)
├── opted_in_assets [asa_id, ...] — tracks which ASAs the account can receive
├── treasury_share_pct — % of marketplace taxes that flow to this player's account
└── updated_at

NFTAsset (the on-chain minting record)
├── asset_id (PK, Algorand ASA ID)
├── asset_type enum [SEED, HARVEST]
├── owner_address (Algorand account)
├── game_item_id (FK → PlantSeed or Harvest)
├── mint_txid
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
├── txid (the atomic swap transaction)
├── status enum [PENDING, CONFIRMED, FAILED]
├── completed_at

StakingLock (curing room representation)
├── lock_id (PK, UUID)
├── nft_asset_id (FK)
├── player_id (FK → Player)
├── cure_start_at
├── cure_end_at (calculated: start + strain.cure_days)
├── curing_progress_pct
├── status enum [ACTIVE, COMPLETE, WITHDRAWN]
├── rewards_claimable_at (post-cure bonus drip start)
└── created_at
```

### 2. Service Layer

**ChainSettlementService** (new)
- Verify on-chain txid + confirm → update trade.status
- Ensure player account opted into each ASA before transfer
- Track reconciliation failures for manual review

**NFTMintService** (new)
- Wire harvest completion → create IPFS metadata → mint ASA
- Atomically update NFTAsset.status + NFTLedgerEntry
- Idempotent on harvest_id

**MarketplaceService** (new)
- Create/cancel listings (idempotent)
- Execute atomic swap (seller transfer + buyer payment)
- Price history aggregation

**StakingService** (new, uses existing LedgerService)
- Lock NFT for cure duration
- Drip rewards post-cure (bonus GC or tokens)
- Track progress (% time complete)

### 3. API Surface (endpoints → implement in `api/players_api.py`)

#### NFT Management
- `POST /players/{id}/nft/mint` — trigger harvest → NFT mint (idempotent on harvest_id)
- `GET /players/{id}/nft/collection` — list player's NFTs, status, prices
- `GET /players/{id}/nft/{asset_id}` — single NFT detail + on-chain sync status

#### Marketplace
- `GET /market/listings?type=HARVEST&sort=price_asc&limit=20` — browse active listings
- `POST /market/listings` — create listing (seller only)
- `DELETE /market/listings/{id}` — cancel (seller only)
- `POST /market/execute/{listing_id}` — buyer executes swap; returns txid to sign
- `GET /market/history?asset_id=X` — price history for graphing

#### Staking
- `POST /players/{id}/stake/{asset_id}` — lock NFT for curing
- `GET /players/{id}/stakes` — active/completed locks + progress
- `POST /players/{id}/stake/{lock_id}/withdraw` — claim post-cure rewards

---

## Frontend Integration

### 1. Profile → Collection View
Location: `/profile` → "NFT Collection" tab (new)
- Card grid: each owned NFT (seed/harvest)
  - Image (from IPFS or fallback to strain visual)
  - Name, rarity tier, traits
  - Status badge (MINTED, STAKING, LISTED, OWNED)
  - Action buttons:
    - MINTED → "Stake" or "List for sale"
    - STAKING → progress bar, unlock date, claim reward button
    - LISTED → price, "Delist" button
    - OWNED (received via trade) → "Stake" or "List"

### 2. Marketplace
Location: `/market` (new route)
- Left sidebar:
  - Filters: asset type (Seed/Harvest), rarity, price range, sort (price/recent/expiring)
- Main grid: active listings
  - Thumbnail + metadata snapshot
  - Seller name (truncated address)
  - Price in uALGO + GC equivalent
  - "View" → detail page
  - "Buy" button (modal → confirm txn → sign with Pera → poll for confirmation)

### 3. Staking UI
Location: `/profile` → "Curing Room" tab
- Active locks: progress bar, unlock date, "Claim rewards" button
- Completed locks: "Withdraw" → claim NFT + bonus back to inventory
- Tooltip: "Lock your harvest for X days. After curing, earn +Y% bonus GC."

---

## Blockchain Flow (Algorand)

### Mint Flow (on harvest completion)
1. Backend creates ASA via `AlgorandProvider.create_asset_tx()`
   - Unit: `GPHARVEST` or `GPSEED`
   - Name: `${strain}#${generationNum}` (32 char max)
   - Metadata hash: SHA256(IPFS JSON)
2. Save ASA ID → `NFTAsset.asset_id`
3. Frontend polls `/nft/{asset_id}` until `status == MINTED`

### Trading Flow (buyer buys listing)
1. Buyer clicks "Buy" on marketplace listing
2. Frontend calls `POST /market/execute/{listing_id}` → returns `{ txGroup, txId }`
3. Frontend: user signs via Pera
4. Backend verifies signature + transfers asset:
   ```python
   # Atomic group: seller receives payment, buyer receives asset
   chainProvider.transfer_asset(
       asset_id=listing.nft_asset_id,
       receiver=buyer_addr,
       amount=1,
       sender_mnemonic=seller_mnemonic  # treasury signs on seller's behalf
   )
   # Seller's payment handled separately (or one-shot atomic)
   ```
5. Backend confirms txid, updates `Trade.status = CONFIRMED`
6. Collections refresh via polling

### Opt-In Flow (player first receives an ASA)
- Player must opt-in to ASA before receiving
- `POST /players/{id}/opt-in/{asset_id}` — backend calls `chainProvider.opt_in_asset()`
- Auto-trigger on first listing/trade that would transfer to their account

---

## IPFS Integration

### Metadata Structure
```json
{
  "name": "Cosmic Queen F3 Gen2 #1247",
  "image": "ipfs://QmXxxx...",
  "rarity_tier": "rare",
  "traits": {
    "thc": "18-22%",
    "terpene_profile": "pine+cinnamon",
    "flowering_weeks": 8,
    "generation": 2,
    "parent_ids": ["asset_1", "asset_2"]
  },
  "proof_of_play": {
    "grower": "player_address",
    "grow_time_hours": 240,
    "care_score": 95,
    "proof_url": "https://growv2.app/proof/harvest_id"
  }
}
```

### Upload Flow
1. On harvest completion, backend assembles metadata JSON
2. Pins to Pinata or self-hosted IPFS node
3. Saves IPFS hash → `NFTAsset.ipfs_hash`
4. Uses hash in ASA creation: `url = "ipfs://Qm..."`

---

## Staking / Curing Room

### Mechanics
- Player creates NFT from harvest, can immediately list or stake
- Staking locks NFT for `strain.cure_days` (typically 7–14)
- During lock:
  - NFT cannot be traded, listed, or transferred
  - UI shows % progress + unlock date
  - Player earns bonus GC drip post-unlock (e.g., +10% of harvest value)
- Post-cure:
  - NFT status → READY_FOR_SALE
  - Player can claim: NFT back in collection + bonus GC to wallet
  - Can then list for marketplace

### DB Representation
```
StakingLock.status = ACTIVE
  ├─ Player can view progress
  └─ NFT asset locked (Transfer denied if attempted)

StakingLock.status = COMPLETE
  ├─ Player clicks "Claim"
  ├─ Ledger.post(+bonus_gc, staking_complete)
  └─ NFT returns to collection, ready for sale
```

---

## Launch Checklist

- [ ] Database schema + migrations (AlembicOp)
- [ ] Backend services (ChainSettlement, NFTMint, Marketplace, Staking)
- [ ] API endpoints (11 total)
- [ ] IPFS upload helper + fallback rendering
- [ ] Frontend routes + components (Collection, Marketplace, Curing Room)
- [ ] Pera sign + confirm flow for trades
- [ ] Opt-in automation + error handling
- [ ] On-chain reconciliation job (verify txids daily)
- [ ] E2E spec: mint → list → buy → stake → claim (full loop)
- [ ] Security review (replay protection, access control)

---

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Player loses ASA private key | Pera Wallet owns keys; server never signs on player behalf (except treasury escrow role) |
| Double-spend on marketplace | Atomic swap: payment + asset transfer in one txGroup; settle atomically or both fail |
| Stale on-chain state | Daily reconciliation job; UI polls with exponential backoff |
| IPFS pin loss | Pinata redundancy + GitHub LFS fallback for images |
| Opt-in bottleneck | Auto-trigger on listing; batch opt-ins if needed |

---

## Success Metrics

1. ✅ Player mints first harvest → NFT appears in collection
2. ✅ Player lists → visible in `/market` with correct price
3. ✅ Second player buys → atomic swap executes, both collections reflect
4. ✅ Staking lock prevents re-trade during cure window
5. ✅ Post-cure claim → NFT + bonus GC awarded
6. ✅ On-chain reconciliation job flags any mismatches

---

**Next Session:** Implement in this order:
1. Database schema + alembic migrations
2. ChainSettlementService + opt-in helper
3. NFTMintService integration
4. Backend API endpoints
5. Frontend: Collection view
6. Frontend: Marketplace browser
7. Frontend: Staking UI
8. E2E test loop
9. Security review + launch gate
