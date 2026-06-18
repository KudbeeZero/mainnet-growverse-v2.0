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
    validate_launch_profile,
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


# ----- Profiles: playtest (default) vs launch (owner-ratified) -----------
def test_playtest_profile_is_default_and_free():
    # Default profile = the free-playtest base, unchanged.
    cfg = load_economy_config(profile="playtest")
    assert cfg.seed_base_cost() == 0
    assert cfg.daily_stipend == 5000
    assert float(cfg.raw["simulation"]["time_scale"]) == 0.075


def test_launch_profile_applies_owner_ratified_values():
    # The launch overlay merges the three ratified deltas over the base.
    cfg = load_economy_config(profile="launch")
    assert cfg.seed_base_cost() == 25          # no free seeds
    assert cfg.daily_stipend == 50             # small retention faucet
    assert float(cfg.raw["simulation"]["time_scale"]) == 1.0  # real-time pace
    # Everything else still inherits the base (e.g. pod prices).
    assert cfg.pod_price("basic") == 100


def test_launch_profile_passes_its_own_guards():
    validate_launch_profile(load_economy_config(profile="launch"))  # no raise


def test_launch_guard_rejects_free_seeds():
    raw = _raw()  # playtest base: base_cost 0, stipend 5000, fast clock
    with pytest.raises(EconomyConfigError):
        validate_launch_profile(EconomyConfig(raw=raw))


@pytest.mark.parametrize(
    "mutate",
    [
        lambda r: r["seeds"].__setitem__("base_cost", 10),                    # below floor
        lambda r: r.__setitem__("daily_stipend", 500),                        # above ceiling
        lambda r: r["simulation"].__setitem__("time_scale", 0.5),             # accelerated
        lambda r: r["cannabis_cup"].__setitem__("bound_prizes_to_pool", False),  # cup leak
        lambda r: r["chain"]["nft"].__setitem__("mint_fee_grow", 0),          # no mint sink
        lambda r: r["harvest_sale"].__setitem__("max_payout_grow", 0),        # no harvest cap
    ],
)
def test_launch_guard_rejects_each_unsafe_value(mutate):
    raw = copy.deepcopy(load_economy_config(profile="launch").raw)
    mutate(raw)
    with pytest.raises(EconomyConfigError):
        validate_launch_profile(EconomyConfig(raw=raw))


def test_production_refuses_non_launch_profile(monkeypatch):
    from growpodempire.config import get_settings

    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()
    try:
        with pytest.raises(EconomyConfigError):
            load_economy_config(profile="playtest")
        # Launch profile is allowed in production.
        load_economy_config(profile="launch")
    finally:
        get_settings.cache_clear()
