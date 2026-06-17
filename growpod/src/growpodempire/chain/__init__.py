"""
Algorand on-chain layer (Phase 3).

A provider abstraction lets the game logic (mint eligibility, idempotency, DB
<-> chain reconciliation) be fully tested against an offline MockChainProvider,
while a real algosdk-backed AlgorandProvider talks to TestNet when a treasury is
configured. The DB is always the source of truth; chain actions are mirrored.
"""

from .provider import ChainProvider, AssetInfo, ChainError
from .mock import MockChainProvider
from .factory import get_chain_provider, shared_provider, reset_shared_provider
from .token import create_token_asa, reset_token_asa

__all__ = [
    "ChainProvider",
    "AssetInfo",
    "ChainError",
    "MockChainProvider",
    "get_chain_provider",
    "shared_provider",
    "reset_shared_provider",
    "create_token_asa",
    "reset_token_asa",
]
