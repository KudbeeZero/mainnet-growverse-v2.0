"""NFT marketplace and staking API endpoints (Sprint 4, testnet/mock only).

Handles:
- GET    /api/nft/players/<player_id>/collection        — player's owned NFTs
- POST   /api/nft/players/<player_id>/mint               — mint/wrap a harvest as NFT
- GET    /api/market/listings                            — browse marketplace
- GET    /api/market/listings/<listing_id>                — listing detail
- POST   /api/market/players/<player_id>/listings         — create a listing
- DELETE /api/market/players/<player_id>/listings/<id>     — cancel a listing
- POST   /api/market/players/<player_id>/execute/<id>      — buy a listing
- GET    /api/market/history/<asset_id>                   — price history
- POST   /api/stakes/players/<player_id>                  — create staking lock
- GET    /api/stakes/players/<player_id>                  — list player's locks
- GET    /api/stakes/players/<player_id>/<lock_id>         — a lock's progress
- POST   /api/stakes/players/<player_id>/<lock_id>/claim   — claim rewards

Every route here is gated behind a feature flag (OFF by default -- see
balance.yaml's `nft_marketplace` / `nft_staking` entries): `nft_bp` and
`market_bp` share "nft_marketplace" (browsing/minting/trading are one
surface); `stakes_bp` (the curing room) is the separate "nft_staking" flag, so
the owner can enable trading without also turning on staking, or vice versa.
"""

from decimal import Decimal, InvalidOperation
from typing import Optional

from flask import Blueprint, request, jsonify

from ..db.session import session_scope
from ..db.models import Player, NFTAsset, NFTListing, StakingLock
from ..feature_flags import FeatureDisabledError, feature_required as require_feature
from ..services.nft_mint import NFTMintService, NFTMintError
from ..services.marketplace import MarketplaceService, MarketplaceError
from ..services.staking import StakingService, StakingError
from .auth import require_player

nft_bp = Blueprint("nft", __name__, url_prefix="/api/nft")
market_bp = Blueprint("market", __name__, url_prefix="/api/market")
stakes_bp = Blueprint("stakes", __name__, url_prefix="/api/stakes")


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def _handle_feature_disabled(exc: FeatureDisabledError):
    return _error(str(exc), 404)


nft_bp.errorhandler(FeatureDisabledError)(_handle_feature_disabled)
market_bp.errorhandler(FeatureDisabledError)(_handle_feature_disabled)
stakes_bp.errorhandler(FeatureDisabledError)(_handle_feature_disabled)


def _asset_dict(nft: NFTAsset, active_listing_id: Optional[str] = None) -> dict:
    return {
        "asset_id": nft.asset_id,
        "type": nft.asset_type,
        "status": nft.status,
        "game_item_id": nft.game_item_id,
        "ipfs_hash": nft.ipfs_hash,
        "metadata": nft.metadata_snapshot,
        "minted_at": nft.created_at.isoformat(),
        # Set only when status == "listed" -- the web client needs this to
        # cancel/delist without a separate "find my listing" lookup.
        "listing_id": active_listing_id,
    }


