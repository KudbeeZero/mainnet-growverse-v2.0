"""Canonical LAUNCH economy config for launch-value guard tests.

The live ``balance.yaml`` is intentionally in "free testing mode" (free seeds,
boosted daily stipend) so the test environment is frictionless. The launch
economic invariants (seed pricing scales with rarity, stipend is a small faucet,
purchases debit, insufficient funds raise) must stay guarded regardless of that
live tuning.

``launch_config()`` loads the live economy config and overlays the canonical
launch values from ``tests/fixtures/launch_balance.yaml`` (only the keys that are
in testing mode), so structural changes to ``balance.yaml`` are tracked while the
testing-mode tuning is neutralised for these tests.
"""

import copy
import os
from typing import Any, Dict

import yaml

from growpodempire.economy.config import EconomyConfig, load_economy_config

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "launch_balance.yaml")


def launch_overrides() -> Dict[str, Any]:
    """The canonical launch values for the keys held in testing mode."""
    with open(FIXTURE_PATH, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def _deep_merge(base: Dict[str, Any], over: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in over.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value
    return base


def launch_config() -> EconomyConfig:
    """Live economy config with the launch values overlaid."""
    raw = copy.deepcopy(load_economy_config().raw)
    _deep_merge(raw, launch_overrides())
    return EconomyConfig(raw=raw)
