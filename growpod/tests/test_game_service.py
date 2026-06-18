"""End-to-end game flows over a real (SQLite) database."""

import copy
import os
import sys
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain, SeedInventory, Plant
from growpodempire.services.game_service import GameService, GameError
from growpodempire.economy import pricing
from growpodempire.economy.config import EconomyConfig, load_economy_config
from growpodempire.economy.ledger import InsufficientFundsError, balance, to_money

CFG = load_economy_config()


def _strain(session, slug):
    return session.query(Strain).filter(Strain.slug == slug).one()


def _config_with_seed_cost(cost):
    """A copy of the canonical config with seeds.base_cost overridden, for
    mechanism tests that need a non-zero cost regardless of live playtest tuning."""
    raw = copy.deepcopy(load_economy_config().raw)
    raw["seeds"]["base_cost"] = cost
    return EconomyConfig(raw=raw)


def test_create_player_grants_starting_balance(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("alice")
        assert balance(s, p.id) == Decimal("500.000000")


def test_buy_seed_debits_and_adds_inventory(db):
    with session_scope() as s:
        svc = GameService(s)
        p = svc.create_player("bob")
        common = _strain(s, "blue-dream")
        unit = pricing.seed_price(common.rarity, CFG)  # canonical price, not a literal
        stack = svc.buy_seed(p.id, common.id, quantity=2)
        assert stack.quantity == 2
        # Debit must equal price x quantity (mechanism), whatever the tuned price.
        assert balance(s, p.id) == to_money(Decimal(str(CFG.starting_balance)) - unit * 2)


def test_buy_seed_insufficient_funds(db):
    # Use an injected config whose seed cost exceeds the starting grant so the
    # affordability guard is exercised regardless of the live (free) playtest price.
    cfg = _config_with_seed_cost(CFG.starting_balance + 100)
    with session_scope() as s:
        svc = GameService(s, config=cfg)
        p = svc.create_player("broke")
        strain = _strain(s, "blue-dream")
        with pytest.raises(InsufficientFundsError):
            svc.buy_seed(p.id, strain.id, quantity=1)


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


def test_marketplace_transfers_seeds_and_currency(db):
    # Fees/tax are derived from canonical config so the transfer mechanism is
    # asserted independent of the seed price (which is free in playtest).
    start = Decimal(str(CFG.starting_balance))
    price = Decimal("100")
    listing_fee = to_money(price * Decimal(str(CFG.market["listing_fee_pct"])))
    sale_tax = to_money(price * Decimal(str(CFG.market["sale_tax_pct"])))
    with session_scope() as s:
        svc = GameService(s)
        seller = svc.create_player("seller")
        buyer = svc.create_player("buyer")
        strain = _strain(s, "blue-dream")
        unit = pricing.seed_price(strain.rarity, CFG)

        stack = svc.buy_seed(seller.id, strain.id)
        listing = svc.create_seed_listing(seller.id, stack.id, 1, int(price))
        # seller paid the seed cost + listing fee; seed is escrowed.
        seller_after_list = to_money(start - unit - listing_fee)
        assert balance(s, seller.id) == seller_after_list
        assert s.get(SeedInventory, stack.id).quantity == 0

        svc.buy_listing(buyer.id, listing.id)
        # buyer pays the full price; sale tax is burned; seller nets price - tax.
        assert balance(s, buyer.id) == to_money(start - price)
        assert balance(s, seller.id) == to_money(seller_after_list + price - sale_tax)
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
