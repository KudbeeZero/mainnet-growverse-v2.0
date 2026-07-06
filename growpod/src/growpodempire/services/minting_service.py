"""
MintingService — turns eligible in-game assets into Algorand NFTs.

Flow is DB-first / chain-second and idempotent:
  1. validate ownership + eligibility,
  2. mark the row PENDING and COMMIT (Harvest/Strain carry version_id_col, so
     this commit is the concurrency serialization point -- a losing concurrent
     caller hits StaleDataError here and never reaches the chain call),
  3. create the ASA via the chain provider,
  4. persist the returned asset id + MINTED status.
If the chain call fails, the row is rolled back to "none" (a compensating
action -- the PENDING commit already happened but no asset was minted) and a
GameError is raised; the item remains mintable for a retry. An already-MINTED
asset is returned unchanged (no double-mint).
"""

from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from ..config import get_settings
from ..economy.config import get_economy_config, EconomyConfig
from ..enums import NFTStatus, Rarity, rarity_index
from ..db.models import Harvest, Strain
from ..chain.provider import ChainProvider, ChainError
from ..chain import metadata as md
from ..chain.factory import shared_provider
from . import leveling_service
from .game_service import GameError


class MintingService:
    def __init__(
        self,
        session: Session,
        provider: Optional[ChainProvider] = None,
        config: Optional[EconomyConfig] = None,
        settings=None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        self.settings = settings or get_settings()
        self.provider = provider or shared_provider(self.settings)

    @property
    def _nft_cfg(self) -> dict:
        return self.cfg.raw.get("chain", {}).get("nft", {})

    def _min_rarity_index(self) -> int:
        return rarity_index(Rarity(self._nft_cfg.get("mint_min_rarity", "rare")))

    def _nft_url(self, kind: str, obj_id: str) -> str:
        base = self.settings.nft_metadata_base_url.rstrip("/")
        path = f"/api/game/nft/{kind}/{obj_id}.json"
        return f"{base}{path}#arc3" if base else f"{path}#arc3"

    # ----- Harvest NFTs ---------------------------------------------------
    def mint_harvest(self, player_id: str, harvest_id: str) -> Harvest:
        harvest = self.session.get(Harvest, harvest_id)
        if harvest is None or harvest.player_id != player_id:
            raise GameError("Harvest not found")
        # Disruptor-sweep finding #3: a harvest already sold to the NPC market
        # has already been monetized once (harvest.sale_value posted to the
        # ledger, sell_harvest() stamps sold=True) -- minting it too would let
        # the same harvest pay out twice (NPC-market GC now, marketplace ALGO +
        # a staking bonus later). Covers both mint entry points: this is the
        # single chain-mint path NFTMintService.mint_harvest delegates to.
        if harvest.sold:
            raise GameError("Cannot mint a harvest that has already been sold")
        if harvest.nft_status == NFTStatus.MINTED.value:
            return harvest  # idempotent
        if harvest.nft_status == NFTStatus.PENDING.value:
            # A mint for this harvest already committed PENDING and is (or
            # was) mid-flight to the chain -- don't let a second, sequential
            # request race the same in-flight create_asset() call.
            raise GameError("Mint already in progress for this harvest; please retry shortly")

        if rarity_index(harvest.rarity_snapshot) < self._min_rarity_index():
            raise GameError(
                f"Harvest rarity '{harvest.rarity_snapshot}' is below the mint "
                f"threshold '{self._nft_cfg.get('mint_min_rarity', 'rare')}'"
            )

        strain = self.session.get(Strain, harvest.strain_id)
        metadata = md.harvest_metadata(harvest, strain)
        minted = self._mint(
            harvest,
            asset_name=f"{strain.name} Harvest"[:32],
            url=self._nft_url("harvest", harvest.id),
            metadata=metadata,
        )
        leveling_service.award(self.session, player_id, "mint", self.cfg)
        return minted

    # ----- Strain NFTs ----------------------------------------------------
    def mint_strain(self, player_id: str, strain_id: str) -> Strain:
        strain = self.session.get(Strain, strain_id)
        if strain is None:
            raise GameError("Strain not found")
        if strain.created_by_player_id != player_id:
            raise GameError("Only the breeder can mint this strain")
        if strain.nft_status == NFTStatus.MINTED.value:
            return strain
        if strain.nft_status == NFTStatus.PENDING.value:
            # See mint_harvest(): don't let a second, sequential request race
            # an already in-flight create_asset() call for this strain.
            raise GameError("Mint already in progress for this strain; please retry shortly")

        min_stability = float(self._nft_cfg.get("strain_min_stability", 0.85))
        if strain.stability < min_stability:
            raise GameError(
                f"Strain stability {strain.stability:.2f} is below the mint "
                f"threshold {min_stability:.2f} (stabilize it further first)"
            )
        if rarity_index(strain.rarity) < self._min_rarity_index():
            raise GameError(
                f"Strain rarity '{strain.rarity}' is below the mint threshold"
            )

        metadata = md.strain_metadata(strain)
        minted = self._mint(
            strain,
            asset_name=strain.name[:32],
            url=self._nft_url("strain", strain.id),
            metadata=metadata,
        )
        leveling_service.award(self.session, player_id, "mint", self.cfg)
        return minted

    # ----- shared mint path ----------------------------------------------
    def _mint(self, row, asset_name: str, url: str, metadata: dict):
        row.nft_status = NFTStatus.PENDING.value

        # SECURITY (double-mint, 2026-07-05 review): commit the PENDING status
        # BEFORE calling the chain. Harvest/Strain now carry version_id_col
        # (same optimistic-lock pattern as Wallet), so this commit is the
        # serialization point for the race: two concurrent callers that both
        # observed nft_status == "none" can't both commit PENDING for the same
        # row -- the loser hits StaleDataError here and must NEVER reach
        # create_asset() (a real on-chain mint in prod).
        try:
            self.session.commit()
        except StaleDataError:
            self.session.rollback()
            raise GameError(
                "Mint conflicted with a concurrent request; please retry."
            )

        try:
            asset_id = self.provider.create_asset(
                unit_name="GPNFT",
                asset_name=asset_name,
                total=1,
                decimals=0,
                url=url,
                metadata_hash=md.metadata_hash(metadata),
            )
        except ChainError as exc:
            # The PENDING status already committed but no asset was minted.
            # Roll the row back to "none" (a compensating action, mirroring
            # withdraw()'s reversal credit) so it remains mintable instead of
            # getting stuck at PENDING -- or permanently FAILED -- forever.
            row.nft_status = NFTStatus.NONE.value
            self.session.commit()
            raise GameError(f"On-chain mint failed: {exc}") from exc

        row.nft_asset_id = asset_id
        row.nft_status = NFTStatus.MINTED.value
        self.session.commit()
        return row

    def metadata_for(self, kind: str, obj_id: str) -> dict:
        """Serve the ARC-3 metadata JSON for a minted asset."""
        if kind == "harvest":
            harvest = self.session.get(Harvest, obj_id)
            if harvest is None:
                raise GameError("Harvest not found")
            return md.harvest_metadata(harvest, self.session.get(Strain, harvest.strain_id))
        if kind == "strain":
            strain = self.session.get(Strain, obj_id)
            if strain is None:
                raise GameError("Strain not found")
            return md.strain_metadata(strain)
        raise GameError("Unknown metadata kind")
