"""Adversarial PoCs for the 2026-07-05 security review candidates.

Scope: local test harness only (SQLite test DB via the `db`/`session`
fixtures, MockChainProvider). No network, no real chain, no live system.

Three candidates from static analysis are exercised here with real
concurrency (threading) or realistic/pathological value construction, per
the review brief:

  1. SettlementService.withdraw() — does the mocked "on-chain" transfer fire
     more times than there are successfully committed DB debits, under a
     genuine concurrent race?
  2. MintingService.mint_harvest() — same question for NFT minting: does
     create_asset() fire more than once for a single harvest?
  3. game_api.purchase_bundle() — does the float-accumulated bundle price
     ever diverge from the mathematically-correct Decimal price?

All three were CONFIRMED with the concurrency/pathological-value harnesses
below, then FIXED (2026-07-05):
  1. withdraw() now commits the debit (resolving Wallet's optimistic lock)
     BEFORE calling the chain -- the loser of a concurrent race gets a clean
     GameError and never reaches transfer_asset().
  2. Harvest/Strain now carry version_id_col (mirroring Wallet); mint_harvest
     ()/mint_strain() commit the PENDING status before calling the chain, so
     the loser never reaches create_asset().
  3. purchase_bundle()'s pricing now runs entirely in Decimal via the
     extracted _bundle_full_price/_bundle_price_with_discount helpers in
     game_api.py -- no float() ever touches a money value.

This file stays alongside the other tests so it runs under `make test`; the
tests below now assert the FIXED behavior (call counts flipping from the
confirmed-bug counts back to 1, clean GameErrors instead of leaked
StaleDataErrors / silently-wrong float prices) so a regression on any of the
three would fail CI, not just document the finding.
"""

import os
import sys
import threading
from decimal import Decimal, ROUND_HALF_UP

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest
from algosdk import account as _algo_account
from sqlalchemy import event
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm.exc import StaleDataError

from growpodempire.chain.mock import MockChainProvider
from growpodempire.chain.token import create_token_asa
from growpodempire.db.models import Harvest, Strain
from growpodempire.db.session import get_sessionmaker
from growpodempire.economy import ledger
from growpodempire.economy.config import load_economy_config
from growpodempire.enums import NFTStatus
from growpodempire.services.game_service import GameService, GameError
from growpodempire.services.minting_service import MintingService
from growpodempire.services.settlement_service import SettlementService

CFG = load_economy_config()
_VALID_ADDR = _algo_account.generate_account()[1]


def _sync_before_first_commit(session, barrier, timeout=3.0):
    """Rendezvous two racing threads at the FIRST `session.commit()` call.

    Both fixes below move the race's decisive moment from inside the chain
    provider call to the commit that immediately precedes it (that's the
    point where the new version_id_col actually resolves the race). This
    hooks SQLAlchemy's `before_commit` event -- pure test harness, no
    production code involved -- to force two threads to arrive at that commit
    at the same instant, exactly the way the original PoCs forced overlap
    inside `transfer_asset()`/`create_asset()` before the fix existed. Only
    the first commit on each session rendezvous; later commits (e.g. the
    final MINTED/txid-stamp commit) proceed immediately.
    """
    state = {"fired": False}

    def _hook(sess):
        if state["fired"]:
            return
        state["fired"] = True
        try:
            barrier.wait(timeout=timeout)
        except threading.BrokenBarrierError:
            pass

    event.listen(session, "before_commit", _hook)


# --------------------------------------------------------------------------- #
# Shared instrumentation: count real provider calls, and force two callers to
# overlap in the window between "decision made" and "commit" by making both
# rendezvous at a barrier before the (mocked) chain call returns. This is the
# harness-side equivalent of two gunicorn workers' requests landing at the
# same instant; it doesn't change any app code, only how fast the mock
# "network" responds.
# --------------------------------------------------------------------------- #

class BarrierCountingProvider(MockChainProvider):
    def __init__(self, *a, barrier_parties=2, wait_timeout=3.0, **kw):
        super().__init__(*a, **kw)
        self._lock = threading.Lock()
        self.transfer_calls = 0
        self.create_asset_calls = 0
        self._barrier = threading.Barrier(barrier_parties)
        self._wait_timeout = wait_timeout

    def _rendezvous(self):
        try:
            self._barrier.wait(timeout=self._wait_timeout)
        except threading.BrokenBarrierError:
            # The other party never arrived (e.g. it's stuck behind a lower
            # level DB lock) -- don't hang the test forever; proceeding here
            # still lets us observe whether the provider call fires anyway.
            pass

    def transfer_asset(self, *a, **kw):
        with self._lock:
            self.transfer_calls += 1
        self._rendezvous()
        return super().transfer_asset(*a, **kw)

    def create_asset(self, *a, **kw):
        with self._lock:
            self.create_asset_calls += 1
        self._rendezvous()
        return super().create_asset(*a, **kw)


