"""Algorand wallet connect/disconnect (login/out): link validation + unlink."""

import os
import sys

import pytest
from algosdk import account

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.services.game_service import GameService, GameError


def test_link_valid_address_then_unlink(session):
    svc = GameService(session)
    p = svc.create_player("w1")
    _priv, addr = account.generate_account()  # a real, checksum-valid address

    linked = svc.link_wallet(p.id, addr)
    assert linked.algorand_address == addr

    cleared = svc.unlink_wallet(p.id)
    assert cleared.algorand_address is None


def test_link_trims_whitespace(session):
    svc = GameService(session)
    p = svc.create_player("w2")
    _priv, addr = account.generate_account()
    linked = svc.link_wallet(p.id, f"  {addr}  ")
    assert linked.algorand_address == addr


def test_link_rejects_invalid_address(session):
    svc = GameService(session)
    p = svc.create_player("w3")
    with pytest.raises(GameError):
        svc.link_wallet(p.id, "not-a-real-algorand-address")


def test_link_rejects_empty(session):
    svc = GameService(session)
    p = svc.create_player("w4")
    with pytest.raises(GameError):
        svc.link_wallet(p.id, "   ")


def test_unlink_is_idempotent(session):
    svc = GameService(session)
    p = svc.create_player("w5")
    # Not linked → no error, stays None.
    svc.unlink_wallet(p.id)
    assert svc.get_player(p.id).algorand_address is None
