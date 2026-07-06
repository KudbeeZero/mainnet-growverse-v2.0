"""Signed-challenge wallet linking (disruptor-sweep finding #4: wallet-address
hijack). A bare address string used to be enough to link a wallet; now the
caller must sign a server-issued nonce with the address's private key."""

import base64
import os
import sys

import pytest
from algosdk import account
from nacl.signing import SigningKey

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.services.game_service import GameService, GameError
from growpodempire.simulation.clock import FrozenClock
from datetime import datetime


def _sign(message: str, priv_b64: str) -> str:
    """Produce the raw (unprefixed) ed25519 signature a wallet's `signData`
    (ARC-60 arbitrary-data signing) would return for `message`."""
    seed = base64.b64decode(priv_b64)[:32]
    sig = SigningKey(seed).sign(message.encode("utf-8")).signature
    return base64.b64encode(sig).decode()


def test_challenge_then_link_happy_path(session):
    svc = GameService(session)
    p = svc.create_player("wc1")
    priv, addr = account.generate_account()

    challenge = svc.create_wallet_challenge(p.id, addr)
    signature = _sign(challenge["message"], priv)

    linked = svc.link_wallet(p.id, addr, challenge["nonce"], signature)
    assert linked.algorand_address == addr


def test_link_rejects_missing_nonce_or_signature(session):
    svc = GameService(session)
    p = svc.create_player("wc2")
    _priv, addr = account.generate_account()
    with pytest.raises(GameError):
        svc.link_wallet(p.id, addr, "", "")


def test_link_rejects_bad_signature(session):
    svc = GameService(session)
    p = svc.create_player("wc3")
    priv, addr = account.generate_account()
    challenge = svc.create_wallet_challenge(p.id, addr)

    other_priv, _other_addr = account.generate_account()
    bad_signature = _sign(challenge["message"], other_priv)

    with pytest.raises(GameError):
        svc.link_wallet(p.id, addr, challenge["nonce"], bad_signature)


def test_link_rejects_unknown_nonce(session):
    svc = GameService(session)
    p = svc.create_player("wc4")
    priv, addr = account.generate_account()
    message = "forged message"
    signature = _sign(message, priv)
    with pytest.raises(GameError):
        svc.link_wallet(p.id, addr, "not-a-real-nonce", signature)


def test_link_rejects_challenge_for_a_different_address(session):
    svc = GameService(session)
    p = svc.create_player("wc5")
    priv, addr = account.generate_account()
    _other_priv, other_addr = account.generate_account()

    challenge = svc.create_wallet_challenge(p.id, addr)
    signature = _sign(challenge["message"], priv)

    # Same nonce, but the caller now claims a different address than the
    # challenge was bound to.
    with pytest.raises(GameError):
        svc.link_wallet(p.id, other_addr, challenge["nonce"], signature)


def test_link_rejects_challenge_issued_to_a_different_player(session):
    svc = GameService(session)
    victim = svc.create_player("wc6-victim")
    attacker = svc.create_player("wc6-attacker")
    priv, addr = account.generate_account()

    challenge = svc.create_wallet_challenge(victim.id, addr)
    signature = _sign(challenge["message"], priv)

    with pytest.raises(GameError):
        svc.link_wallet(attacker.id, addr, challenge["nonce"], signature)


def test_link_rejects_expired_challenge(session):
    clock = FrozenClock(datetime(2026, 1, 1, 12, 0, 0))
    svc = GameService(session, clock=clock)
    p = svc.create_player("wc7")
    priv, addr = account.generate_account()

    challenge = svc.create_wallet_challenge(p.id, addr)
    signature = _sign(challenge["message"], priv)

    clock.advance(seconds=GameService.WALLET_CHALLENGE_TTL_SECONDS + 1)
    with pytest.raises(GameError):
        svc.link_wallet(p.id, addr, challenge["nonce"], signature)


def test_link_rejects_reused_challenge(session):
    svc = GameService(session)
    p = svc.create_player("wc8")
    priv, addr = account.generate_account()

    challenge = svc.create_wallet_challenge(p.id, addr)
    signature = _sign(challenge["message"], priv)

    svc.link_wallet(p.id, addr, challenge["nonce"], signature)
    svc.unlink_wallet(p.id)

    # The exact same (nonce, signature) pair cannot be replayed.
    with pytest.raises(GameError):
        svc.link_wallet(p.id, addr, challenge["nonce"], signature)


def test_challenge_rejects_invalid_address(session):
    svc = GameService(session)
    p = svc.create_player("wc9")
    with pytest.raises(GameError):
        svc.create_wallet_challenge(p.id, "not-a-real-algorand-address")
