# Phase 3 — Algorand On-Chain Layer (ASA + NFTs)

The in-game GROW currency maps to an Algorand **ASA**, and rare/stabilized
strains plus premium harvests can be minted as **ARC-3 NFTs** — on **TestNet**
first. The DB ledger stays authoritative; the chain is a settlement/mirror layer,
so a clean "reset" never touches player balances.

## Provider abstraction (`growpodempire/chain/`)

| File | Role |
|------|------|
| `provider.py` | `ChainProvider` interface + `AssetInfo` / `ChainError`. |
| `mock.py` | `MockChainProvider` — offline, deterministic in-memory chain for tests/dev (no network, no secrets). |
| `algorand.py` | `AlgorandProvider` — real `algosdk` TestNet provider (AssetCreate/Destroy/Transfer + confirmation). |
| `factory.py` | Picks the provider: real when a treasury mnemonic is configured, else the mock. |
| `token.py` | Create / **reset** the GROW token ASA from config. |
| `metadata.py` | ARC-3 metadata + 32-byte hash for strain/harvest NFTs. |

`services/minting_service.py` runs the **DB-first / chain-second, idempotent**
mint flow; an already-minted asset is returned unchanged (no double-mint), and a
chain failure marks the row `FAILED`.

## Going live on TestNet

The app runs out of the box against the **mock chain** (no config needed). To
mint for real on TestNet, set these (secrets only in your host's secret store):

```bash
export ALGO_TREASURY_MNEMONIC="<25-word funded TestNet account>"
export ALGOD_URL="https://testnet-api.algonode.cloud"
export ALGOD_TOKEN=""                       # AlgoNode needs no token
export NFT_METADATA_BASE_URL="https://<your-host>"   # where ARC-3 JSON is served
# Mint/reset the GROW token ASA and capture its id:
python -m growpodempire.scripts.reset_asa
export ASA_ID="<printed id>"
```

`USE_MOCK_CHAIN=true` forces the mock even when a treasury is set (useful for
staging).

## Eligibility (tunable in `data/balance.yaml → chain.nft`)

- **Harvests:** rarity ≥ `mint_min_rarity` (default `rare`).
- **Strains:** `created_by` the player, stability ≥ `strain_min_stability`
  (default 0.85), and rarity ≥ `mint_min_rarity`. This is the stabilize-a-line
  prestige loop from Phase 1 paying off on-chain.

## API (`/api/game`)

| Method & path | Purpose |
|---------------|---------|
| `POST /players/<pid>/wallet/link` | Link a player to an Algorand address. |
| `POST /players/<pid>/harvests/<id>/mint` | Mint an eligible harvest as an NFT. |
| `POST /players/<pid>/strains/<id>/mint` | Mint a stabilized rare strain as an NFT. |
| `GET /nft/<kind>/<id>.json` | Serve the ARC-3 metadata an NFT's URL references. |

## Resetting the ASA safely

`scripts/reset_asa.py` destroys the old ASA (if the treasury still holds it),
mints a fresh one, and prints the new id. Because the DB ledger — not the chain —
is the source of truth for gameplay, abandoning the old asset is safe; only the
on-chain mirror is replaced.

## Wallet custody

Launch model is **custodial-friendly**: the treasury creates/holds assets and the
DB records player ownership (`Player.algorand_address`, `Harvest.nft_asset_id`).
The provider interface already exposes `create_account()` and `transfer_asset()`
so a non-custodial Pera/WalletConnect flow (transfer the unit to a player's own
opted-in account) can be layered on without changing the game logic.

## Testing

Unit tests run entirely against `MockChainProvider` (no network/funds): asset
create/transfer/destroy, token create + reset, mint eligibility, idempotency, and
metadata hashing. The real `AlgorandProvider` is covered by an opt-in TestNet
integration check, never in the default CI path.

## Fate of the old custom chain

The hand-rolled SHA-256 chain (`blockchain/cultivation_chain.py`) is **superseded**
by real Algorand assets and the `plant_events` log. It remains only to keep the
legacy `/api/blockchain/*` endpoints responding and is slated for removal.
