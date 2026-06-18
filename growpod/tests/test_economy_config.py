"""Economy config: canonical load + safety validation.

These prove (1) the shipped balance.yaml — including its intentional free-playtest
values — loads and validates, (2) values are preserved verbatim (PR-1 changes no
tuning), and (3) validation rejects only CORRUPTING states (negative / NaN / inf /
out-of-range fees), never legitimate tuning. Final balance is owner-ratified and is
NOT decided here.
"""
import copy
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.economy.config import (  # noqa: E402
    EconomyConfig,
    EconomyConfigError,
    load_economy_config,
    validate_economy_config,
)


def _raw():
    return copy.deepcopy(load_economy_config().raw)


def test_shipped_balance_yaml_loads_and_validates():
    # load_economy_config validates on load; an explicit re-check documents intent.
    cfg = load_economy_config()
    validate_economy_config(cfg)  # must not raise


def test_load_preserves_current_values_unchanged():
    # PR-1 is safety-only: the current free-playtest baseline is preserved exactly.
    cfg = load_economy_config()
    assert cfg.seed_base_cost() == 0       # free seeds (intentional playtest value)
    assert cfg.daily_stipend == 5000       # owner-ratified, intentionally unchanged
    assert cfg.starting_balance == 500


def test_zero_values_are_allowed_not_a_failure():
    # Zero is a valid playtest price, not a corruption — validation must accept it.
    raw = _raw()
    raw["seeds"]["base_cost"] = 0
    validate_economy_config(EconomyConfig(raw=raw))  # no raise


def test_negative_seed_cost_rejected():
    raw = _raw()
    raw["seeds"]["base_cost"] = -1
    with pytest.raises(EconomyConfigError):
        validate_economy_config(EconomyConfig(raw=raw))


def test_negative_stipend_rejected():
    raw = _raw()
    raw["daily_stipend"] = -100
    with pytest.raises(EconomyConfigError):
        validate_economy_config(EconomyConfig(raw=raw))


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), float("-inf")])
def test_non_finite_numbers_rejected(bad):
    raw = _raw()
    raw["harvest_sale"]["base_price_per_gram"] = bad
    with pytest.raises(EconomyConfigError):
        validate_economy_config(EconomyConfig(raw=raw))


@pytest.mark.parametrize("pct", [-0.01, 1.5])
def test_market_fee_out_of_unit_range_rejected(pct):
    raw = _raw()
    raw["market"]["sale_tax_pct"] = pct
    with pytest.raises(EconomyConfigError):
        validate_economy_config(EconomyConfig(raw=raw))


def test_negative_rarity_multiplier_rejected():
    raw = _raw()
    raw["harvest_sale"]["rarity_multiplier"]["legendary"] = -8.0
    with pytest.raises(EconomyConfigError):
        validate_economy_config(EconomyConfig(raw=raw))


def test_error_lists_every_violation():
    raw = _raw()
    raw["seeds"]["base_cost"] = -1
    raw["daily_stipend"] = -5
    with pytest.raises(EconomyConfigError) as ei:
        validate_economy_config(EconomyConfig(raw=raw))
    msg = str(ei.value)
    assert "seeds.base_cost" in msg
    assert "daily_stipend" in msg


def test_load_raises_on_corrupt_file(tmp_path):
    bad = tmp_path / "balance.yaml"
    raw = _raw()
    raw["pods"]["basic"] = -100
    import yaml

    bad.write_text(yaml.safe_dump(raw), encoding="utf-8")
    with pytest.raises(EconomyConfigError):
        load_economy_config(str(bad))
