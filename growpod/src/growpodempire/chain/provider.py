"""
Chain provider interface.

A minimal, swappable surface so the same minting / token logic runs against an
offline mock (tests, local dev) or real Algorand TestNet (production).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Tuple


# Sentinel "address" meaning the game treasury (the account that creates/holds
# assets). Providers resolve it to their own treasury account: the mock keys its
# balance book on this literal, and the real provider maps it to the treasury
# Algorand address. Callers should use this constant rather than the bare string.
TREASURY = "TREASURY"


class ChainError(Exception):
    """Any failure interacting with the chain provider."""


@dataclass
class AssetInfo:
    asset_id: int
    name: str
    unit_name: str
    total: int
    decimals: int
    url: Optional[str] = None


class ChainProvider(ABC):
    """The operations the game needs from a blockchain."""

    @abstractmethod
    def network(self) -> str:
        ...

    @abstractmethod
    def create_account(self) -> Tuple[str, str]:
        """Return (address, mnemonic) for a fresh account."""

    @abstractmethod
    def create_asset(
        self,
        *,
        unit_name: str,
        asset_name: str,
        total: int,
        decimals: int,
        url: Optional[str] = None,
        metadata_hash: Optional[bytes] = None,
    ) -> int:
        """Create an ASA (fungible token or NFT) and return its asset id."""

    @abstractmethod
    def destroy_asset(self, asset_id: int) -> str:
        """Destroy an asset the treasury created. Returns a txid."""

    @abstractmethod
    def transfer_asset(
        self, asset_id: int, receiver: str, amount: int, sender_mnemonic: Optional[str] = None
    ) -> str:
        """Transfer asset units. Returns a txid."""

    @abstractmethod
    def asset_info(self, asset_id: int) -> AssetInfo:
        ...