# --------------------------------------------------------------------------- #
# Candidate #1 — duplicate withdraw payouts under concurrency
# --------------------------------------------------------------------------- #

def test_candidate1_withdraw_fix_closes_double_payout(session):
    """FIXED: two threads race SettlementService.withdraw() for the same
    player; the debit-commit boundary (not the chain call) is now the race's
    decisive moment.

    Each thread uses its own DB session (mirroring two gunicorn workers
    handling two concurrent HTTP requests) but shares one chain provider
    instance (the process-wide mock, exactly as `shared_provider()` does in
    prod). `_sync_before_first_commit` forces both threads to arrive at
    withdraw()'s pre-chain-call commit at the same instant -- the same
    overlap the original (pre-fix) PoC forced inside transfer_asset() itself.

    Pre-fix this assay would have shown transfer_calls == 2 (both threads
    reaching the irreversible "on-chain" call) with only 1 debit landing.
    Post-fix: only the winner ever reaches transfer_asset(); the loser gets a
    StaleDataError translated into a clean GameError *before* the chain call.
    """
    gs = GameService(session)
    player = gs.create_player("racer_withdraw")
    gs.link_wallet(player.id, _VALID_ADDR)
    wallet = ledger.get_wallet(session, player.id)
    wallet.cached_balance = ledger.to_money("1000")  # plenty for two 100 debits
    session.commit()

    # barrier_parties=1: at most one thread can now reach transfer_asset(), so
    # there's no one left to rendezvous with there -- transfer_calls itself is
    # the interesting number.
    provider = BarrierCountingProvider(barrier_parties=1, wait_timeout=3.0)
    asset_id = create_token_asa(provider, CFG)

    commit_barrier = threading.Barrier(2)
    SM = get_sessionmaker()
    s1, s2 = SM(), SM()
    results = {}
    errors = {}

    def _run(tag, sess):
        _sync_before_first_commit(sess, commit_barrier)
        try:
            svc = SettlementService(sess, provider=provider, config=CFG, asset_id=asset_id)
            out = svc.withdraw(player.id, "100")
            results[tag] = out
        except Exception as exc:
            errors[tag] = exc

    try:
        t1 = threading.Thread(target=_run, args=("t1", s1))
        t2 = threading.Thread(target=_run, args=("t2", s2))
        t1.start()
        t2.start()
        t1.join(timeout=15)
        t2.join(timeout=15)
    finally:
        s1.close()
        s2.close()

    # --- Evidence ---------------------------------------------------------
    print("transfer_calls:", provider.transfer_calls)
    print("results:", results)
    print("errors:", {k: repr(v) for k, v in errors.items()})

    # THE FIX: the smoking gun (transfer_calls == 2, > successful_commits)
    # flips to 1 -- the loser never reaches the chain call at all.
    assert provider.transfer_calls == 1, (
        f"expected the loser to be rejected before ever reaching the chain "
        f"call, got {provider.transfer_calls} transfer_asset() calls "
        f"(pre-fix this was 2)"
    )
    assert len(results) == 1, f"expected exactly one winning withdraw: {results}"
    assert len(errors) == 1, f"expected exactly one rejected withdraw: {errors}"
    (loser_exc,) = errors.values()
    assert isinstance(loser_exc, GameError), (
        f"expected the loser to get a clean, retryable GameError instead of a "
        f"raw StaleDataError leaking out of the service, got {loser_exc!r}"
    )
    assert not isinstance(loser_exc, StaleDataError)
    assert "retry" in str(loser_exc).lower()

    # The DB shows exactly one debit landed, same as pre-fix -- but now
    # there's exactly one payout to match it, not two.
    session.expire_all()
    assert ledger.balance(session, player.id) == ledger.to_money("900")


# --------------------------------------------------------------------------- #
# Candidate #2 — duplicate NFT minting under concurrency
# --------------------------------------------------------------------------- #

def _rare_harvest(s):
    svc = GameService(s)
    p = svc.create_player("racer_mint")
    strain = s.query(Strain).filter(Strain.slug == "gorilla-glue-no-4").one()  # rare
    stack = svc.buy_seed(p.id, strain.id)
    pod = svc.create_pod(p.id, "Tent", charge=False)
    plant = svc.plant_seed(p.id, stack.id, pod.id)
    harvest = svc.harvest_plant(p.id, plant.id, weight_g=100, quality=90)
    return p.id, harvest.id


