"""NFT marketplace and staking API endpoints.

Handles:
- GET /api/nft/collection — player's owned NFTs
- POST /api/nft/mint — mint a harvest to NFT
- GET /api/market/listings — browse marketplace
- POST /api/market/listings — create listing
- DELETE /api/market/listings/{id} — cancel listing
- POST /api/market/execute/{listing_id} — execute trade
- POST /api/stakes — create staking lock
- GET /api/stakes — list player's locks
- POST /api/stakes/{lock_id}/claim — claim rewards
"""

from flask import Blueprint, request, jsonify
from decimal import Decimal

from ..db import get_session
from ..db.models import Player, NFTAsset, NFTListing, StakingLock, Harvest
from ..services.nft_mint import NFTMintService, NFTMintError
from ..services.marketplace import MarketplaceService, MarketplaceError
from ..services.staking import StakingService, StakingError
from .auth import require_player, require_api_key
from .errors import GameError, bad_request
from .ratelimit import limiter

nft_bp = Blueprint("nft", __name__, url_prefix="/api/nft")
market_bp = Blueprint("market", __name__, url_prefix="/api/market")
stakes_bp = Blueprint("stakes", __name__, url_prefix="/api/stakes")


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


# ─────────────────────────────────────────────────────────────────────────────
# NFT Collection & Minting
# ─────────────────────────────────────────────────────────────────────────────


@nft_bp.get("/collection")
@require_player
def get_collection(player_id: str):
    """Get player's owned NFTs and their current status."""
    with get_session() as session:
        nfts = (
            session.query(NFTAsset)
            .filter_by(owner_address=(
                session.query(Player).filter_by(id=player_id).first().algorand_address
                if session.query(Player).filter_by(id=player_id).first().algorand_address
                else None
            ))
            .all()
        )

        return jsonify([
            {
                "asset_id": nft.asset_id,
                "type": nft.asset_type,
                "status": nft.status,
                "game_item_id": nft.game_item_id,
                "ipfs_hash": nft.ipfs_hash,
                "metadata": nft.metadata_snapshot,
                "minted_at": nft.created_at.isoformat(),
            }
            for nft in nfts
        ])


@nft_bp.post("/mint")
@require_player
@limiter.limit("10 per hour")
def mint_harvest(player_id: str):
    """Mint a harvest as an NFT.

    Body: { "harvest_id": str }
    Returns: { "asset_id": int, "ipfs_hash": str, "status": "minted" }
    """
    data = request.get_json() or {}
    harvest_id = data.get("harvest_id")
    if not harvest_id:
        return bad_request("harvest_id is required")

    with get_session() as session:
        player = session.query(Player).filter_by(id=player_id).first()
        if not player or not player.algorand_address:
            return _error("Wallet not connected", 403)

        harvest = session.query(Harvest).filter_by(
            id=harvest_id, player_id=player_id
        ).first()
        if not harvest:
            return _error("Harvest not found", 404)

        try:
            minter = NFTMintService(session)
            nft = minter.mint_harvest(harvest_id, player.algorand_address)
            return jsonify({
                "asset_id": nft.asset_id,
                "ipfs_hash": nft.ipfs_hash,
                "status": nft.status,
                "txid": nft.mint_txid,
            }), 201
        except NFTMintError as e:
            return _error(str(e), 400)


# ─────────────────────────────────────────────────────────────────────────────
# Marketplace Browsing & Listing
# ─────────────────────────────────────────────────────────────────────────────


