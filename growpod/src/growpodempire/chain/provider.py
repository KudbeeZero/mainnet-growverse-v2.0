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


@dataclass
class AssetMint:
    """Result of creating an asset: its id plus the creating txid when known."""

    asset_id: int
    txid: Optional[str] = None


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

    def create_asset_tx(
        self,
        *,
        unit_name: str,
        asset_name: str,
        total: int,
        decimals: int,
        url: Optional[str] = None,
        metadata_hash: Optional[bytes] = None,
    ) -> "AssetMint":
        """Create an asset and return both its id and the creating txid.

        Default implementation reuses :meth:`create_asset` and reports no txid;
        providers that surface the transaction id override this. Additive so the
        existing harvest/strain mint path (which only needs the id) is untouched.
        """
        asset_id = self.create_asset(
            unit_name=unit_name,
            asset_name=asset_name,
            total=total,
            decimals=decimals,
            url=url,
            metadata_hash=metadata_hash,
        )
        return AssetMint(asset_id=asset_id, txid=None)

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
