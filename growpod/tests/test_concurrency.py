"""Concurrency safety on the money paths.

These prove the DB-enforced invariants that make the highest-value economic
exploits impossible under a race — not just under the single-threaded app
checks. They drive two independent sessions against the same database to
simulate two interleaved requests (the prod deploy runs gunicorn -w 2).
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import threading
from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from growpodempire.db.session import get_sessionmaker
from growpodempire.db.models import GearInventory, Harvest, SeedInventory, Strain, Wallet
from growpodempire.economy import ledger
from growpodempire.economy.config import load_economy_config
from growpodempire.enums import LedgerEntryType
from growpodempire.services.game_service import GameService
from growpodempire.services.seasonal_service import SeasonalService

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


# ---------------------------------------------------------------------------
# Store/market purchase race (2026-07-05 playtest QA report).
#
# A raw-HTTP two-concurrent-POST repro against gunicorn -w 1 (sync, single
# worker/process/thread) showed BOTH `/store/gear/:key/purchase` requests
# return 201 and both charge. Root cause: with one sync worker there is no
# actual DB-level concurrency possible — the two requests are handled fully
# sequentially (one Python call stack, one thread), so each is a fully valid,
# independently-priced purchase reading the post-previous-purchase balance.
# It isn't a race; it's an absence of per-click dedup (double-click / a
# duplicate synthetic event fires the same logical purchase twice).
#
# Re-running the same repro against gunicorn -w 2 (matching the actual prod
# Dockerfile: `CMD ["gunicorn", ..., "-w", "2", ...]`, i.e. two OS processes
# that CAN genuinely run Python concurrently) with 8 truly concurrent threads
# showed the existing protection already works end-to-end over HTTP: 5
# succeeded (201), 3 cleanly lost the optimistic-lock race and got the global
# StaleDataError handler's 409 ("Conflicting concurrent update; please
# retry") — final wallet balance and gear-owned count matched exactly 5
# purchases, never more.
#
# These two tests pin that same guarantee at the service layer for the two
# endpoints the QA report named, so a future refactor that removes/weakens
# the lock (e.g. by committing mid-handler without the try/except, or by
# swallowing StaleDataError somewhere) fails loudly here instead of
# reintroducing a silent double-charge. No server-side change was made for
# this finding — the fix is client-side (see web/e2e for the double-click
# guard proof); these tests are the "the server was never the bug" receipt.
def _race(barrier, work):
    """Run `work()` after every racer has reached the barrier, so both threads'
    reads happen before either's write — the actual concurrent-request shape
    (not two sequential calls in one thread, which never overlap)."""
    barrier.wait()
    return work()


def test_gear_purchase_survives_concurrent_requests(session):
    """Two truly concurrent requests (real threads, released together by a
    barrier) both buying the same gear for the same player: exactly one
    debit/inventory-increment lands. The other cleanly loses the
    optimistic-lock race (StaleDataError -> retry) — never a double charge.
    Mirrors gunicorn -w 2 in prod; matches the QA report's confirmed
    `/store/gear/:key/purchase` endpoint at the GameService.buy_gear layer."""
    gear_key, item = next(iter(CFG.shop_gear.items()))
    cost = Decimal(str(item.get("cost", 0)))
    pid = _funded_player(session, str(cost * 3))
    # Pre-seed an owned-zero stack so both racers take buy_gear()'s "increment
    # an existing row" path. (A concurrent *first-ever* purchase of a gear key
    # races on gear_inventory's (player_id, gear_key) unique index instead —
    # a real, narrower gap found while writing this test: the loser gets an
    # IntegrityError/500 rather than a clean 409. No money or item is lost
    # (the whole flush — wallet debit included — rolls back atomically), so
    # it's an error-hygiene gap, not a double-charge; out of scope for this
    # fix, flagged in the PR description as a follow-up.)
    session.add(GearInventory(player_id=pid, gear_key=gear_key, category=item.get("category", "gear"), quantity=0))
    session.commit()

    SM = get_sessionmaker()
    barrier = threading.Barrier(2)
    outcomes: dict[str, str] = {}

    def attempt(tag):
        s = SM()
        try:
            _race(barrier, lambda: GameService(s).buy_gear(pid, gear_key, 1))
            s.commit()
            outcomes[tag] = "ok"
        except StaleDataError:
            s.rollback()
            outcomes[tag] = "stale"
        finally:
            s.close()

    threads = [threading.Thread(target=attempt, args=(f"t{i}",)) for i in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(outcomes.values()) == ["ok", "stale"]
    session.expire_all()
    assert ledger.balance(session, pid) == ledger.to_money(cost * 2)  # 3x funded - 1x spent
    stack = (
        session.query(GearInventory)
        .filter_by(player_id=pid, gear_key=gear_key)
        .one()
    )
    assert stack.quantity == 1  # not 2


def test_seasonal_strain_purchase_survives_concurrent_requests(session):
    """Same guarantee, same real-thread-plus-barrier shape, for the other
    endpoint the QA report named:
    `/players/:id/seasonal/strains/:id/purchase`."""
    strain = session.query(Strain).first()
    month = datetime.utcnow().strftime("%Y-%m")
    row = SeasonalService(session).upsert(strain.id, month, Decimal("60"))
    pid = _funded_player(session, "180")
    session.commit()

    SM = get_sessionmaker()
    barrier = threading.Barrier(2)
    outcomes: dict[str, str] = {}

    def attempt(tag):
        s = SM()
        try:
            _race(barrier, lambda: SeasonalService(s).purchase(pid, row["id"]))
            s.commit()
            outcomes[tag] = "ok"
        except StaleDataError:
            s.rollback()
            outcomes[tag] = "stale"
        finally:
            s.close()

    threads = [threading.Thread(target=attempt, args=(f"t{i}",)) for i in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(outcomes.values()) == ["ok", "stale"]
    session.expire_all()
    assert ledger.balance(session, pid) == ledger.to_money("120")  # 180 - 60, once
    seeds = (
        session.query(SeedInventory)
        .filter_by(player_id=pid, strain_id=strain.id, source="seasonal")
        .one()
    )
    assert seeds.quantity == 1  # not 2
