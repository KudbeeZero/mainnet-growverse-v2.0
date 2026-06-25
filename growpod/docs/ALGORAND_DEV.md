# Algorand dev environment — funding & wallet setup

GROWv2's on-chain layer (`src/growpodempire/chain/`) mirrors game assets to Algorand.
The provider is chosen automatically (`chain/factory.py`):

- **No treasury configured** (`ALGO_TREASURY_MNEMONIC` unset) **or `USE_MOCK_CHAIN=true`**
  → the offline **`MockChainProvider`** (no network, no secrets, no ALGO). This is the
  default for local dev, tests, and CI.
- **`ALGO_TREASURY_MNEMONIC` set** (and mock not forced) → the real **`AlgorandProvider`**
  against `ALGOD_URL` (TestNet by default).

So you only need ALGO when you want to exercise the *real* chain. Three ways, easiest first.

## Option 1 — Mock chain (zero setup, recommended for most dev)

Do nothing, or set `USE_MOCK_CHAIN=true`. Mint/transfer/withdraw all run against an
in-memory ledger. No wallet, no funding, no network. Use this unless you specifically
need real on-chain transactions.

## Option 2 — AlgoKit LocalNet (real chain, no dispenser, unlimited funds)

A full Algorand network in Docker with pre-funded accounts — the friction-free way to
test the real provider when the public TestNet dispenser is being painful.

```bash
pipx install algokit         # one-time (or: brew install algokit)
algokit localnet start       # spins up algod + indexer in Docker
```

Point the app at it:

```bash
ALGOD_URL=http://localhost:4001
INDEXER_URL=http://localhost:8980
ALGOD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
ALGORAND_NETWORK=localnet
```

Use a LocalNet pre-funded account (see `algokit localnet status` / Lora at
`https://lora.algokit.io/localnet`) as `ALGO_TREASURY_MNEMONIC`. Funds are unlimited and
reset with `algokit localnet reset`.

## Option 3 — Public TestNet (when you need a real, shareable network)

1. **Make a wallet** (keeps the secret on your machine — nothing is committed):

   ```bash
   python scripts/algo_devwallet.py generate
   ```

   Save the `MNEMONIC` in your secret store as `ALGO_TREASURY_MNEMONIC`. **TestNet only —
   never reuse a dev mnemonic for MainNet or real funds.**

2. **Fund the `ADDRESS`** — pick whichever works (the web faucets need a Google/GitHub
   login + reCAPTCHA and are rate-limited; the AlgoKit dispenser is the smoothest):

   ```bash
   # Scripted, no captcha (recommended):
   algokit dispenser login
   algokit dispenser fund -r <ADDRESS> -a 10000000     # 10 test ALGO (µALGO)
   ```

   Web faucets (manual fallback):
   - https://lora.algokit.io/testnet
   - https://dispenser.testnet.aws.algodev.network/

3. **Confirm it landed:**

   ```bash
   python scripts/algo_devwallet.py balance <ADDRESS>
   ```

   Default `ALGOD_URL` is `https://testnet-api.algonode.cloud` (AlgoNode, no token needed).

## Env reference (`config.py`)

| Var | Default | Meaning |
|-----|---------|---------|
| `ALGO_TREASURY_MNEMONIC` | _unset_ | Treasury account (secret). Unset → mock chain. |
| `USE_MOCK_CHAIN` | `false` | Force the offline mock even if a treasury is set. |
| `ALGOD_URL` | `https://testnet-api.algonode.cloud` | algod endpoint (LocalNet: `http://localhost:4001`). |
| `INDEXER_URL` | `https://testnet-idx.algonode.cloud` | indexer endpoint. |
| `ALGOD_TOKEN` | `""` | algod API token (empty for AlgoNode; LocalNet uses the all-`a` token). |
| `ALGORAND_NETWORK` | `testnet` | network label. |
| `ASA_ID` | _unset_ | the game's ASA id once created. |

**Never commit a mnemonic or token.** Secrets live in your shell/`.env` (gitignored) or the
host secret store only.
