"""Concurrency safety on the money paths.

These prove the DB-enforced invariants that make the highest-value economic
exploits impossible under a race — not just under the single-threaded app
checks. They drive two independent sessions against the same database to
simulate two interleaved requests (the prod deploy runs gunicorn -w 2).
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from growpodempire.db.session import get_sessionmaker
from growpodempire.db.models import Strain, Harvest, Wallet
from growpodempire.economy import ledger
from growpodempire.economy.config import load_economy_config
from growpodempire.enums import LedgerEntryType
from growpodempire.services.game_service import GameService

CFG = load_economy_config()


def _funded_player(session, balance="100"):
    svc = GameService(session)
    p = svc.create_player("racer")
    w = ledger.get_wallet(session, p.id)
    w.cached_balance = ledger.to_money(balance)
    session.flush()
    return p.id


def test_optimistic_lock_blocks_concurrent_double_spend(session):
    """Two requests both read balance 100 and each try to spend 100. Exactly one
    commits; the other loses the optimistic-lock race and rolls back — so the
    wallet is debited once, never twice (no free second purchase)."""
    pid = _funded_player(session, "100")
    session.commit()

    SM = get_sessionmaker()
    s1, s2 = SM(), SM()
    try:
        # Both transactions read the same wallet version, then each posts a debit.
        ledger.post(s1, pid, "-100", LedgerEntryType.SEED_PURCHASE)
        ledger.post(s2, pid, "-100", LedgerEntryType.SEED_PURCHASE)

        s1.commit()  # winner: version 0 -> 1
        with pytest.raises(StaleDataError):
            s2.commit()  # WHERE version=0 matches 0 rows -> stale
        s2.rollback()
    finally:
        s1.close()
        s2.close()

    # Net effect: debited exactly once (the second 100 spend never applied).
    session.expire_all()
    assert ledger.balance(session, pid) == ledger.to_money("0")


def test_check_constraint_is_a_hard_floor_under_zero(session):
    """Even bypassing the app-side guard (allow_negative=True), the DB CHECK
    refuses to persist a negative balance."""
    pid = _funded_player(session, "10")
    session.commit()

    ledger.post(session, pid, "-50", LedgerEntryType.SEED_PURCHASE, allow_negative=True)
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()


def test_harvest_once_is_enforced_by_unique_constraint(session):
    """Two concurrent harvests of the same plant: the unique constraint on
    harvests.plant_id makes the second insert fail, so currency can't be minted
    twice for one plant."""
    svc = GameService(session)
    p = svc.create_player("farmer")
    strain = session.query(Strain).first()
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", capacity=4, charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    session.commit()

    # Insert two Harvest rows for the same plant (simulating a double-submit that
    # raced past the app-side `plant.harvested` check).
    session.add(Harvest(
        player_id=p.id, plant_id=plant.id, strain_id=strain.id,
        weight_g=10.0, quality=80.0, rarity_snapshot=strain.rarity,
    ))
    session.add(Harvest(
        player_id=p.id, plant_id=plant.id, strain_id=strain.id,
        weight_g=10.0, quality=80.0, rarity_snapshot=strain.rarity,
    ))
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()


def test_version_increments_on_normal_post(session):
    """Sanity: a single (uncontended) debit still bumps the managed version, so
    the optimistic lock is live on the happy path too."""
    pid = _funded_player(session, "50")
    session.commit()
    before = session.query(Wallet).filter_by(player_id=pid).one().version
    ledger.post(session, pid, "-10", LedgerEntryType.SEED_PURCHASE)
    session.commit()
    after = session.query(Wallet).filter_by(player_id=pid).one().version
    assert after == before + 1
