"""
Offline coverage for the *pre-SDK* config guard in the real AlgorandProvider.

The real provider talks to a live Algod node, so its txn-building / transfer /
asset_info / _send paths are the documented honest boundary and stay uncovered
here (they require a funded TestNet account). What we *can* cover offline is the
constructor's pure validation that fires before any network call:

  - the empty/missing ``treasury_mnemonic`` guard must raise ``ChainError``;
  - a well-formed construction stores config and exposes it via ``network()``.

algosdk is installed in the venv, so the lazy import at the top of __init__
succeeds and the guard is reachable without any mock. Nothing here mocks
algosdk and nothing makes a chain/network call: ``algod.AlgodClient(...)`` only
builds a client object, and ``mnemonic.to_private_key`` /
``account.address_from_private_key`` are pure key math.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.chain.algorand import AlgorandProvider
from growpodempire.chain.provider import ChainError


def _fresh_mnemonic():
    """A real, well-formed 25-word mnemonic generated offline (no network)."""
    from algosdk import account, mnemonic

    sk, _addr = account.generate_account()
    return mnemonic.from_private_key(sk)


@pytest.mark.parametrize("bad_mnemonic", ["", None])
def test_empty_treasury_mnemonic_raises_chain_error(bad_mnemonic):
    # The guard at algorand.py:35-36 fires before any AlgodClient is built,
    # so no network call happens regardless of the (unreachable) algod_url.
    with pytest.raises(ChainError) as exc:
        AlgorandProvider(
            algod_url="http://localhost:0",
            algod_token="x" * 64,
            treasury_mnemonic=bad_mnemonic,
        )
    assert "ALGO_TREASURY_MNEMONIC" in str(exc.value)


def test_valid_construction_is_offline_and_stores_network():
    # Full happy-path constructor (algorand.py:38-41) plus network() (43-44),
    # all offline: AlgodClient just stores url/token, key derivation is pure.
    p = AlgorandProvider(
        algod_url="http://localhost:0",
        algod_token="x" * 64,
        treasury_mnemonic=_fresh_mnemonic(),
        network_name="testnet",
    )
    assert p.network() == "testnet"
    # Treasury address derived from the mnemonic is a 58-char Algorand address.
    assert isinstance(p.treasury_addr, str)
    assert len(p.treasury_addr) == 58


def test_network_name_is_passed_through():
    p = AlgorandProvider(
        algod_url="http://localhost:0",
        algod_token="x" * 64,
        treasury_mnemonic=_fresh_mnemonic(),
        network_name="mainnet",
    )
    assert p.network() == "mainnet"
