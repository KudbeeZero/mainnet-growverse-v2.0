"""Shared helper for tests that need a linked wallet as setup, not as the
thing under test (see test_wallet_challenge.py for the signed-challenge
verification coverage itself). Drives the real challenge -> sign -> link
flow with a keypair the test already holds the private key for."""

import base64

from nacl.signing import SigningKey


def link_wallet_for_test(svc, player_id: str, priv_b64: str, address: str):
    challenge = svc.create_wallet_challenge(player_id, address)
    seed = base64.b64decode(priv_b64)[:32]
    signature_bytes = SigningKey(seed).sign(challenge["message"].encode("utf-8")).signature
    signature = base64.b64encode(signature_bytes).decode()
    return svc.link_wallet(player_id, address, challenge["nonce"], signature)
