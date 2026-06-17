"""
Internal chain blueprint: on-chain mint helpers called by the TypeScript
api-server (Clone Room).

The TS api-server owns the authoritative plant_seeds rows; this endpoint is a
thin, stateless wrapper over the chain provider that materializes a seed as an
Algorand ASA and returns the asset id + txid for the TS side to persist. It does
NOT touch the SQLAlchemy game DB. Admin-gated and feature-gated ("chain"); CI
runs against the offline mock provider, so no key or network is required.
"""

from flask import Blueprint, request, jsonify

from ..chain.factory import shared_provider
from ..chain import metadata as md
from ..chain.provider import ChainError
from ..feature_flags import feature_required as require_feature
from .auth import require_admin

chain_bp = Blueprint("chain", __name__, url_prefix="/api/chain")


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


@chain_bp.post("/mint-seed")
@require_feature("chain")
@require_admin
def mint_seed():
    """Mint a Clone Room seed as an ASA.

    Body: the plant_seeds row as JSON (seedId, ownerAddress, blockHash, nonce,
    traits, generationNum, parentSeedId). Returns { assetId, txId, network }.
    Stateless and idempotency-free: the TS caller only mints when asaId is null.
    """
    seed = request.get_json(force=True, silent=True) or {}

    if not seed.get("ownerAddress"):
        return _error("ownerAddress is required")
    if not seed.get("traits"):
        return _error("traits is required")

    metadata = md.seed_metadata(seed)
    try:
        provider = shared_provider()
        mint = provider.create_asset_tx(
            unit_name="GPSEED",
            asset_name=metadata["name"][:32],
            total=1,
            decimals=0,
            url=None,
            metadata_hash=md.metadata_hash(metadata),
        )
    except ChainError as exc:
        return _error(f"On-chain mint failed: {exc}", 502)

    return (
        jsonify(
            {
                "assetId": mint.asset_id,
                "txId": mint.txid,
                "network": provider.network(),
            }
        ),
        201,
    )
