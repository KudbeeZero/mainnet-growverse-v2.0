"""Marketplace service — manage NFT listings and trades.

Handles listing creation/cancellation, atomic swap execution, price history,
and on-chain settlement verification.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from ..chain.factory import shared_provider
from ..chain.provider import ChainError
from ..db.models import NFTAsset, NFTListing, NFTTrade, LedgerEntry, Player
from ..services.ledger import LedgerService


class MarketplaceError(Exception):
    """Marketplace operation failed."""

    pass


class MarketplaceService:
    def __init__(self, session: Session):
        self.session = session
        self.ledger = LedgerService(session)

    def create_listing(
        self,
        nft_asset_id: int,
        seller_address: str,
        price_ualgos: Decimal,
        expires_in_days: int = 7,
    ) -> NFTListing:
        """Create a new marketplace listing.

        Args:
            nft_asset_id: The ASA ID to list
            seller_address: The Algorand address of the seller
            price_ualgos: Price in microAlgos (1 ALGO = 1,000,000 µA)
            expires_in_days: How many days until listing expires

        Returns:
            NFTListing record

        Raises:
            MarketplaceError: If NFT not found, already listed, or in staking
        """
        nft = self.session.query(NFTAsset).filter_by(asset_id=nft_asset_id).first()
        if not nft:
            raise MarketplaceError(f"NFT asset {nft_asset_id} not found")

        if nft.status == "staking":
            raise MarketplaceError(f"Asset {nft_asset_id} is currently staked and cannot be listed")

        if nft.status == "listed":
            raise MarketplaceError(f"Asset {nft_asset_id} is already listed")

        if nft.owner_address != seller_address:
            raise MarketplaceError(f"Only the owner can list this NFT")

        listing = NFTListing(
            nft_asset_id=nft_asset_id,
            seller_address=seller_address,
            price_ualgos=price_ualgos,
            status="active",
            expires_at=datetime.utcnow() + timedelta(days=expires_in_days),
        )
        self.session.add(listing)

        nft.status = "listed"
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

        if listing.status != "active":
            raise MarketplaceError(f"Listing status is {listing.status}, cannot cancel")

        listing.status = "cancelled"
        nft = self.session.query(NFTAsset).filter_by(asset_id=listing.nft_asset_id).first()
        if nft:
            nft.status = "minted"

        self.session.commit()

    def get_active_listings(
        self,
        limit: int = 20,
        offset: int = 0,
        sort_by: str = "created_at",
    ) -> tuple[List[NFTListing], int]:
        """Fetch active marketplace listings.

        Args:
            limit: Max results to return
            offset: Pagination offset
            sort_by: Sort column (created_at, price_ualgos)

        Returns:
            (listings, total_count)
        """
        query = self.session.query(NFTListing).filter_by(status="active")

        # Check for expired listings and mark them
        now = datetime.utcnow()
        expired = query.filter(NFTListing.expires_at < now).all()
        for listing in expired:
            listing.status = "expired"
        self.session.commit()

        # Re-query for active only
        query = self.session.query(NFTListing).filter_by(status="active")
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
        """Execute an atomic trade: transfer ASA to buyer + settle payment.

        In TestNet this creates an NFTTrade record; in production this would
        execute a signed atomic swap on-chain.

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

        if listing.status != "active":
            raise MarketplaceError(f"Listing is {listing.status}, cannot buy")

        if listing.expires_at and listing.expires_at < datetime.utcnow():
            listing.status = "expired"
            self.session.commit()
            raise MarketplaceError("Listing has expired")

        if buyer_address == listing.seller_address:
            raise MarketplaceError("Cannot buy your own listing")

        nft = self.session.query(NFTAsset).filter_by(asset_id=listing.nft_asset_id).first()
        if not nft:
            raise MarketplaceError(f"NFT {listing.nft_asset_id} not found")

        # Create trade record
        trade = NFTTrade(
            listing_id=listing_id,
            nft_asset_id=listing.nft_asset_id,
            buyer_address=buyer_address,
            seller_address=listing.seller_address,
            price_ualgos=listing.price_ualgos,
            status="pending",
        )
        self.session.add(trade)

        listing.status = "sold"
        listing.sold_at = datetime.utcnow()

        # Update NFT owner
        nft.owner_address = buyer_address
        nft.status = "minted"

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

        trade.status = "confirmed"
        trade.txid = txid
        trade.confirmed_at = datetime.utcnow()

        self.session.commit()
        return trade

    def fail_trade(self, trade_id: str, error_msg: str) -> NFTTrade:
        """Mark a trade as failed.

        Args:
            trade_id: The NFTTrade record
            error_msg: Error description

        Returns:
            Updated NFTTrade with status=failed
        """
        trade = self.session.query(NFTTrade).filter_by(id=trade_id).first()
        if not trade:
            raise MarketplaceError(f"Trade {trade_id} not found")

        trade.status = "failed"
        trade.error_message = error_msg

        # Revert listing and NFT status
        listing = self.session.query(NFTListing).filter_by(id=trade.listing_id).first()
        if listing:
            listing.status = "active"
            listing.sold_at = None

        nft = self.session.query(NFTAsset).filter_by(asset_id=trade.nft_asset_id).first()
        if nft:
            nft.owner_address = trade.seller_address
            nft.status = "listed"

        self.session.commit()
        return trade

    def get_price_history(self, nft_asset_id: int, limit: int = 50) -> List[NFTTrade]:
        """Fetch completed trades for an NFT to show price history.

        Args:
            nft_asset_id: The ASA ID
            limit: Max records to return

        Returns:
            List of confirmed trades, most recent first
        """
        return (
            self.session.query(NFTTrade)
            .filter_by(nft_asset_id=nft_asset_id, status="confirmed")
            .order_by(NFTTrade.confirmed_at.desc())
            .limit(limit)
            .all()
        )

    def get_floor_price(self) -> Optional[Decimal]:
        """Get the lowest currently active listing price (floor)."""
        listing = (
            self.session.query(NFTListing)
            .filter_by(status="active")
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
                NFTTrade.status == "confirmed",
                NFTTrade.confirmed_at >= cutoff,
            )
            .all()
        )

        if not trades:
            return None

        total = sum(t.price_ualgos for t in trades)
        return total / len(trades)
