"""
Loads the YAML economy balance file into a typed, cached config object.
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, Optional

import yaml

from ..config import get_settings


@dataclass(frozen=True)
class EconomyConfig:
    """Typed view over balance.yaml (raw dict kept for forward-compat keys)."""

    raw: Dict[str, Any]

    @property
    def currency_name(self) -> str:
        return self.raw["currency"]["name"]

    @property
    def currency_decimals(self) -> int:
        return int(self.raw["currency"]["decimals"])

    @property
    def starting_balance(self) -> float:
        return float(self.raw["starting_balance"])

    @property
    def daily_stipend(self) -> float:
        return float(self.raw["daily_stipend"])

    def seed_base_cost(self) -> float:
        return float(self.raw["seeds"]["base_cost"])

    def seed_rarity_multiplier(self, rarity: str) -> float:
        return float(self.raw["seeds"]["rarity_multiplier"][rarity])

    @property
    def nutrients_cost(self) -> float:
        return float(self.raw["nutrients"]["per_application"])

    @property
    def pest_treatment_cost(self) -> float:
        return float(self.raw["pest_treatment"]["per_application"])

    @property
    def disease_treatment_cost(self) -> float:
        return float(self.raw["disease_treatment"]["per_application"])

    def pod_price(self, tier: str) -> float:
        return float(self.raw["pods"][tier])

    @property
    def breeding_base_fee(self) -> float:
        return float(self.raw["breeding"]["base_fee"])

    @property
    def breeding_rarity_fee_per_tier(self) -> float:
        return float(self.raw["breeding"]["rarity_fee_per_tier"])

    @property
    def harvest(self) -> Dict[str, Any]:
        return self.raw["harvest_sale"]

    @property
    def market(self) -> Dict[str, Any]:
        return self.raw["market"]

    @property
    def curing(self) -> Dict[str, Any]:
        return self.raw.get("curing", {})

    @property
    def research(self) -> Dict[str, Any]:
        return self.raw.get("research", {})

    @property
    def research_nodes(self) -> Dict[str, Any]:
        return self.research.get("nodes", {})

    @property
    def shop_consumables(self) -> Dict[str, Any]:
        return self.raw.get("shop", {}).get("consumables", {})

    @property
    def shop_gear(self) -> Dict[str, Dict[str, Any]]:
        """Grow-room gear catalog, flattened to {gear_key: item} across the
        lights/fans/soils groups in balance.yaml (`shop.gear`)."""
        groups = self.raw.get("shop", {}).get("gear", {})
        flat: Dict[str, Any] = {}
        for group in groups.values():
            if isinstance(group, dict):
                flat.update(group)
        return flat

    @property
    def current_season(self) -> str:
        return self.raw.get("events", {}).get("current_season", "all")

    @property
    def auto_care(self) -> Dict[str, Any]:
        return self.raw.get("auto_care", {})


def load_economy_config(path: Optional[str] = None) -> EconomyConfig:
    """Load (uncached) an EconomyConfig from a YAML path."""
    settings = get_settings()
    path = path or settings.balance_file
    with open(path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    return EconomyConfig(raw=data)


@lru_cache(maxsize=1)
def get_economy_config() -> EconomyConfig:
    """Cached default economy config from the configured balance file."""
    return load_economy_config()
