"""
Offline, deterministic chain provider for tests and local development.

Behaves like a tiny in-memory Algorand: assets get incrementing ids, transfers
move balances, txids are deterministic. No network, no secrets.
"""

import itertools
from typing import Dict, Optional, Tuple

from .provider import ChainProvider, AssetInfo, ChainError, TREASURY


class MockChainProvider(ChainProvider):
    def __init__(self, start_asset_id: int = 1000):
        self._asset_ids = itertools.count(start_asset_id)
        self._tx_ids = itertools.count(1)
        self._account_ids = itertools.count(1)
        self.assets: Dict[int, AssetInfo] = {}
        # asset_id -> {address -> balance}
        self.balances: Dict[int, Dict[str, int]] = {}
        self.destroyed: set = set()

    def network(self) -> str:
        return "mock"

    def create_account(self) -> Tuple[str, str]:
        n = next(self._account_ids)
        address = f"MOCK{n:056d}"
        mnemonic = f"mock-mnemonic-{n}"
        return address, mnemonic

    def create_asset(
        self, *, unit_name, asset_name, total, decimals, url=None, metadata_hash=None
    ) -> int:
        asset_id = next(self._asset_ids)
        self.assets[asset_id] = AssetInfo(
            asset_id=asset_id,
            name=asset_name,
            unit_name=unit_name,
            total=total,
            decimals=decimals,
            url=url,
        )
        self.balances[asset_id] = {TREASURY: total}
        return asset_id

    def destroy_asset(self, asset_id: int) -> str:
        if asset_id not in self.assets:
            raise ChainError(f"asset {asset_id} does not exist")
        self.destroyed.add(asset_id)
        self.assets.pop(asset_id, None)
        self.balances.pop(asset_id, None)
        return self._txid()

    def transfer_asset(self, asset_id, receiver, amount, sender_mnemonic=None) -> str:
        if asset_id not in self.assets:
            raise ChainError(f"asset {asset_id} does not exist")
        book = self.balances.setdefault(asset_id, {})
        book[TREASURY] = book.get(TREASURY, 0) - amount
        book[receiver] = book.get(receiver, 0) + amount
        return self._txid()

    def asset_info(self, asset_id: int) -> AssetInfo:
        if asset_id not in self.assets:
            raise ChainError(f"asset {asset_id} does not exist")
        return self.assets[asset_id]

    def _txid(self) -> str:
        return f"MOCKTX{next(self._tx_ids):010d}"
