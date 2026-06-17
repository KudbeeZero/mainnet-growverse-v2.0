<div align="center">

# 🪙 Tokenomics — The GROW Economy & Token

**[⬅ Mission Control](../../README.md)** ·
[🚀 Getting Started](getting-started.md) ·
[📖 Game Manual](game-manual.md) ·
[🧠 Strategy Guide](strategy-guide.md) ·
[🧬 Strain Codex](strain-codex.md) ·
[🪙 Tokenomics](tokenomics.md) ·
[🛸 Lore](lore.md) ·
[📡 Glossary](glossary.md)

*How money works in the Empire — the ledger, the burn, the Algorand ASA, the
supply schedule, and the live **Token Observatory** ticker.*

</div>

---

## 📡 The Token Observatory

<div align="center">

### Live `GROW` ticker

![GROW Price](https://img.shields.io/badge/GROW%2FALGO-TestNet-7C3AED?style=for-the-badge&labelColor=0B0E2C&logo=algorand)
![Supply](https://img.shields.io/badge/MAX_SUPPLY-1,000,000,000_GROW-22C55E?style=for-the-badge&labelColor=0B0E2C)
![Decimals](https://img.shields.io/badge/DECIMALS-6-FACC15?style=for-the-badge&labelColor=0B0E2C)
![Chain](https://img.shields.io/badge/CHAIN-Algorand-000000?style=for-the-badge&labelColor=0B0E2C&logo=algorand)

</div>

> 🛰️ **Status:** GROW currently lives on **Algorand TestNet** (or the offline
> mock chain in local dev). It has **no real-world monetary value** — TestNet
> assets are for simulation and entertainment only.
>
> **Wiring the badge to a real feed:** the price badge above is a
> [shields.io](https://shields.io) endpoint badge. Once GROW is listed/priced,
> point it at a JSON endpoint that returns `{ "schemaVersion": 1, "label":
> "GROW/ALGO", "message": "<price>", "color": "..." }` using the
> `https://img.shields.io/endpoint?url=<your-endpoint>` form, and the README hub
> ticker updates automatically on every page load. (No backend code change needed
> to *display* it — only an endpoint that serves the JSON.)

---

## 1 · Two layers, one balance

GrowPod Empire runs money on **two layers that always reconcile**:

| Layer | Role | Authority |
|---|---|---|
| **DB ledger** | Source of truth for gameplay | 👑 Authoritative |
| **Algorand ASA** | Settlement / mirror / trophy case | Reflects the ledger |

The DB is always right. The chain is a mirror, so a clean asset "reset" never
touches a player's balance. This is what lets the game ship safely and reissue the
on-chain asset without economic risk.

---

## 2 · The ledger — every cent accounted for

`GROW` (symbol **GC**) is stored as a **6-decimal `Decimal`** — never a float — so
it maps 1:1 to the Algorand ASA (also 6 decimals).

- Every movement of GROW is **one append-only row** in `ledger_entries`.
- Each row carries a **`balance_after` snapshot**.
- Your balance is never edited directly — it's the tail of the ledger.

➡️ Result: **fully auditable, reconcilable money.** You can replay a player's
entire financial history, and it always matches the chain mirror.

---

## 3 · Faucets — where GROW is born

| Faucet | Amount | Cadence |
|---|---:|---|
| Starting grant | **500** | Once, at account creation |
| Daily stipend | **50** | Once per **22h** |
| Harvest sales | variable | Per harvest (the main engine) |
| Achievements | **1,700 total** | One-time milestones |
| Contract rewards | 250 / 400 / 700 | Per completed 7-day contract |

> The daily stipend is deliberately small — a **retention faucet**, not a wealth
> pump. Real wealth comes from production: growing, breeding, and minting.

---

## 4 · Sinks & the burn — where GROW dies

| Sink | Cost | Burned? |
|---|---:|:--:|
| Seed purchase | 25 × rarity (25–1000) | recycled |
| Nutrients | 5 / application | recycled |
| Pest treatment | 15 | recycled |
| Disease treatment | 20 | recycled |
| Pods | 100 / 400 / 1200 | recycled |
| Breeding fee | 75 + avg_tier×40 | recycled |
| Marketplace **listing fee** | 3% of price | recycled |
| Marketplace **sale tax** | **5% of proceeds** | 🔥 **BURNED** |

### Why the burn matters

The 5% sale tax on player-to-player trades is **permanently destroyed** — removed
from circulating supply. As the player economy grows and more value changes hands,
the burn scales with it, acting as the primary **anti-inflation pressure**.

**Strategic consequence:** flipping leaks value. The economy structurally favors
**producers** over **traders**. (See the
**[Strategy Guide → Economy mastery](strategy-guide.md#6--economy-mastery).**)

---

## 5 · The Algorand ASA

The in-game GROW currency is defined as an Algorand Standard Asset:

| Parameter | Value |
|---|---|
| Unit name | `GROW` |
| Asset name | `GrowCoin` |
| Decimals | **6** |
| Total base units | **1,000,000,000,000,000** (10¹⁵) |
| **Max supply (whole GROW)** | **1,000,000,000** (1 billion) |
| Network | Algorand **TestNet** (mock chain in dev) |

The huge base-unit total (10¹⁵) at 6 decimals gives exactly **1 billion whole
GROW** of headroom — plenty of supply for a growing player base without ever
needing to re-denominate.

---

## 6 · NFTs — ARC-3 strain & harvest assets

Beyond the currency, your **rarest genetics and premium harvests** can mint as
**ARC-3 NFTs** on Algorand.

### Eligibility

| Asset | Requirements |
|---|---|
| **Harvest NFT** | rarity ≥ **rare** |
| **Strain NFT** | you are the **creator** · stability ≥ **0.85** · rarity ≥ **rare** |

### The mint flow (DB-first, chain-second, idempotent)

```
1. Check eligibility against the DB row
2. Write the intended mint to the DB
3. Submit AssetCreate to Algorand + wait for confirmation
4. On success → store onchain_txid / asset_id
   On failure → mark the row FAILED (no phantom asset)
5. Re-minting the same asset returns it unchanged (no double-mint)
```

Metadata is **ARC-3** JSON with a 32-byte content hash, served at
`GET /nft/<kind>/<id>.json`.

> 🏆 Minting awards **+60 XP** and the **First NFT** achievement (**+250 GROW**).
> A minted, stabilized line is your prestige asset — and your premium seed
> factory.

---

## 7 · Going on-chain (TestNet)

The game runs against an **offline mock chain by default** — no funds, no secrets,
fully deterministic for tests. To mint for real on TestNet:

```bash
export ALGO_TREASURY_MNEMONIC="<25-word funded TestNet account>"
export ALGOD_URL="https://testnet-api.algonode.cloud"
export ALGOD_TOKEN=""                              # AlgoNode needs no token
export NFT_METADATA_BASE_URL="https://<your-host>" # where ARC-3 JSON is served

# Mint/reset the GROW ASA and capture its id
python -m growpodempire.scripts.reset_asa
export ASA_ID="<printed id>"
```

- `USE_MOCK_CHAIN=true` forces the mock even with a treasury set (handy for
  staging).
- `scripts/reset_asa.py` safely destroys the old ASA (if the treasury still holds
  it) and mints a fresh one — safe because the **DB ledger**, not the chain, is
  the source of truth.

Full details: [`docs/PHASE3_ONCHAIN.md`](../PHASE3_ONCHAIN.md).

---

## 8 · Wallet custody model

Launch is **custodial-friendly**: the treasury creates and holds assets, while the
DB records ownership (`Player.algorand_address`, `Harvest.nft_asset_id`).

The provider interface already exposes `create_account()` and `transfer_asset()`,
so a **non-custodial Pera / WalletConnect** flow — transferring the NFT to a
player's own opted-in account — can be layered on later **without changing game
logic**.

---

## 9 · A worked economy day

A realistic mid-game day, end to end:

```
Claim daily stipend                          +50
Harvest a rare plant (~120g, q90, THC25)    +~685   (NPC market)
Fill one rare contract (60g delivered)      +700
  └─ feeds + treatments during the day       −30
List a stabilized seed on the marketplace    +200   (−6 listing fee, −10 burn tax)
─────────────────────────────────────────────────────
Net day                                     ≈ +1,589 GROW   (10 GROW burned)
```

Scale that across multiple pods and stabilized lines and you see why **production
compounds** while the burn quietly keeps the currency sound.

---

<div align="center">

### ▶ Build the engine that earns

**[🧠 Economy mastery & the money printer](strategy-guide.md#6--economy-mastery)** ·
**[🧬 Breed a mintable line](strain-codex.md#-best-breeding-stock-to-climb-rarity--mint)** ·
**[📖 On-chain reference](game-manual.md#18--on-chain-asa--nfts)**

**[⬆ Back to top](#-tokenomics--the-grow-economy--token)** · **[⬅ Mission Control](../../README.md)**

<sub>GrowPod Empire · Tokenomics · 🌌</sub>

</div>
