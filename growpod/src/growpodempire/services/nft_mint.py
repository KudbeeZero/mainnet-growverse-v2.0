"""NFT marketplace minting — wraps an already-minted Harvest as a
marketplace-ready `NFTAsset` (IPFS pin + owner address + listing/staking
status).

Design note: `Harvest.nft_asset_id` / `nft_status` (set by
`MintingService.mint_harvest`, gated by the "chain" feature flag) remain the
SINGLE source of truth for "has this harvest been minted on-chain". That mint
is idempotent and optimistic-locked via `Harvest.version` (see
`services/minting_service.py`'s module docstring) — two concurrent callers
can't both reach `provider.create_asset()` for the same harvest.

`NFTMintService` never calls the chain provider directly for a harvest mint;
it delegates to `MintingService` so there is exactly one code path that can
ever mint a given harvest, then adds the `NFTAsset` row the marketplace and
staking services need. This keeps the pre-existing
`/api/game/players/<id>/harvests/<id>/mint` flow (already shipped, wired into
the web HarvestsPanel) and the new `/api/nft/players/<id>/mint` flow
interchangeable and mutually idempotent -- whichever runs first performs the
actual mint; the other just observes it.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ..chain import metadata as md
from ..chain.factory import shared_provider
from ..chain.provider import ChainError
from ..db.models import Harvest, NFTAsset, Strain
from ..enums import NFTAssetStatus, NFTAssetType
from .game_service import GameError
from .ipfs import IPFSService
from .minting_service import MintingService


class NFTMintError(Exception):
    """NFT marketplace minting operation failed."""


class NFTMintService:
    def __init__(self, session: Session, ipfs: Optional[IPFSService] = None):
        self.session = session
        self.ipfs = ipfs or IPFSService()

    def mint_harvest(self, player_id: str, harvest_id: str, owner_address: str) -> NFTAsset:
        """Wrap a harvest as a marketplace-ready NFTAsset. Idempotent on harvest_id.

        Returns the existing NFTAsset record without re-minting or re-pinning
        if this harvest was already wrapped.

        Args:
            player_id: The owning player (must match the harvest)
            harvest_id: The Harvest.id to mint/wrap
            owner_address: The Algorand address that will own the ASA

        Returns:
            NFTAsset record with asset_id set

        Raises:
            NFTMintError: If the harvest isn't found/owned, or the underlying
                chain mint fails (see MintingService.mint_harvest)
        """
        existing = (
            self.session.query(NFTAsset)
            .filter_by(game_item_id=harvest_id, asset_type=NFTAssetType.HARVEST.value)
            .first()
        )
        if existing:
            return existing

        try:
            harvest = MintingService(self.session).mint_harvest(player_id, harvest_id)
        except GameError as exc:
            raise NFTMintError(str(exc)) from exc

        strain = self.session.get(Strain, harvest.strain_id)
        # Anchor the IPFS pin to the EXACT same ARC-3 document MintingService
        # hashed on-chain (chain.metadata.harvest_metadata), so the pinned
        # JSON and the on-chain metadata_hash are independently verifiable
        # against each other rather than two divergent documents.
        metadata = md.harvest_metadata(harvest, strain)
        ipfs_hash = self.ipfs.upload_metadata(metadata)

        nft_asset = NFTAsset(
            asset_id=harvest.nft_asset_id,
            asset_type=NFTAssetType.HARVEST.value,
            owner_address=owner_address,
            game_item_id=harvest_id,
            ipfs_hash=ipfs_hash,
            metadata_snapshot=metadata,
            status=NFTAssetStatus.MINTED.value,
            synced_at=datetime.utcnow(),
        )
        self.session.add(nft_asset)
        self.session.commit()
        return nft_asset

    def get_harvest_nft(self, harvest_id: str) -> Optional[NFTAsset]:
        """Fetch the NFTAsset wrapper for a harvest, if it exists."""
        return (
            self.session.query(NFTAsset)
            .filter_by(game_item_id=harvest_id, asset_type=NFTAssetType.HARVEST.value)
            .first()
        )

    def sync_asset_status(self, asset_id: int) -> None:
        """Poll chain to verify asset still exists and update sync timestamp."""
        try:
            provider = shared_provider()
            provider.asset_info(asset_id)
            nft = self.session.query(NFTAsset).filter_by(asset_id=asset_id).first()
            if nft:
                nft.synced_at = datetime.utcnow()
                self.session.commit()
        except ChainError:
            # Asset doesn't exist or chain error — don't update sync time.
            pass
