"""ASA wallet settlement: withdraw/deposit mirror the ledger to chain."""

import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import LedgerEntry
from growpodempire.economy.ledger import balance, get_wallet, InsufficientFundsError
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.settlement_service import SettlementService
from growpodempire.chain.mock import MockChainProvider
from algosdk import account
from _wallet_test_helpers import link_wallet_for_test

# A real, checksum-valid Algorand keypair (link_wallet now requires a signed challenge).
_VALID_PRIV, _VALID_ADDR = account.generate_account()


def _svc(s):
    return SettlementService(s, provider=MockChainProvider())


def test_withdraw_mirrors_to_chain(db):
    with session_scope() as s:
        gs = GameService(s)
        p = gs.create_player("settler")
        link_wallet_for_test(gs, p.id, _VALID_PRIV, _VALID_ADDR)
        start = balance(s, p.id)

        result = _svc(s).withdraw(p.id, 100)
        assert result["txid"].startswith("MOCKTX")
        assert balance(s, p.id) == start - Decimal("100")
        assert get_wallet(s, p.id).asa_balance == Decimal("100")
        # The ledger entry carries the on-chain txid.
        s.flush()
        entry = (
            s.query(LedgerEntry)
            .filter(LedgerEntry.player_id == p.id, LedgerEntry.entry_type == "asa_withdrawal")
            .one()
        )
        assert entry.onchain_txid == result["txid"]


def test_withdraw_requires_linked_wallet(db):
    with session_scope() as s:
        p = GameService(s).create_player("nowallet")
        with pytest.raises(GameError):
            _svc(s).withdraw(p.id, 10)


def test_withdraw_then_deposit_roundtrips(db):
    with session_scope() as s:
        gs = GameService(s)
        p = gs.create_player("rt")
        link_wallet_for_test(gs, p.id, _VALID_PRIV, _VALID_ADDR)
        svc = _svc(s)
        svc.withdraw(p.id, 200)
        before = balance(s, p.id)
        svc.deposit(p.id, 120)
        assert balance(s, p.id) == before + Decimal("120")
        assert get_wallet(s, p.id).asa_balance == Decimal("80")


def test_cannot_withdraw_more_than_balance(db):
    with session_scope() as s:
        gs = GameService(s)
        p = gs.create_player("broke")
        link_wallet_for_test(gs, p.id, _VALID_PRIV, _VALID_ADDR)
        with pytest.raises(InsufficientFundsError):
            _svc(s).withdraw(p.id, 100000)
