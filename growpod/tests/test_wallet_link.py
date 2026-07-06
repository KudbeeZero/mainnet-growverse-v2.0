"""Algorand wallet connect/disconnect (login/out): link validation + unlink.

Linking now requires a signed challenge (see test_wallet_challenge.py for the
signature-verification coverage); these tests cover the surrounding
validation and the unlink path."""

import base64
import os
import sys

import pytest
from algosdk import account
from nacl.signing import SigningKey

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.services.game_service import GameService, GameError


def _sign(message: str, priv_b64: str) -> str:
    seed = base64.b64decode(priv_b64)[:32]
    sig = SigningKey(seed).sign(message.encode("utf-8")).signature
    return base64.b64encode(sig).decode()


def _linked(svc, player_id, priv, addr):
    challenge = svc.create_wallet_challenge(player_id, addr)
    signature = _sign(challenge["message"], priv)
    return svc.link_wallet(player_id, addr, challenge["nonce"], signature)


def test_link_valid_address_then_unlink(session):
    svc = GameService(session)
    p = svc.create_player("w1")
    priv, addr = account.generate_account()  # a real, checksum-valid address

    linked = _linked(svc, p.id, priv, addr)
    assert linked.algorand_address == addr

    cleared = svc.unlink_wallet(p.id)
    assert cleared.algorand_address is None


def test_link_trims_whitespace(session):
    svc = GameService(session)
    p = svc.create_player("w2")
    priv, addr = account.generate_account()
    padded = f"  {addr}  "

    challenge = svc.create_wallet_challenge(p.id, padded)
    signature = _sign(challenge["message"], priv)
    linked = svc.link_wallet(p.id, padded, challenge["nonce"], signature)
    assert linked.algorand_address == addr


def test_challenge_rejects_invalid_address(session):
    svc = GameService(session)
    p = svc.create_player("w3")
    with pytest.raises(GameError):
        svc.create_wallet_challenge(p.id, "not-a-real-algorand-address")


def test_challenge_rejects_empty(session):
    svc = GameService(session)
    p = svc.create_player("w4")
    with pytest.raises(GameError):
        svc.create_wallet_challenge(p.id, "   ")


def test_unlink_is_idempotent(session):
    svc = GameService(session)
    p = svc.create_player("w5")
    # Not linked → no error, stays None.
    svc.unlink_wallet(p.id)
    assert svc.get_player(p.id).algorand_address is None