def test_candidate2_mint_harvest_fix_closes_double_mint(session):
    """FIXED: two threads race MintingService.mint_harvest() for the SAME
    harvest; the PENDING-status commit boundary (not the chain call) is now
    the race's decisive moment.

    `Harvest` (and `Strain`) now carry `version_id_col` (mirroring Wallet's
    pattern, added by the f6a7b8c9d0e1 migration). `_sync_before_first_commit`
    forces both threads to arrive at `_mint()`'s pre-chain-call PENDING commit
    at the same instant -- the same overlap the original (pre-fix) PoC forced
    inside create_asset() itself.

    Pre-fix this assay would have shown create_asset_calls >= 2 (both threads
    reaching the "on-chain" mint, no StaleDataError guarding either). Post-fix:
    only the winner ever reaches create_asset(); the loser gets a
    StaleDataError translated into a clean GameError *before* the chain call.
    """
    pid, harvest_id = _rare_harvest(session)
    session.commit()

    # barrier_parties=1: at most one thread can now reach create_asset(), so
    # there's no one left to rendezvous with there -- create_asset_calls
    # itself is the interesting number.
    provider = BarrierCountingProvider(barrier_parties=1, wait_timeout=3.0)

    commit_barrier = threading.Barrier(2)
    SM = get_sessionmaker()
    s1, s2 = SM(), SM()
    results = {}
    errors = {}

    def _run(tag, sess):
        _sync_before_first_commit(sess, commit_barrier)
        try:
            svc = MintingService(sess, provider=provider, config=CFG)
            minted = svc.mint_harvest(pid, harvest_id)
            results[tag] = minted.nft_asset_id
        except Exception as exc:
            errors[tag] = exc

    try:
        t1 = threading.Thread(target=_run, args=("t1", s1))
        t2 = threading.Thread(target=_run, args=("t2", s2))
        t1.start()
        t2.start()
        t1.join(timeout=20)
        t2.join(timeout=20)
    finally:
        s1.close()
        s2.close()

    print("create_asset_calls:", provider.create_asset_calls)
    print("results:", results)
    print("errors:", {k: repr(v) for k, v in errors.items()})

    # SQLite serializes the two writers at the file-lock level (no row-level
    # locking like Postgres), so it's possible -- depending on scheduling --
    # for one thread's flush() to raise OperationalError("database is
    # locked") if it can't acquire the lock inside busy_timeout while the
    # other is parked at the barrier. That's a SQLite-only artifact, not the
    # bug (or fix) under test, so tolerate it as an alternative form of the
    # loser's rejection as long as at least one clean run occurred.
    def _is_expected_loser_error(exc):
        return isinstance(exc, GameError) or isinstance(exc, OperationalError)

    unexpected_errors = {
        k: v for k, v in errors.items() if not _is_expected_loser_error(v)
    }
    assert not unexpected_errors, f"unexpected errors: {unexpected_errors}"

    # THE FIX: the smoking gun (create_asset_calls >= 2, both callers
    # "succeeding") flips to exactly 1 -- the loser never reaches the chain
    # call at all.
    assert provider.create_asset_calls == 1, (
        f"expected the loser to be rejected before ever reaching "
        f"create_asset(), got {provider.create_asset_calls} calls "
        f"(pre-fix this was >=2)"
    )
    assert len(results) == 1, f"expected exactly one winning mint: {results}"
    assert len(errors) == 1, f"expected exactly one rejected mint: {errors}"
    (loser_exc,) = errors.values()
    if not isinstance(loser_exc, OperationalError):
        assert isinstance(loser_exc, GameError), (
            f"expected the loser to get a clean, retryable GameError instead "
            f"of a raw StaleDataError leaking out of the service, got "
            f"{loser_exc!r}"
        )
        assert not isinstance(loser_exc, StaleDataError)
        assert "retry" in str(loser_exc).lower()

    # The DB shows exactly one nft_asset_id, matching the one real mint.
    session.expire_all()
    final = session.get(Harvest, harvest_id)
    assert final.nft_status == NFTStatus.MINTED.value
    assert final.nft_asset_id in results.values()


# --------------------------------------------------------------------------- #
# Candidate #3 — float arithmetic for money in purchase_bundle / store_bundles
# --------------------------------------------------------------------------- #

def _float_bundle_price(components, discount_pct):
    """Reproduces purchase_bundle()'s PRE-FIX price formula (float
    accumulation, then round(..., 6), then a Decimal(str(...)) wrap) for
    documentation/regression purposes -- this is no longer what the
    production code does (see test_candidate3_fixed_... below, which
    exercises the real, now-Decimal, game_api._bundle_full_price /
    _bundle_price_with_discount helpers). `components` is a list of
    (cost, qty) pairs already resolved from cfg.shop_consumables -- this
    isolates the arithmetic under test from Flask/DB plumbing.
    """
    full_price = 0.0
    for cost, qty in components:
        full_price += float(cost) * qty
    bundle_price = round(full_price * (1 - float(discount_pct)), 6)
    return Decimal(str(bundle_price))


