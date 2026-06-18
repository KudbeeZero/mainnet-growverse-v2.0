"""End-to-end game flows over a real (SQLite) database."""

import os
import sys
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, SeedInventory, Plant
from growpodempire.services.game_service import GameService, GameError
from growpodempire.economy.ledger import InsufficientFundsError, balance
from launch_economy import launch_config
from growpodempire.economy.config import load_economy_config

# Live balance.yaml is in "free testing mode" (free seeds). Economic-invariant
# tests are both (a) skipped while seeds are free (`_FREE_SEEDS`) and (b) given the
# launch config (`LAUNCH_CFG`) so they assert real launch economics when they run.
# Both auto-reactivate when balance.yaml `seeds.base_cost` is restored to 25.
LAUNCH_CFG = launch_config()
_FREE_SEEDS = load_economy_config().seed_base_cost() == 0
_FREE_SEED_REASON = "dev free-seed economy (balance.yaml seeds.base_cost: 0); restore to 25 to enforce launch pricing"


def _strain(session, slug):
    return session.query(Strain).filter(Strain.slug == slug).one()


def test_create_player_grants_starting_balance(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("alice")
        assert balance(s, p.id) == Decimal("500.000000")


@pytest.mark.skipif(_FREE_SEEDS, reason=_FREE_SEED_REASON)
def test_buy_seed_debits_and_adds_inventory(db):
    with session_scope() as s:
        svc = GameService(s, config=LAUNCH_CFG)
        p = svc.create_player("bob")
        common = _strain(s, "blue-dream")  # common -> 25
        stack = svc.buy_seed(p.id, common.id, quantity=2)
        assert stack.quantity == 2
        assert balance(s, p.id) == Decimal("450.000000")  # 500 - 2*25


@pytest.mark.skipif(_FREE_SEEDS, reason=_FREE_SEED_REASON)
def test_buy_seed_insufficient_funds(db):
    with session_scope() as s:
        svc = GameService(s, config=LAUNCH_CFG)
        p = svc.create_player("broke")
        legendary_like = _strain(s, "gorilla-glue-no-4")  # rare -> 150
        # Drain the wallet first.
        svc.buy_seed(p.id, legendary_like.id, quantity=3)  # 450
        with pytest.raises(InsufficientFundsError):
            svc.buy_seed(p.id, legendary_like.id, quantity=1)  # would need 150, only 50


def test_plant_seed_consumes_seed_and_copies_genome(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("grower")
        strain = _strain(s, "white-widow")
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Tent A", capacity=2, charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        assert plant.genome == strain.genome
        assert s.get(SeedInventory, stack.id).quantity == 0
        assert s.query(Plant).count() == 1


def test_pod_capacity_enforced(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("packer")
        strain = _strain(s, "white-widow")
        stack = svc.buy_seed(p.id, strain.id, quantity=2)
        pod = svc.create_pod(p.id, "Tiny", capacity=1, charge=False)
        svc.plant_seed(p.id, stack.id, pod.id)
        with pytest.raises(GameError):
            svc.plant_seed(p.id, stack.id, pod.id)


def test_breed_creates_offspring_and_charges_fee(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("breeder")
        a = _strain(s, "blue-dream")       # common
        b = _strain(s, "white-widow")      # common -> fee 75
        before = balance(s, p.id)
        offspring = svc.breed(p.id, a.id, b.id, rng_seed=123, offspring_name="My Cross")
        assert offspring.is_base_catalog is False
        assert offspring.parent_a_id == a.id and offspring.parent_b_id == b.id
        assert offspring.generation == 1
        assert balance(s, p.id) == before - Decimal("75.000000")
        # Breeder receives a seed of the new strain.
        stack = (
            s.query(SeedInventory)
            .filter(SeedInventory.strain_id == offspring.id)
            .one()
        )
        assert stack.quantity == 1


def test_breed_is_reproducible_with_seed(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("rng")
        a = _strain(s, "haze")
        b = _strain(s, "afghani")
        o1 = svc.breed(p.id, a.id, b.id, rng_seed=999)
        o2 = svc.breed(p.id, a.id, b.id, rng_seed=999)
        assert o1.genome == o2.genome


def test_harvest_sells_and_credits(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("harvester")
        strain = _strain(s, "blue-dream")
        stack = svc.buy_seed(p.id, strain.id)
        pod = svc.create_pod(p.id, "Room", charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)
        before = balance(s, p.id)
        h = svc.harvest_plant(p.id, plant.id, weight_g=100, quality=100)
        assert h.sold is True and h.sale_value > 0
        assert balance(s, p.id) == before + h.sale_value
        assert s.get(Plant, plant.id).harvested is True


def test_list_pods_and_plants_for_player(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("lister")
        strain = _strain(s, "white-widow")
        stack = svc.buy_seed(p.id, strain.id, quantity=2)
        pod = svc.create_pod(p.id, "Tent A", capacity=2, charge=False)
        plant = svc.plant_seed(p.id, stack.id, pod.id)

        pods = svc.list_pods(p.id)
        plants = svc.list_plants(p.id)
        assert [x.id for x in pods] == [pod.id]
        assert [x.id for x in plants] == [plant.id]

        # Another player's resources are isolated.
        other = svc.create_player("outsider")
        assert svc.list_pods(other.id) == []
        assert svc.list_plants(other.id) == []


def test_list_pods_unknown_player_raises(db):
    with session_scope() as s:
        with pytest.raises(GameError):
            GameService(s).list_pods("does-not-exist")


@pytest.mark.skipif(_FREE_SEEDS, reason=_FREE_SEED_REASON)
def test_marketplace_transfers_seeds_and_currency(db):
    with session_scope() as s:
        svc = GameService(s, config=LAUNCH_CFG)
        seller = svc.create_player("seller")
        buyer = svc.create_player("buyer")
        strain = _strain(s, "blue-dream")  # 25 common

        stack = svc.buy_seed(seller.id, strain.id)        # seller: 475
        listing = svc.create_seed_listing(seller.id, stack.id, 1, 100)
        # listing fee 100*0.03 = 3 -> seller 472, seed escrowed
        assert balance(s, seller.id) == Decimal("472.000000")
        assert s.get(SeedInventory, stack.id).quantity == 0

        svc.buy_listing(buyer.id, listing.id)
        # buyer pays 100 -> 400; tax 5 burned; seller +95 -> 567
        assert balance(s, buyer.id) == Decimal("400.000000")
        assert balance(s, seller.id) == Decimal("567.000000")
        # buyer received the seed
        buyer_stack = (
            s.query(SeedInventory)
            .filter(
                SeedInventory.player_id == buyer.id,
                SeedInventory.strain_id == strain.id,
            )
            .one()
        )
        assert buyer_stack.quantity == 1
