# TestNet Setup — flipping from mock to real Algorand

This repo runs against an **offline `MockChainProvider`** by default — no network, no
secrets, deterministic ids. Everything below is what an operator sets to switch a
deployment to real Algorand **TestNet**. There is no code change involved: `chain/factory.py`
picks the provider purely from environment variables (see `docs/memory/design/NFT_MARKETPLACE_SPEC.md`
for the feature this backs, and `CLAUDE.md` — "Providers are swappable behind ABCs").

## 1. What decides mock vs. real

`chain/factory.get_chain_provider()`:

```python
if settings.use_mock_chain or not settings.algo_treasury_mnemonic:
    return MockChainProvider()
# else: real AlgorandProvider, built from the env vars below
```

So the switch is exactly two conditions:
- `USE_MOCK_CHAIN` must **not** be `"true"` (unset or `"false"` is fine — this is a dev/test
  force-mock escape hatch, not something you'd normally set in an env going live).
- `ALGO_TREASURY_MNEMONIC` must be set to a real 25-word Algorand mnemonic.

Nothing else in the codebase special-cases mock vs. real — `services/nft_mint.py`,
`services/marketplace.py`, `services/staking.py`, `services/settlement_service.py`, and
`api/chain_api.py` / `api/nft_api.py` all call `chain.factory.shared_provider()` and don't know
or care which implementation they got.

## 2. Environment variables

| Variable | Required to go live? | Default | Purpose |
|---|---|---|---|
| `ALGO_TREASURY_MNEMONIC` | **Yes** | unset | 25-word mnemonic for the treasury account (creates/holds/transfers every ASA). **Secret** — host secret store only, never `.env` in the repo, never logged. |
| `ALGOD_URL` | No | `https://testnet-api.algonode.cloud` | Algod node endpoint. AlgoNode's free public TestNet endpoint works out of the box; swap for your own node/API key if you hit rate limits. |
| `ALGOD_TOKEN` | No | `""` (empty) | Algod API token. AlgoNode's public endpoint needs none. |
| `INDEXER_URL` | No | `https://testnet-idx.algonode.cloud` | Indexer endpoint (for balance/history queries beyond what Algod alone gives you). |
| `ALGORAND_NETWORK` | No | `testnet` | Cosmetic label surfaced via `provider.network()`; does **not** change which node you talk to — that's `ALGOD_URL`. Never set this to `mainnet` without also pointing `ALGOD_URL`/`ALGOD_TOKEN` at a MainNet node and treating the mnemonic as real-money custody. |
| `ASA_ID` | No | unset (auto-creates one) | The GROW currency ASA id (`services/settlement_service.py`). Leave unset on first run — `create_token_asa` mints a fresh one; copy the printed id into `ASA_ID` afterward so restarts don't keep minting new tokens. See `scripts/reset_asa.py`. |
| `USE_MOCK_CHAIN` | No | `false` | Force the offline mock even if a treasury mnemonic is present (useful for a demo/staging box that shouldn't touch the chain). |
| `NFT_METADATA_BASE_URL` | No | `""` | Public base URL used to build the `#arc3` metadata URL for the *older* strain/harvest NFT path (`services/minting_service.py`). Not used by the Sprint-4 marketplace path, which uploads to IPFS instead (see below). |
| `PINATA_JWT` | No (see IPFS section) | unset | Pinata JWT for pinning NFT metadata JSON. |
| `IPFS_API_URL` | No | unset | Base URL of a self-hosted IPFS node's HTTP API, as an alternative to Pinata. |

## 3. Creating and funding a TestNet treasury account

**This step needs the owner — an agent cannot generate or fund a real wallet.**

1. Generate a fresh Algorand account. Any of these work:
   - [Pera Wallet](https://perawallet.app/) (mobile/browser extension) — create a new account,
     switch its network to TestNet in settings, and export the 25-word mnemonic.
   - Or offline, using `algosdk` (already a dependency here):
     ```python
     from algosdk import account, mnemonic
     sk, addr = account.generate_account()
     print("address:", addr)
     print("mnemonic:", mnemonic.from_private_key(sk))
     ```
2. Fund it with test ALGO from Algorand's **public TestNet dispenser**:
   **https://bank.testnet.algorand.network/** — paste the address, request funds (no signup,
   free, TestNet ALGO has no real value). A few requests is plenty to cover ASA creation fees
   (asset creation costs a small ALGO fee + a minimum-balance increase per asset held).
3. Set `ALGO_TREASURY_MNEMONIC` to the mnemonic in your host's secret store (Fly secrets,
   Render env group, etc.) — **never** commit it, put it in `.env`, or paste it into chat/logs.
4. Restart the app. `chain.factory.shared_provider()` will now resolve to `AlgorandProvider`
   instead of `MockChainProvider` — verify via `GET` on any endpoint that surfaces
   `provider.network()` (e.g. `/api/chain/mint-seed` response body's `network` field), which
   should read `"testnet"` instead of `"mock"`.
5. (Optional, only if you already had `ASA_ID` set to an old asset) Run
   `python -m growpodempire.scripts.reset_asa` to mint the GROW currency ASA fresh and print
   its id, then set `ASA_ID` to that value.

### For the live end-to-end test specifically

`tests/test_live_testnet_e2e.py` exercises **mint → list → buy → stake → claim** against real
TestNet. Buying requires a *second* funded account (the buyer opts itself into the ASA via a
zero-amount self-transfer, then the treasury sends it the unit) — so that test additionally
needs:

- `RUN_LIVE_TESTNET_TESTS=1` — the opt-in flag; without it the test is skipped (this is what CI
  always runs with, i.e. never set).
- `ALGO_TEST_BUYER_MNEMONIC` — a **second** TestNet account, funded via the same dispenser as
  above. Keep it separate from the treasury mnemonic.

Run it explicitly (it's excluded from the default `make test` / `pytest tests/` run only by
virtue of the skip condition, not a separate marker):
```bash
RUN_LIVE_TESTNET_TESTS=1 \
ALGO_TREASURY_MNEMONIC="<25 words>" \
ALGO_TEST_BUYER_MNEMONIC="<25 words>" \
.venv/bin/python -m pytest tests/test_live_testnet_e2e.py -v
```

## 4. IPFS metadata (Pinata)

`services/ipfs.py` picks a target the same way the chain provider does:

1. `PINATA_JWT` set → real pin to Pinata's `pinFileToIPFS` API.
2. else `IPFS_API_URL` set → real pin to a self-hosted IPFS node's HTTP API.
3. else → a deterministic **offline mock hash** (not pinned anywhere) so dev/CI never depend on
   a network call or a running daemon.

To go live: sign up for Pinata's free tier at https://pinata.cloud, create an API key, and set
`PINATA_JWT` in the secret store. No code change. If a pin ever fails, minting still proceeds —
`services/nft_mint.py` treats IPFS as best-effort and mints the ASA with `ipfs_hash=None`
rather than blocking the mint (the on-chain metadata hash still anchors the exact metadata JSON
regardless of whether the pin succeeded, so re-pinning later is always possible and verifiable).

## 5. What is NOT automated here

- **Opt-in for the buyer's own wallet in production.** The backend treasury can mint/hold/
  transfer assets on the game's behalf, but a *player's* real Pera-wallet-held account can only
  opt itself into an ASA by signing that transaction client-side — the server never holds a
  player's private key. `web/src/lib/chain/algorand/wallet.ts` is where that client-side signing
  flow lives; the live e2e test above stands in for a player wallet with a second
  server-held mnemonic purely so the round-trip is testable without a browser.
- **Any MainNet activity whatsoever.** Every default here (`ALGOD_URL`, `INDEXER_URL`,
  `ALGORAND_NETWORK`) points at TestNet. Do not repoint at MainNet without a separate,
  explicit, owner-approved change — MainNet ALGO and MainNet-minted assets are real money and
  real assets.
