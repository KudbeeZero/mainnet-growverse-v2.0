"""
The in-game GROW currency as an Algorand ASA.

The DB ledger stays authoritative for gameplay; the ASA is a settlement/mirror
layer. "Resetting" the ASA simply mints a fresh asset and records its new id —
player balances in the DB are untouched, so a reset is always safe.
"""

from typing import Optional

from .provider import ChainProvider, ChainError


def create_token_asa(provider: ChainProvider, cfg) -> int:
    """Create the GROW token ASA from the balance.yaml `chain.token` config."""
    token = cfg.raw.get("chain", {}).get("token", {})
    return provider.create_asset(
        unit_name=token.get("unit_name", "GROW")[:8],
        asset_name=token.get("asset_name", "GrowCoin")[:32],
        total=int(token.get("total", 10**15)),
        decimals=int(token.get("decimals", 6)),
    )


def reset_token_asa(
    provider: ChainProvider, cfg, old_asset_id: Optional[int] = None
) -> int:
    """Destroy the old GROW ASA (if held by the treasury) and mint a new one.

    Returns the new asset id. The caller is responsible for persisting it
    (e.g. updating the ASA_ID secret/env). Failure to destroy the old asset is
    non-fatal on TestNet — the new asset still supersedes it.
    """
    if old_asset_id:
        try:
            provider.destroy_asset(old_asset_id)
        except ChainError:
            # Old asset may have circulating units or already be gone; the DB
            # ledger is authoritative, so abandoning it is safe.
            pass
    return create_token_asa(provider, cfg)