@market_bp.get("/listings")
def get_listings():
    """Browse marketplace listings.

    Query params:
      - limit: max results (default 20)
      - offset: pagination (default 0)
      - sort: price_ualgos or created_at (default created_at)
    """
    limit = min(int(request.args.get("limit", 20)), 100)
    offset = int(request.args.get("offset", 0))
    sort_by = request.args.get("sort", "created_at")

    with get_session() as session:
        service = MarketplaceService(session)
        listings, total = service.get_active_listings(limit, offset, sort_by)

        return jsonify({
            "listings": [
                {
                    "listing_id": l.id,
                    "asset_id": l.nft_asset_id,
                    "seller": l.seller_address[:10] + "…",
                    "price_ualgos": str(l.price_ualgos),
                    "created_at": l.created_at.isoformat(),
                    "expires_at": l.expires_at.isoformat() if l.expires_at else None,
                }
                for l in listings
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        })


@market_bp.get("/listings/<listing_id>")
def get_listing_detail(listing_id: str):
    """Get details for a specific listing."""
    with get_session() as session:
        listing = session.query(NFTListing).filter_by(id=listing_id).first()
        if not listing:
            return _error("Listing not found", 404)

        nft = session.query(NFTAsset).filter_by(asset_id=listing.nft_asset_id).first()
        return jsonify({
            "listing_id": listing.id,
            "asset_id": listing.nft_asset_id,
            "seller": listing.seller_address,
            "price_ualgos": str(listing.price_ualgos),
            "status": listing.status,
            "nft_metadata": nft.metadata_snapshot if nft else None,
            "created_at": listing.created_at.isoformat(),
            "expires_at": listing.expires_at.isoformat() if listing.expires_at else None,
        })


@market_bp.post("/listings")
@require_player
@limiter.limit("30 per hour")
def create_listing(player_id: str):
    """Create a marketplace listing.

    Body: { "asset_id": int, "price_ualgos": str }
    """
    data = request.get_json() or {}
    asset_id = data.get("asset_id")
    price_str = data.get("price_ualgos")

    if not asset_id or not price_str:
        return bad_request("asset_id and price_ualgos required")

    try:
        price = Decimal(price_str)
        if price <= 0:
            return bad_request("price must be positive")
    except:
        return bad_request("price_ualgos must be a valid decimal")

    with get_session() as session:
        player = session.query(Player).filter_by(id=player_id).first()
        if not player or not player.algorand_address:
            return _error("Wallet not connected", 403)

        try:
            service = MarketplaceService(session)
            listing = service.create_listing(
                asset_id,
                player.algorand_address,
                price,
            )
            return jsonify({
                "listing_id": listing.id,
                "asset_id": listing.nft_asset_id,
                "price_ualgos": str(listing.price_ualgos),
                "status": listing.status,
            }), 201
        except MarketplaceError as e:
            return _error(str(e), 400)


@market_bp.delete("/listings/<listing_id>")
@require_player
@limiter.limit("30 per hour")
def cancel_listing(player_id: str, listing_id: str):
    """Cancel an active listing."""
    with get_session() as session:
        player = session.query(Player).filter_by(id=player_id).first()
        if not player:
            return _error("Player not found", 404)

        try:
            service = MarketplaceService(session)
            service.cancel_listing(listing_id, player.algorand_address or "")
            return jsonify({"status": "cancelled"}), 200
        except MarketplaceError as e:
            return _error(str(e), 400)


@market_bp.post("/execute/<listing_id>")
@require_player
@limiter.limit("10 per hour")
def execute_trade(player_id: str, listing_id: str):
    """Execute a trade (buy a listing).

    Returns pending trade awaiting on-chain confirmation.
    """
    with get_session() as session:
        player = session.query(Player).filter_by(id=player_id).first()
        if not player or not player.algorand_address:
            return _error("Wallet not connected", 403)

        try:
            service = MarketplaceService(session)
            trade = service.execute_trade(listing_id, player.algorand_address)
            return jsonify({
                "trade_id": trade.id,
                "listing_id": trade.listing_id,
                "status": trade.status,
                "price_ualgos": str(trade.price_ualgos),
                "created_at": trade.created_at.isoformat(),
            }), 201
        except MarketplaceError as e:
            return _error(str(e), 400)


@market_bp.get("/history/<asset_id>")
def get_price_history(asset_id: str):
    """Get price history for an asset."""
    try:
        asset_id_int = int(asset_id)
    except:
        return bad_request("asset_id must be an integer")

    with get_session() as session:
        service = MarketplaceService(session)
        trades = service.get_price_history(asset_id_int)

        return jsonify([
            {
                "trade_id": t.id,
                "price_ualgos": str(t.price_ualgos),
                "confirmed_at": t.confirmed_at.isoformat() if t.confirmed_at else None,
            }
            for t in trades
        ])


# ─────────────────────────────────────────────────────────────────────────────
# Staking / Curing Room
# ─────────────────────────────────────────────────────────────────────────────


@stakes_bp.post("")
@require_player
@limiter.limit("20 per hour")
def create_stake(player_id: str):
    """Lock an NFT for curing.

    Body: { "asset_id": int, "harvest_id": str }
    """
    data = request.get_json() or {}
    asset_id = data.get("asset_id")
    harvest_id = data.get("harvest_id")

    if not asset_id or not harvest_id:
        return bad_request("asset_id and harvest_id required")

    with get_session() as session:
        harvest = session.query(Harvest).filter_by(
            id=harvest_id, player_id=player_id
        ).first()
        if not harvest:
            return _error("Harvest not found", 404)

        try:
            service = StakingService(session)
            lock = service.create_lock(asset_id, player_id, harvest_id)
            return jsonify({
                "lock_id": lock.id,
                "asset_id": lock.nft_asset_id,
                "status": lock.status,
                "cure_end_at": lock.cure_end_at.isoformat(),
                "rewards_amount": str(lock.rewards_amount) if lock.rewards_amount else "0",
            }), 201
        except StakingError as e:
            return _error(str(e), 400)


@stakes_bp.get("")
@require_player
def get_stakes(player_id: str):
    """Get player's staking locks."""
    with get_session() as session:
        service = StakingService(session)
        locks = service.get_player_locks(player_id)

        locks_data = []
        for lock in locks:
            progress_info = service.get_lock_progress(lock.id)
            locks_data.append({
                "lock_id": lock.id,
                "asset_id": lock.nft_asset_id,
                "status": lock.status,
                "cure_started_at": lock.cure_start_at.isoformat(),
                "cure_ends_at": lock.cure_end_at.isoformat(),
                "progress_pct": progress_info.get("progress_pct", 0),
                "time_remaining_seconds": progress_info.get("time_remaining_seconds", 0),
                "rewards_amount": str(lock.rewards_amount) if lock.rewards_amount else "0",
                "can_claim": progress_info.get("can_claim", False),
            })

        return jsonify(locks_data)


@stakes_bp.get("/<lock_id>")
@require_player
def get_stake_progress(player_id: str, lock_id: str):
    """Get progress for a specific stake."""
    with get_session() as session:
        lock = session.query(StakingLock).filter_by(id=lock_id).first()
        if not lock or lock.player_id != player_id:
            return _error("Stake not found", 404)

        service = StakingService(session)
        progress = service.get_lock_progress(lock_id)
        return jsonify(progress)


@stakes_bp.post("/<lock_id>/claim")
@require_player
@limiter.limit("20 per hour")
def claim_stake_rewards(player_id: str, lock_id: str):
    """Claim rewards from a completed stake."""
    with get_session() as session:
        try:
            service = StakingService(session)
            amount = service.claim_rewards(lock_id, player_id)
            return jsonify({
                "lock_id": lock_id,
                "rewards_claimed": str(amount),
                "status": "withdrawn",
            })
        except StakingError as e:
            return _error(str(e), 400)
