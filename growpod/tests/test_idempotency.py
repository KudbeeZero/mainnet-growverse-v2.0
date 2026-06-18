"""Idempotency / replay protection on the reward faucets.

These cover the duplicate-claim and concurrent-claim risks for the one-shot
reward faucets (achievement, contract, cup prize) plus the recurring daily
stipend. The one-shot faucets carry a unique `idempotency_key` on the ledger so
a duplicate credit is impossible at the DB layer; the daily stipend keeps its
22h-rolling cooldown and is serialized by a wallet row lock (the wallet's
optimistic version lock is the backstop under SQLite, where FOR UPDATE is a
no-op). The prod deploy runs `gunicorn -w 2`, so two interleaved requests are
the real condition these tests simulate (two independent sessions, one DB).

Tests are value-agnostic: they assert "credited exactly once" against the
configured reward and never hardcode GROW amounts, so they stay green across
free-playtest and launch balance values.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from datetime import datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from growpodempire.db.session import get_sessionmaker, session_scope
from growpodempire.db.models import Strain, LedgerEntry
from growpodempire.economy.ledger import balance, post
from growpodempire.enums import LedgerEntryType
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.progression_service import ProgressionService
from growpodempire.services.contract_service import ContractService
from growpodempire.services.cup_service import CupService
from growpodempire.simulation.clock import FrozenClock

BASE = datetime(2026, 1, 1, 12, 0, 0)
LATE = BASE + timedelta(days=91)  # past the 90-day cup window -> auto-judge

# The race loser either fails the wallet optimistic-lock (StaleDataError) or the
# unique idempotency_key (IntegrityError), depending on flush order. Either way
# it never commits a second credit.
RACE_LOSER_EXC = (StaleDataError, IntegrityError)


# --- helpers -----------------------------------------------------------------
def _harvest(svc, pid, slug="blue-dream", grams=100, quality=80):
    strain = svc.session.query(Strain).filter(Strain.slug == slug).one()
    stack = svc.buy_seed(pid, strain.id)
    pod = svc.create_pod(pid, "Tent", charge=False)
    plant = svc.plant_seed(pid, stack.id, pod.id)
    return svc.harvest_plant(pid, plant.id, weight_g=grams, quality=quality, sell=False)


def _stock_unsold(svc, pid, slug, grams, n=1):
    for _ in range(n):
        _harvest(svc, pid, slug=slug, grams=grams)


def _common_contract(cs, pid):
    """Draw contracts until a common-rarity one appears (matches blue-dream)."""
    contract = cs.offer(pid, rng_seed=1)
    while contract.target_rarity != "common":
        contract = cs.offer(pid, rng_seed=hash(contract.id) % 1000)
    return contract


def _count_key(s, key):
    s.flush()  # this codebase runs with autoflush off; make pending rows visible
    return s.query(LedgerEntry).filter(LedgerEntry.idempotency_key == key).count()


# --- 1. the DB constraint itself --------------------------------------------
def test_duplicate_idempotency_key_rejected_by_db(session):
    """Two ledger entries with the same idempotency_key cannot both persist."""
    p = GameService(session).create_player("idem")
    post(session, p.id, "10", LedgerEntryType.REWARD, idempotency_key="reward:test:x")
    post(session, p.id, "10", LedgerEntryType.REWARD, idempotency_key="reward:test:x")
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()


def test_null_idempotency_key_is_unconstrained(session):
    """NULL keys never collide, so ordinary movements are unaffected."""
    p = GameService(session).create_player("nulls")
    post(session, p.id, "1", LedgerEntryType.DAILY_STIPEND)  # key NULL
    post(session, p.id, "1", LedgerEntryType.DAILY_STIPEND)  # key NULL
    session.flush()  # no IntegrityError
    n = session.query(LedgerEntry).filter(LedgerEntry.player_id == p.id).count()
    assert n >= 2


# --- 2. achievement faucet ---------------------------------------------------
def test_achievement_claim_idempotent_sequential(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("ach")
        _harvest(svc, p.id, grams=50)  # unlock first_harvest
        prog = ProgressionService(s, clock=FrozenClock(BASE))

        prog.claim_achievement(p.id, "first_harvest")
        before = balance(s, p.id)
        with pytest.raises(GameError):
            prog.claim_achievement(p.id, "first_harvest")  # already claimed
        assert balance(s, p.id) == before
        assert _count_key(s, f"reward:achievement:{p.id}:first_harvest") == 1


def test_concurrent_achievement_claim_single_payout(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("ach2")
        _harvest(svc, p.id, grams=50)  # unlock first_harvest
        pid = p.id

    SM = get_sessionmaker()
    s1, s2 = SM(), SM()
    try:
        ProgressionService(s1, clock=FrozenClock(BASE)).claim_achievement(pid, "first_harvest")
        ProgressionService(s2, clock=FrozenClock(BASE)).claim_achievement(pid, "first_harvest")
        s1.commit()  # winner
        with pytest.raises(RACE_LOSER_EXC):
            s2.commit()  # loser: stale wallet or duplicate idempotency_key
        s2.rollback()
    finally:
        s1.close()
        s2.close()

    with session_scope() as s:
        assert _count_key(s, f"reward:achievement:{pid}:first_harvest") == 1


# --- 3. contract faucet ------------------------------------------------------
def test_concurrent_contract_fulfill_single_payout(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("conc")
        _stock_unsold(svc, p.id, "blue-dream", 60, n=2)  # 120g >= 100g common
        cs = ContractService(s, clock=FrozenClock(BASE))
        contract = _common_contract(cs, p.id)
        cid, pid = contract.id, p.id

    SM = get_sessionmaker()
    s1, s2 = SM(), SM()
    try:
        ContractService(s1, clock=FrozenClock(BASE)).fulfill(pid, cid)
        ContractService(s2, clock=FrozenClock(BASE)).fulfill(pid, cid)
        s1.commit()  # winner
        with pytest.raises(RACE_LOSER_EXC):
            s2.commit()  # loser
        s2.rollback()
    finally:
        s1.close()
        s2.close()

    with session_scope() as s:
        assert _count_key(s, f"reward:contract:{pid}:{cid}") == 1


# --- 4. daily stipend (recurring; row-lock + cooldown, no idempotency key) ----
def test_daily_stipend_replay_blocked_by_cooldown(db):
    with session_scope() as s:
        p = GameService(s).create_player("replay")
        clock = FrozenClock(BASE)
        prog = ProgressionService(s, clock=clock)

        prog.claim_daily(p.id)
        with pytest.raises(GameError):
            prog.claim_daily(p.id)  # still within the 22h cooldown
        assert _count_stipend(s, p.id) == 1

        clock.advance(hours=23)
        prog.claim_daily(p.id)  # cooldown elapsed -> a fresh claim
        assert _count_stipend(s, p.id) == 2


def test_concurrent_daily_stipend_single_payout(db):
    with session_scope() as s:
        pid = GameService(s).create_player("dailyrace").id

    SM = get_sessionmaker()
    s1, s2 = SM(), SM()
    try:
        ProgressionService(s1, clock=FrozenClock(BASE)).claim_daily(pid)
        ProgressionService(s2, clock=FrozenClock(BASE)).claim_daily(pid)
        s1.commit()  # winner
        with pytest.raises(RACE_LOSER_EXC):
            s2.commit()  # loser: stale wallet (FOR UPDATE is a no-op on SQLite)
        s2.rollback()
    finally:
        s1.close()
        s2.close()

    with session_scope() as s:
        assert _count_stipend(s, pid) == 1


def _count_stipend(s, pid):
    s.flush()  # autoflush is off in this codebase; surface pending rows
    return (
        s.query(LedgerEntry)
        .filter(
            LedgerEntry.player_id == pid,
            LedgerEntry.entry_type == LedgerEntryType.DAILY_STIPEND.value,
        )
        .count()
    )


# --- 5. cup prize faucet -----------------------------------------------------
def test_cup_prize_payout_carries_idempotency_key(session):
    svc = GameService(session)
    p = svc.create_player("cupidem")
    CupService(session, clock=FrozenClock(BASE)).enter(p.id, _harvest(svc, p.id).id)
    cup = CupService(session, clock=FrozenClock(LATE)).current_cup()  # auto-judges
    assert cup.status == "judged"

    payout = (
        session.query(LedgerEntry)
        .filter(
            LedgerEntry.player_id == p.id,
            LedgerEntry.entry_type == LedgerEntryType.CUP_PRIZE_PAYOUT.value,
        )
        .one()
    )
    assert payout.idempotency_key == f"reward:cup_prize:{cup.id}:{p.id}"
