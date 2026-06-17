"""Strain stabilization: selfing raises stability over generations."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, SeedInventory
from growpodempire.economy.ledger import balance
from growpodempire.services.game_service import GameService, GameError


def _bred_strain(s):
    svc = GameService(s)
    p = svc.create_player("stabilizer")
    a = s.query(Strain).filter(Strain.slug == "haze").one()
    b = s.query(Strain).filter(Strain.slug == "afghani").one()
    offspring = svc.breed(p.id, a.id, b.id, rng_seed=5)  # gives 1 seed of offspring
    return svc, p.id, offspring


def test_stabilize_raises_stability_and_narrows_ranges(db):
    with session_scope() as s:
        svc, pid, f1 = _bred_strain(s)
        s0 = f1.stability
        before = balance(s, pid)

        f2 = svc.stabilize_strain(pid, f1.id, rng_seed=1)
        assert f2.stability > s0
        assert f2.generation == f1.generation + 1
        # Narrower expressed THC range than the parent.
        assert (f2.thc_max - f2.thc_min) <= (f1.thc_max - f1.thc_min)
        # Fee charged and a seed consumed/produced.
        assert balance(s, pid) < before
        assert s.query(SeedInventory).filter_by(player_id=pid, strain_id=f1.id).one().quantity == 0
        assert s.query(SeedInventory).filter_by(player_id=pid, strain_id=f2.id).one().quantity == 1


def test_repeated_stabilization_reaches_mintable_stability(db):
    with session_scope() as s:
        svc, pid, current = _bred_strain(s)
        # Grant plenty of funds for repeated fees.
        from growpodempire.economy.ledger import post
        from growpodempire.enums import LedgerEntryType
        post(s, pid, 5000, LedgerEntryType.ADJUSTMENT)

        for i in range(6):
            if current.stability >= 0.85:
                break
            current = svc.stabilize_strain(pid, current.id, rng_seed=i + 1)
        assert current.stability >= 0.85  # now eligible for NFT minting


def test_stabilize_requires_a_seed(db):
    with session_scope() as s:
        svc, pid, f1 = _bred_strain(s)
        svc.stabilize_strain(pid, f1.id, rng_seed=1)  # consumes the only F1 seed
        with pytest.raises(GameError):
            svc.stabilize_strain(pid, f1.id, rng_seed=2)  # no seed left