def _listing_dict(listing: NFTListing) -> dict:
    return {
        "listing_id": listing.id,
        "asset_id": listing.nft_asset_id,
        "seller_address": listing.seller_address,
        "price_ualgos": str(listing.price_ualgos),
        "status": listing.status,
        "created_at": listing.created_at.isoformat(),
        "expires_at": listing.expires_at.isoformat() if listing.expires_at else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# NFT Collection & Minting
# ─────────────────────────────────────────────────────────────────────────────


@nft_bp.get("/players/<player_id>/collection")
@require_feature("nft_marketplace")
@require_player
def get_collection(player_id: str):
    """Get player's owned NFTs and their current status."""
    with session_scope() as session:
        player = session.get(Player, player_id)
        if not player or not player.algorand_address:
            return jsonify([])

        nfts = (
            session.query(NFTAsset)
            .filter_by(owner_address=player.algorand_address)
            .order_by(NFTAsset.created_at.desc())
            .all()
        )

        result = []
        for n in nfts:
            listing_id = None
            if n.status == "listed":
                listing = (
                    session.query(NFTListing)
                    .filter_by(nft_asset_id=n.asset_id, status="active")
                    .first()
                )
                listing_id = listing.id if listing else None
            result.append(_asset_dict(n, listing_id))
        return jsonify(result)


@nft_bp.post("/players/<player_id>/mint")
@require_feature("nft_marketplace")
@require_player
def mint_harvest(player_id: str):
    """Mint/wrap a harvest as a marketplace-ready NFT.

    Body: { "harvest_id": str }
    Returns: { "asset_id": int, "ipfs_hash": str, "status": "minted" }
    """
    data = request.get_json(force=True, silent=True) or {}
    harvest_id = data.get("harvest_id")
    if not harvest_id:
        return _error("harvest_id is required")

    with session_scope() as session:
        player = session.get(Player, player_id)
        if not player or not player.algorand_address:
            # C9: Friendly "link your wallet" CTA instead of raw 403
            return _error(
                "Link your Algorand wallet to list harvests on the marketplace",
                403
            )

        try:
            minter = NFTMintService(session)
            nft = minter.mint_harvest(player_id, harvest_id, player.algorand_address)
            return jsonify(_asset_dict(nft)), 201
        except NFTMintError as e:
            return _error(str(e), 400)


# ─────────────────────────────────────────────────────────────────────────────
# Marketplace Browsing & Listing
# ─────────────────────────────────────────────────────────────────────────────


@market_bp.get("/listings")
@require_feature("nft_marketplace")
def get_listings():
    """Browse marketplace listings.

    Query params:
      - limit: max results (default 20, capped at 100)
      - offset: pagination (default 0)
      - sort: price_ualgos or created_at (default created_at)
    """
    try:
        limit = min(int(request.args.get("limit", 20)), 100)
        offset = max(int(request.args.get("offset", 0)), 0)
    except (TypeError, ValueError):
        return _error("limit/offset must be integers")
    sort_by = request.args.get("sort", "created_at")

    with session_scope() as session:
        service = MarketplaceService(session)
        listings, total = service.get_active_listings(limit, offset, sort_by)
        return jsonify({
            "listings": [_listing_dict(l) for l in listings],
            "total": total,
            "limit": limit,
            "offset": offset,
        })


@market_bp.get("/listings/<listing_id>")
@require_feature("nft_marketplace")
def get_listing_detail(listing_id: str):
    """Get details for a specific listing."""
    with session_scope() as session:
        listing = session.get(NFTListing, listing_id)
        if not listing:
            return _error("Listing not found", 404)

        nft = session.query(NFTAsset).filter_by(asset_id=listing.nft_asset_id).first()
        payload = _listing_dict(listing)
        payload["nft_metadata"] = nft.metadata_snapshot if nft else None
        return jsonify(payload)


@market_bp.post("/players/<player_id>/listings")
@require_feature("nft_marketplace")
@require_player
def create_listing(player_id: str):
    """Create a marketplace listing.

    Body: { "asset_id": int, "price_ualgos": str }
    """
    data = request.get_json(force=True, silent=True) or {}
    asset_id = data.get("asset_id")
    price_str = data.get("price_ualgos")

    if not asset_id or not price_str:
        return _error("asset_id and price_ualgos are required")

    try:
        price = Decimal(str(price_str))
        if price <= 0:
            return _error("price_ualgos must be positive")
    except InvalidOperation:
        return _error("price_ualgos must be a valid decimal")

    with session_scope() as session:
        player = session.get(Player, player_id)
        if not player or not player.algorand_address:
            return _error("Algorand wallet not connected", 403)

        try:
            service = MarketplaceService(session)
            listing = service.create_listing(int(asset_id), player.algorand_address, price)
            return jsonify(_listing_dict(listing)), 201
        except MarketplaceError as e:
            return _error(str(e), 400)


@market_bp.delete("/players/<player_id>/listings/<listing_id>")
@require_feature("nft_marketplace")
@require_player
def cancel_listing(player_id: str, listing_id: str):
    """Cancel an active listing."""
    with session_scope() as session:
        player = session.get(Player, player_id)
        if not player:
            return _error("Player not found", 404)

        try:
            service = MarketplaceService(session)
            service.cancel_listing(listing_id, player.algorand_address or "")
            return jsonify({"status": "cancelled"})
        except MarketplaceError as e:
            return _error(str(e), 400)


@market_bp.post("/players/<player_id>/execute/<listing_id>")
@require_feature("nft_marketplace")
@require_player
def execute_trade(player_id: str, listing_id: str):
    """Execute a trade (buy a listing). Returns a pending trade awaiting
    on-chain confirmation (see MarketplaceService.execute_trade)."""
    with session_scope() as session:
        player = session.get(Player, player_id)
        if not player or not player.algorand_address:
            return _error("Algorand wallet not connected", 403)

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
@require_feature("nft_marketplace")
def get_price_history(asset_id: str):
    """Get price history for an asset."""
    try:
        asset_id_int = int(asset_id)
    except ValueError:
        return _error("asset_id must be an integer")

    with session_scope() as session:
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


@stakes_bp.post("/players/<player_id>")
@require_feature("nft_staking")
@require_player
def create_stake(player_id: str):
    """Lock an NFT for curing.

    Body: { "asset_id": int, "harvest_id": str }
    """
    data = request.get_json(force=True, silent=True) or {}
    asset_id = data.get("asset_id")
    harvest_id = data.get("harvest_id")

    if not asset_id or not harvest_id:
        return _error("asset_id and harvest_id are required")

    with session_scope() as session:
        try:
            service = StakingService(session)
            lock = service.create_lock(int(asset_id), player_id, harvest_id)
            return jsonify({
                "lock_id": lock.id,
                "asset_id": lock.nft_asset_id,
                "status": lock.status,
                "cure_end_at": lock.cure_end_at.isoformat(),
                "rewards_amount": str(lock.rewards_amount) if lock.rewards_amount else "0",
            }), 201
        except StakingError as e:
            return _error(str(e), 400)


@stakes_bp.get("/players/<player_id>")
@require_feature("nft_staking")
@require_player
def get_stakes(player_id: str):
    """Get player's staking locks."""
    with session_scope() as session:
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


@stakes_bp.get("/players/<player_id>/<lock_id>")
@require_feature("nft_staking")
@require_player
def get_stake_progress(player_id: str, lock_id: str):
    """Get progress for a specific stake."""
    with session_scope() as session:
        lock = session.get(StakingLock, lock_id)
        if not lock or lock.player_id != player_id:
            return _error("Stake not found", 404)

        service = StakingService(session)
        return jsonify(service.get_lock_progress(lock_id))


@stakes_bp.post("/players/<player_id>/<lock_id>/claim")
@require_feature("nft_staking")
@require_player
def claim_stake_rewards(player_id: str, lock_id: str):
    """Claim rewards from a completed stake."""
    with session_scope() as session:
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
