"""Wallet ownership verification for signed link challenges.

Pera/Defly/Lute's `signData` (ARC-60 arbitrary-data signing) signs the raw
bytes handed to it -- no domain-separation prefix. That's *different* from
algosdk's `util.sign_bytes`/`verify_bytes`, which prepend "MX" (the scheme
used for on-chain tooling, not wallet-initiated arbitrary signing). Verify
against the raw challenge bytes to match what the wallet actually produced.
"""

import base64

from algosdk import encoding
from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey


def verify_wallet_signature(message: str, signature_b64: str, address: str) -> bool:
    """True iff `signature_b64` is a valid ed25519 signature over `message`
    (utf-8, unprefixed) by the private key controlling `address`."""
    if not address or not encoding.is_valid_address(address):
        return False
    try:
        verify_key = VerifyKey(encoding.decode_address(address))
        verify_key.verify(message.encode("utf-8"), base64.b64decode(signature_b64))
        return True
    except (BadSignatureError, ValueError, TypeError):
        return False


def build_challenge_message(player_id: str, address: str, nonce: str) -> str:
    """The exact text the player's wallet must sign. Deterministic from the
    challenge row's fields so we never need to persist the message itself."""
    return (
        "GrowVerse wallet link\n"
        f"Player: {player_id}\n"
        f"Address: {address}\n"
        f"Nonce: {nonce}\n"
        "This signature only proves wallet ownership -- it is not a transaction "
        "and moves no funds."
    )
