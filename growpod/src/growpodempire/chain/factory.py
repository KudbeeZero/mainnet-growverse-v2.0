"""
Selects the chain provider based on configuration.

Returns a real AlgorandProvider when a treasury mnemonic is configured (and the
mock isn't forced); otherwise an offline MockChainProvider so the app and tests
run with no network or secrets.
"""

from typing import Optional

from ..config import get_settings
from .provider import ChainProvider
from .mock import MockChainProvider


def get_chain_provider(settings=None) -> ChainProvider:
    settings = settings or get_settings()

    if settings.use_mock_chain or not settings.algo_treasury_mnemonic:
        return MockChainProvider()

    # Real chain configured — import lazily so MockChainProvider users never
    # need algosdk present.
    from .algorand import AlgorandProvider

    return AlgorandProvider(
        algod_url=settings.algod_url,
        algod_token=settings.algod_token,
        treasury_mnemonic=settings.algo_treasury_mnemonic,
        network_name=settings.algorand_network,
    )


# Process-wide singleton so a MockChainProvider keeps its in-memory state across
# requests within one process (e.g. the Flask app / a test run).
_provider: Optional[ChainProvider] = None


def shared_provider(settings=None) -> ChainProvider:
    global _provider
    if _provider is None:
        _provider = get_chain_provider(settings)
    return _provider


def reset_shared_provider() -> None:
    global _provider
    _provider = None
