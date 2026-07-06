"""Marketplace service — manage NFT listings and trades.

Handles listing creation/cancellation, atomic swap execution, price history,
and floor/average price aggregation. DB-only: the server never signs on a
player's behalf. `execute_trade` records a `pending` NFTTrade the moment a
buyer accepts a listing; confirming it with a real on-chain txid (once the
buyer's wallet signs and the swap lands) is `confirm_trade`, called by a
follow-up reconciliation step (not yet wired to a UI in this MVP -- see
docs/memory/design/NFT_MARKETPLACE_SPEC.md).
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from ..db.models import NFTAsset, NFTListing, NFTTrade
from ..economy.config import EconomyConfig, get_economy_config
from ..enums import ListingStatus, NFTAssetStatus, NFTTradeStatus


class MarketplaceError(Exception):
    """Marketplace operation failed."""


class MarketplaceService:
    def __init__(self, session: Session, config: Optional[EconomyConfig] = None):
        self.session = session
        self.cfg = config or get_economy_config()

    @property
    def _listing_expiry_days(self) -> int:
        return int(self.cfg.raw.get("nft_marketplace", {}).get("listing_expiry_days", 7))

    def create_listing(
        self,
        nft_asset_id: int,
        seller_address: str,
        price_ualgos: Decimal,
        expires_in_days: Optional[int] = None,
    ) -> NFTListing:
        """Create a new marketplace listing.

        Args:
            nft_asset_id: The ASA ID to list
            seller_address: The Algorand address of the seller
            price_ualgos: Price in microAlgos (1 ALGO = 1,000,000 uA)
            expires_in_days: How many days until listing expires (defaults to
                the `nft_marketplace.listing_expiry_days` balance.yaml knob)

        Returns:
            NFTListing record

        Raises:
            MarketplaceError: If NFT not found, already listed, or in staking
        """
        nft = self.session.query(NFTAsset).filter_by(asset_id=nft_asset_id).first()
        if not nft:
            raise MarketplaceError(f"NFT asset {nft_asset_id} not found")

        if nft.status == NFTAssetStatus.STAKING.value:
            raise MarketplaceError(f"Asset {nft_asset_id} is currently staked and cannot be listed")

        if nft.status == NFTAssetStatus.LISTED.value:
            raise MarketplaceError(f"Asset {nft_asset_id} is already listed")

        if nft.owner_address != seller_address:
            raise MarketplaceError("Only the owner can list this NFT")

        days = expires_in_days if expires_in_days is not None else self._listing_expiry_days
        listing = NFTListing(
            nft_asset_id=nft_asset_id,
            seller_address=seller_address,
            price_ualgos=price_ualgos,
            status=ListingStatus.ACTIVE.value,
            expires_at=datetime.utcnow() + timedelta(days=days),
        )
        self.session.add(listing)

        nft.status = NFTAssetStatus.LISTED.value
        self.session.commit()

        return listing

    def cancel_listing(self, listing_id: str, seller_address: str) -> None:
        """Cancel an active listing.

        Args:
            listing_id: The listing to cancel
            seller_address: The seller's address (must match listing owner)

        Raises:
            MarketplaceError: If listing not found or unauthorized
        """
        listing = self.session.query(NFTListing).filter_by(id=listing_id).first()
        if not listing:
            raise MarketplaceError(f"Listing {listing_id} not found")

        if listing.seller_address != seller_address:
            raise MarketplaceError("Only the seller can cancel this listing")

        if listing.status != ListingStatus.ACTIVE.value:
            raise MarketplaceError(f"Listing status is {listing.status}, cannot cancel")

        listing.status = ListingStatus.CANCELLED.value
        nft = self.session.query(NFTAsset).filter_by(asset_id=listing.nft_asset_id).first()
        if nft:
            nft.status = NFTAssetStatus.MINTED.value

        self.session.commit()

    def get_active_listings(
        self,
        limit: int = 20,
        offset: int = 0,
        sort_by: str = "created_at",
    ) -> Tuple[List[NFTListing], int]:
        """Fetch active marketplace listings.

        Args:
            limit: Max results to return
            offset: Pagination offset
            sort_by: Sort column (created_at, price_ualgos)

        Returns:
            (listings, total_count)
        """
        # Sweep expired listings first so a stale `active` row never surfaces.
        now = datetime.utcnow()
        expired = (
            self.session.query(NFTListing)
            .filter(
                NFTListing.status == ListingStatus.ACTIVE.value,
                NFTListing.expires_at < now,
            )
            .all()
        )
        for listing in expired:
            listing.status = ListingStatus.EXPIRED.value
            nft = self.session.query(NFTAsset).filter_by(asset_id=listing.nft_asset_id).first()
            if nft and nft.status == NFTAssetStatus.LISTED.value:
                nft.status = NFTAssetStatus.MINTED.value
        if expired:
            self.session.commit()

        query = self.session.query(NFTListing).filter_by(status=ListingStatus.ACTIVE.value)
        total_count = query.count()

        if sort_by == "price_ualgos":
            query = query.order_by(NFTListing.price_ualgos.asc())
        else:
            query = query.order_by(NFTListing.created_at.desc())

        listings = query.limit(limit).offset(offset).all()
        return listings, total_count

    def execute_trade(
        self,
        listing_id: str,
        buyer_address: str,
    ) -> NFTTrade:
        """Execute a trade: record the accepted price + transfer ownership.

        TestNet MVP: this is a DB-only atomic swap record. It does NOT sign or
        submit any on-chain transaction on the player's behalf -- the trade is
        recorded `pending` and a follow-up `confirm_trade` (once a real wallet
        signature + on-chain settlement exists) marks it `confirmed`.

        Args:
            listing_id: The listing to buy
            buyer_address: The buyer's Algorand address

        Returns:
            NFTTrade record with pending status (awaiting on-chain confirmation)

        Raises:
            MarketplaceError: If listing invalid, expired, or trade fails
        """
        listing = self.session.query(NFTListing).filter_by(id=listing_id).first()
        if not listing:
            raise MarketplaceError(f"Listing {listing_id} not found")

        if listing.status != ListingStatus.ACTIVE.value:
            raise MarketplaceError(f"Listing is {listing.status}, cannot buy")

        if listing.expires_at and listing.expires_at < datetime.utcnow():
            listing.status = ListingStatus.EXPIRED.value
            self.session.commit()
            raise MarketplaceError("Listing has expired")

        if buyer_address == listing.seller_address:
            raise MarketplaceError("Cannot buy your own listing")

        nft = self.session.query(NFTAsset).filter_by(asset_id=listing.nft_asset_id).first()
        if not nft:
            raise MarketplaceError(f"NFT {listing.nft_asset_id} not found")

        trade = NFTTrade(
            listing_id=listing_id,
            nft_asset_id=listing.nft_asset_id,
            buyer_address=buyer_address,
            seller_address=listing.seller_address,
            price_ualgos=listing.price_ualgos,
            status=NFTTradeStatus.PENDING.value,
        )
        self.session.add(trade)

        # Optimistic-lock serialization point: two concurrent buyers of the
        # same listing can't both commit `status = sold` here -- the loser
        # hits StaleDataError (registered app-wide -> 409) and never reaches
        # the ownership-transfer lines below.
        listing.status = ListingStatus.SOLD.value
        listing.sold_at = datetime.utcnow()

        nft.owner_address = buyer_address
        nft.status = NFTAssetStatus.MINTED.value

        self.session.commit()

        return trade

    def confirm_trade(self, trade_id: str, txid: str) -> NFTTrade:
        """Mark a trade as confirmed on-chain.

        Args:
            trade_id: The NFTTrade record
            txid: The Algorand transaction ID confirming the swap

        Returns:
            Updated NFTTrade with status=confirmed
        """
        trade = self.session.query(NFTTrade).filter_by(id=trade_id).first()
        if not trade:
            raise MarketplaceError(f"Trade {trade_id} not found")

        trade.status = NFTTradeStatus.CONFIRMED.value
        trade.txid = txid
        trade.confirmed_at = datetime.utcnow()

        self.session.commit()
        return trade

    def fail_trade(self, trade_id: str, error_msg: str) -> NFTTrade:
        """Mark a trade as failed and revert the listing + NFT ownership.

        Args:
            trade_id: The NFTTrade record
            error_msg: Error description

        Returns:
            Updated NFTTrade with status=failed
        """
        trade = self.session.query(NFTTrade).filter_by(id=trade_id).first()
        if not trade:
            raise MarketplaceError(f"Trade {trade_id} not found")

        trade.status = NFTTradeStatus.FAILED.value
        trade.error_message = error_msg

        listing = self.session.query(NFTListing).filter_by(id=trade.listing_id).first()
        if listing:
            listing.status = ListingStatus.ACTIVE.value
            listing.sold_at = None

        nft = self.session.query(NFTAsset).filter_by(asset_id=trade.nft_asset_id).first()
        if nft:
            nft.owner_address = trade.seller_address
            nft.status = NFTAssetStatus.LISTED.value

        self.session.commit()
        return trade

    def get_price_history(self, nft_asset_id: int, limit: int = 50) -> List[NFTTrade]:
        """Fetch completed trades for an NFT to show price history."""
        return (
            self.session.query(NFTTrade)
            .filter_by(nft_asset_id=nft_asset_id, status=NFTTradeStatus.CONFIRMED.value)
            .order_by(NFTTrade.confirmed_at.desc())
            .limit(limit)
            .all()
        )

    def get_floor_price(self) -> Optional[Decimal]:
        """Get the lowest currently active listing price (floor)."""
        listing = (
            self.session.query(NFTListing)
            .filter_by(status=ListingStatus.ACTIVE.value)
            .order_by(NFTListing.price_ualgos.asc())
            .first()
        )
        return listing.price_ualgos if listing else None

    def get_average_price_24h(self) -> Optional[Decimal]:
        """Get average trade price over the last 24 hours."""
        cutoff = datetime.utcnow() - timedelta(hours=24)
        trades = (
            self.session.query(NFTTrade)
            .filter(
                NFTTrade.status == NFTTradeStatus.CONFIRMED.value,
                NFTTrade.confirmed_at >= cutoff,
            )
            .all()
        )

        if not trades:
            return None

        total = sum(t.price_ualgos for t in trades)
        return total / len(trades)
