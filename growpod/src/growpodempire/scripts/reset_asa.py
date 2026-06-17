"""
Reset the in-game GROW token ASA.

Destroys the currently configured ASA (if the treasury can) and mints a fresh
one, printing the new asset id. Player balances live in the DB ledger and are
NOT affected — only the on-chain mirror is replaced.

Usage (TestNet):
    export ALGO_TREASURY_MNEMONIC="..."          # funded TestNet account
    export ALGOD_URL="https://testnet-api.algonode.cloud"
    export ASA_ID=123456                          # optional: old asset to destroy
    python -m growpodempire.scripts.reset_asa

Then set ASA_ID to the printed value in your environment / secret store.

With no treasury configured (or USE_MOCK_CHAIN=true) this runs against the
offline mock chain so the flow can be exercised without network or funds.
"""

import sys

from ..config import get_settings
from ..economy.config import get_economy_config
from ..chain.factory import get_chain_provider
from ..chain.token import reset_token_asa


def main() -> int:
    settings = get_settings()
    cfg = get_economy_config()
    provider = get_chain_provider(settings)

    print(f"Chain provider: {provider.network()}")
    if settings.asa_id:
        print(f"Destroying old ASA {settings.asa_id} (if owned by treasury)...")

    new_id = reset_token_asa(provider, cfg, old_asset_id=settings.asa_id)
    print("")
    print(f"New GROW ASA id: {new_id}")
    print("Set this as ASA_ID in your environment / secret store.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
