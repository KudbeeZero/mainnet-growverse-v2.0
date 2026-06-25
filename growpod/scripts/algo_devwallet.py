#!/usr/bin/env python3
"""algo_devwallet.py — Algorand **TESTNET** dev-wallet helper for GROWv2.

Generate a throwaway dev account and check its balance, so you can fund a treasury
for the on-chain layer (``chain/algorand.py``) WITHOUT committing any secret.

    python scripts/algo_devwallet.py generate
    python scripts/algo_devwallet.py balance <ADDRESS>

⚠️  TESTNET ONLY. A generated mnemonic controls *valueless* test ALGO — never reuse
it for MainNet or real funds. Put a funded account's mnemonic in your host secret
store as ``ALGO_TREASURY_MNEMONIC`` (never in git); the factory then switches from
the offline MockChainProvider to the real AlgorandProvider automatically.

Funding a generated address (pick ONE — see docs/ALGORAND_DEV.md for the full guide):
  • AlgoKit LocalNet (no dispenser):
        algokit localnet start          # then ALGOD_URL=http://localhost:4001
  • AlgoKit TestNet dispenser (scripted, no captcha):
        algokit dispenser login
        algokit dispenser fund -r <ADDRESS> -a 10000000   # 10 test ALGO
  • Web faucet (manual, Google/GitHub login + captcha):
        https://lora.algokit.io/testnet
        https://dispenser.testnet.aws.algodev.network/
  • No chain at all (default dev): leave ALGO_TREASURY_MNEMONIC unset, or set
        USE_MOCK_CHAIN=true            # the app runs fully on the in-memory mock
"""

from __future__ import annotations

import argparse
import os


def cmd_generate(_args: argparse.Namespace) -> None:
    from algosdk import account, mnemonic

    sk, addr = account.generate_account()
    print("# TESTNET dev account — save the mnemonic in your secret store, never commit it")
    print(f"ADDRESS  = {addr}")
    print(f"MNEMONIC = {mnemonic.from_private_key(sk)}")


def cmd_balance(args: argparse.Namespace) -> None:
    from algosdk.v2client import algod

    url = os.environ.get("ALGOD_URL", "https://testnet-api.algonode.cloud")
    token = os.environ.get("ALGOD_TOKEN", "")
    client = algod.AlgodClient(token, url)
    info = client.account_info(args.address)
    micro = int(info.get("amount", 0))
    print(f"{args.address}")
    print(f"  {micro} microAlgos  ({micro / 1_000_000:.6f} ALGO)  via {url}")
    if micro == 0:
        print("  (unfunded — fund it via a dispenser/LocalNet; see the header of this script)")


def main() -> None:
    p = argparse.ArgumentParser(description="Algorand TESTNET dev-wallet helper")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("generate", help="generate a new TESTNET dev account (address + mnemonic)")
    b = sub.add_parser("balance", help="check an address's balance against ALGOD_URL")
    b.add_argument("address", help="the Algorand address to query")
    args = p.parse_args()
    {"generate": cmd_generate, "balance": cmd_balance}[args.cmd](args)


if __name__ == "__main__":
    main()
