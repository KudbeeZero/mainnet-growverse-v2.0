"""NFT minting service — converts harvests to on-chain Algorand ASAs.

Handles idempotent minting (same harvest_id -> same asset_id), IPFS metadata
upload, and status tracking. Production-ready for TestNet.
"""

import json
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from ..chain.factory import shared_provider
from ..chain.provider import ChainError
from ..db.models import Harvest, NFTAsset
from .ipfs import IPFSService


class NFTMintError(Exception):
    """NFT minting operation failed."""

    pass


class NFTMintService:
    def __init__(self, session: Session, ipfs: Optional[IPFSService] = None):
        self.session = session
        self.ipfs = ipfs or IPFSService()

    def mint_harvest(self, harvest_id: str, owner_address: str) -> NFTAsset:
        """Mint a harvest as an Algorand ASA. Idempotent on harvest_id.

        Returns the NFTAsset record. If already minted, returns the existing
        asset without re-minting.

        Args:
            harvest_id: The Harvest.id to mint
            owner_address: The Algorand address that will own the ASA

        Returns:
            NFTAsset record with asset_id set

        Raises:
            NFTMintError: If harvest not found, already traded, or chain fails
        """
        # Idempotency check: if this harvest is already minted, return it.
        existing = self.session.query(NFTAsset).filter_by(
            game_item_id=harvest_id, asset_type="HARVEST"
        ).first()
        if existing:
            return existing

        # Fetch the harvest record
        harvest = self.session.query(Harvest).filter_by(id=harvest_id).first()
        if not harvest:
            raise NFTMintError(f"Harvest {harvest_id} not found")

        if harvest.sold:
            raise NFTMintError(f"Harvest {harvest_id} already sold/traded")

        # Build IPFS metadata
        metadata = self._build_harvest_metadata(harvest)
        ipfs_hash = None
        try:
            ipfs_hash = self.ipfs.upload_metadata(metadata)
        except Exception as e:
            # Log but don't fail — IPFS is best-effort for now
            print(f"IPFS upload failed for harvest {harvest_id}: {e}")

        # Create ASA on Algorand
        try:
            provider = shared_provider()
            mint = provider.create_asset_tx(
                unit_name="GPHARVEST",
                asset_name=self._truncate_name(metadata["name"], 32),
                total=1,
                decimals=0,
                url=f"ipfs://{ipfs_hash}" if ipfs_hash else None,
                metadata_hash=None,  # TODO: use IPFS hash as metadata_hash if available
            )
        except ChainError as e:
            raise NFTMintError(f"Failed to mint on Algorand: {e}") from e

        # Record in DB
        nft_asset = NFTAsset(
            asset_id=mint.asset_id,
            asset_type="HARVEST",
            owner_address=owner_address,
            game_item_id=harvest_id,
            mint_txid=mint.txid,
            ipfs_hash=ipfs_hash,
            metadata_snapshot=metadata,
            status="minted",
            synced_at=datetime.utcnow(),
        )
        self.session.add(nft_asset)

        # Mark harvest as having an NFT
        harvest.nft_asset_id = mint.asset_id
        harvest.nft_status = "minted"

        self.session.commit()
        return nft_asset

    def _build_harvest_metadata(self, harvest: Harvest) -> dict:
        """Build IPFS metadata JSON for a harvest NFT."""
        return {
            "name": f"{harvest.strain.name} #{harvest.rarity_snapshot}",
            "description": f"A harvest of {harvest.strain.name}, quality {harvest.quality:.0f}/100",
            "image": f"ipfs://QmPlaceholder",  # TODO: link to strain visual
            "attributes": [
                {"trait_type": "Quality", "value": f"{harvest.quality:.1f}"},
                {"trait_type": "Weight (g)", "value": f"{harvest.weight_g:.1f}"},
                {"trait_type": "Rarity", "value": harvest.rarity_snapshot},
                {"trait_type": "Strain", "value": harvest.strain.name},
                {"trait_type": "Terpenes", "value": ",".join(harvest.terpenes.keys()) if harvest.terpenes else ""},
            ],
            "proof_of_play": {
                "grower": harvest.player.username,
                "harvested_at": harvest.harvested_at.isoformat(),
                "game_url": f"https://growv2.app/harvests/{harvest.id}",
            },
        }

    @staticmethod
    def _truncate_name(name: str, max_len: int) -> str:
        """Truncate name to max length, preserving readability."""
        if len(name) <= max_len:
            return name
        return name[: max_len - 1] + "…"

    def get_harvest_nft(self, harvest_id: str) -> Optional[NFTAsset]:
        """Fetch the NFT record for a harvest, if it exists."""
        return self.session.query(NFTAsset).filter_by(
            game_item_id=harvest_id, asset_type="HARVEST"
        ).first()

    def sync_asset_status(self, asset_id: int) -> None:
        """Poll chain to verify asset still exists and update sync timestamp."""
        try:
            provider = shared_provider()
            info = provider.asset_info(asset_id)
            nft = self.session.query(NFTAsset).filter_by(asset_id=asset_id).first()
            if nft:
                nft.synced_at = datetime.utcnow()
                self.session.commit()
        except ChainError:
            # Asset doesn't exist or chain error — don't update sync time
            pass