def _exact_decimal_price(components, discount_pct):
    """The mathematically-correct price computed entirely in Decimal."""
    full_price = Decimal("0")
    for cost, qty in components:
        full_price += Decimal(str(cost)) * qty
    return (full_price * (Decimal("1") - Decimal(str(discount_pct)))).quantize(
        Decimal("0.000001"), rounding=ROUND_HALF_UP
    )


def test_candidate3_float_price_matches_for_realistic_balance_yaml_values():
    """REFUTED for realistic data: balance.yaml's shop consumable costs are
    whole integers (30, 45, 40, 60, 80, ...) and typical discounts (10%,
    15%, 1/3, ...) stay well inside float64's ~15-17 significant-digit
    precision headroom above the code's 6-decimal-place rounding. For every
    plausible in-game bundle, the float-computed price equals the exact
    Decimal price bit-for-bit after rounding."""
    real_costs = [30, 45, 40, 60, 80]  # from balance.yaml shop.consumables
    cases = [
        ([(c, 1) for c in real_costs], "0.10"),
        ([(30, 3), (45, 2)], "0.15"),
        ([(30, 7), (45, 11), (60, 13)], str(1 / 3)),
        ([(19.99, 3)], "0.15"),
    ]
    for components, discount in cases:
        float_price = _float_bundle_price(components, discount)
        exact_price = _exact_decimal_price(components, discount)
        assert float_price == exact_price, (
            f"unexpected divergence for {components}, discount={discount}: "
            f"float={float_price} exact={exact_price}"
        )


def test_candidate3_float_price_diverges_under_pathological_magnitudes():
    """CONFIRMED as a real (if currently unreachable-by-normal-play) code
    smell: the formula performs no Decimal-domain arithmetic at all, so
    given components whose magnitudes are far enough apart to exhaust
    float64's ~15-17 significant digits (e.g. a component priced at 1e16
    alongside a fractional-cent component), digits below ~1e-6 of the large
    value are silently absorbed and never appear in `bundle_price` -- while
    the exact Decimal computation preserves them. This proves the codebase's
    own "money is Decimal, no floats" invariant (CLAUDE.md) is violated by
    this code path in principle; it is only masked in practice because
    balance.yaml never configures costs anywhere near that magnitude today.
    """
    components = [(1e16, 1), (0.01, 1)]
    discount = "0"
    float_price = _float_bundle_price(components, discount)
    exact_price = _exact_decimal_price(components, discount)
    assert exact_price == Decimal("10000000000000000.010000")
    assert float_price != exact_price, (
        "expected the float path to lose the small component entirely"
    )
    # The float path drops the 0.01 component completely.
    assert float_price == Decimal("10000000000000000")


class _FakeShopCfg:
    """Minimal stand-in for EconomyConfig -- only `.shop_consumables` is read
    by `_bundle_full_price` for consumable-type components (no DB/strain
    lookup needed for this case)."""

    def __init__(self, shop_consumables):
        self.shop_consumables = shop_consumables


def test_candidate3_fixed_purchase_bundle_price_matches_exact_decimal_for_pathological_magnitudes():
    """FIXED (2026-07-05 review, candidate #3): exercises the REAL production
    helpers purchase_bundle() now calls -- game_api._bundle_full_price /
    _bundle_price_with_discount -- with the identical pathological-magnitude
    case that diverged above under the old float formula.

    This is the proof the fix changed the arithmetic *domain* (Decimal
    end-to-end via `to_money()`, no `float()` on money), not just where
    rounding happens: the same 1e16-vs-0.01 case that used to silently drop
    the small component now matches the exact Decimal result bit-for-bit.
    """
    from growpodempire.api.game_api import _bundle_full_price, _bundle_price_with_discount

    cfg = _FakeShopCfg({"big": {"cost": 1e16}, "small": {"cost": 0.01}})
    components = [
        {"type": "consumable", "key": "big", "qty": 1},
        {"type": "consumable", "key": "small", "qty": 1},
    ]

    full_price = _bundle_full_price(cfg, None, components)
    fixed_price = _bundle_price_with_discount(full_price, "0")
    exact_price = _exact_decimal_price([(1e16, 1), (0.01, 1)], "0")

    assert exact_price == Decimal("10000000000000000.010000")
    assert fixed_price == exact_price, (
        f"expected the fixed Decimal-domain formula to preserve the small "
        f"component exactly, got {fixed_price} (the old float formula "
        f"produced {Decimal('10000000000000000')}, silently dropping it)"
    )
