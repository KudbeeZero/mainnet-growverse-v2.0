"""
Property / invariant tests — randomized over many seeds (no extra deps).

These guard the two correctness-critical subsystems: the currency ledger (must
never drift or go negative) and the genetics engine (offspring traits must stay
in range and be reproducible).
"""

import os
import random
import sys
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.economy.config import load_economy_config
from growpodempire.economy import pricing
from growpodempire.economy.ledger import (
    post, balance, recompute_balance, to_money, InsufficientFundsError,
)
from growpodempire.enums import LedgerEntryType, Rarity, RARITY_ORDER
from growpodempire.services.game_service import GameService
from growpodempire.genetics.traits import TRAIT_SPECS, genome_from_traits, Dominance
from growpodempire.genetics.breeding import cross

CFG = load_economy_config()


# ----- Ledger invariants -------------------------------------------------
def test_ledger_never_drifts_or_goes_negative(db):
    with session_scope() as s:
        svc = GameService(s)
        for seed in range(15):
            rng = random.Random(seed)
            p = svc.create_player(f"prop_{seed}")  # starts at 500
            for _ in range(40):
                bal = balance(s, p.id)
                # Pick a debit we can afford, or a credit.
                if rng.random() < 0.5 and bal > 0:
                    amt = -to_money(rng.uniform(0, float(bal)))
                else:
                    amt = to_money(rng.uniform(0, 200))
                post(s, p.id, amt, LedgerEntryType.ADJUSTMENT)
                assert balance(s, p.id) >= 0
            assert balance(s, p.id) == recompute_balance(s, p.id)


def test_ledger_rejects_every_overdraw(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("overdrawer")
        bal = balance(s, p.id)
        for seed in range(20):
            rng = random.Random(seed)
            over = to_money(float(bal) + rng.uniform(1, 1000))
            try:
                post(s, p.id, -over, LedgerEntryType.SEED_PURCHASE)
                assert False, "expected overdraw rejection"
            except InsufficientFundsError:
                pass
            assert balance(s, p.id) == bal  # unchanged


# ----- Genetics invariants -----------------------------------------------
def _random_genome(rng):
    traits = {}
    for trait, spec in TRAIT_SPECS.items():
        traits[trait] = rng.uniform(spec.low, spec.high)
    dom = {
        t: rng.choice(list(Dominance)).value
        for t in TRAIT_SPECS
        if rng.random() < 0.4
    }
    return genome_from_traits(traits, dom)


def test_cross_traits_always_in_range():
    for seed in range(200):
        rng = random.Random(seed)
        a = _random_genome(rng)
        b = _random_genome(rng)
        result = cross(
            a, b, rng,
            stability_a=rng.uniform(0, 1), stability_b=rng.uniform(0, 1),
        )
        for trait, spec in TRAIT_SPECS.items():
            v = result.genome[trait]["value"]
            assert spec.low <= v <= spec.high, f"seed={seed} {trait}={v}"
        assert 0.0 <= result.stability <= 1.0


def test_cross_is_reproducible_across_seeds():
    base = random.Random(0)
    a = _random_genome(base)
    b = _random_genome(base)
    for seed in range(50):
        r1 = cross(a, b, random.Random(seed), stability_a=0.7, stability_b=0.7)
        r2 = cross(a, b, random.Random(seed), stability_a=0.7, stability_b=0.7)
        assert r1.genome == r2.genome


# ----- Pricing monotonicity ----------------------------------------------
def test_harvest_value_monotonic_in_weight_and_quality():
    prev = Decimal("-1")
    for w in range(10, 120, 10):  # within the soft cap, strictly increasing
        v = pricing.harvest_value(w, 80, "common", CFG)
        assert v > prev
        prev = v
    low_q = pricing.harvest_value(100, 40, "common", CFG)
    high_q = pricing.harvest_value(100, 95, "common", CFG)
    assert high_q > low_q


def test_seed_price_monotonic_in_rarity():
    prices = [pricing.seed_price(r.value, CFG) for r in RARITY_ORDER]
    # Price must never DECREASE as rarity rises (the load-bearing invariant).
    # Strict increase only holds when rarity multipliers differ AND base_cost > 0;
    # under the free-playtest config (base_cost 0, flat multipliers) prices are
    # equal, which is valid — final balance is owner-ratified, not asserted here.
    assert prices == sorted(prices)
    if CFG.seed_base_cost() > 0 and len({CFG.seed_rarity_multiplier(r.value) for r in RARITY_ORDER}) > 1:
        assert prices[0] < prices[-1]
