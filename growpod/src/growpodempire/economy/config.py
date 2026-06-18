"""
Loads the YAML economy balance file into a typed, cached config object.

``balance.yaml`` is the canonical economy tuning surface — every economy constant
lives there so balance can change without code changes. On load the raw values are
checked by :func:`validate_economy_config`, which guards only against *corrupting*
states (negative / NaN / inf economy values, fees outside ``[0, 1]``), NOT against
tuning choices. The current free-playtest values (e.g. ``seeds.base_cost: 0``,
``daily_stipend: 5000``) are intentional and pass validation unchanged; the final
balance is owner-ratified and is only retuned in a separate, owner-approved PR.
"""

import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, List, Optional

import yaml

from ..config import get_settings


class EconomyConfigError(ValueError):
    """Raised when ``balance.yaml`` fails economy-safety validation on load."""


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


def _is_finite_number(value: Any) -> bool:
    """True for a real, finite int/float (bools and NaN/inf are rejected)."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    return math.isfinite(float(value))


def validate_economy_config(cfg: EconomyConfig) -> None:
    """Validate the economy config for SAFETY invariants (not tuning choices).

    Rejects only genuinely-corrupting states — negative economy amounts (a
    negative cost would invert a sink into a faucet), non-finite numbers
    (NaN/inf), bad currency precision, and market fee fractions outside
    ``[0, 1]``. It deliberately ACCEPTS the current free-playtest values
    (``seeds.base_cost: 0``, ``daily_stipend: 5000``, etc.) — zero is a valid
    playtest price, and final balance is owner-ratified, not decided here.

    Raises :class:`EconomyConfigError` listing every violation found.
    """
    raw = cfg.raw
    errors: List[str] = []

    def non_negative(value: Any, label: str) -> None:
        if not _is_finite_number(value):
            errors.append(f"{label} must be a finite number, got {value!r}")
        elif float(value) < 0:
            errors.append(
                f"{label} must be >= 0 (a negative would invert a faucet/sink), got {value}"
            )

    def fraction(value: Any, label: str) -> None:
        if not _is_finite_number(value):
            errors.append(f"{label} must be a finite number, got {value!r}")
        elif not 0.0 <= float(value) <= 1.0:
            errors.append(f"{label} must be within [0, 1], got {value}")

    decimals = raw.get("currency", {}).get("decimals")
    if isinstance(decimals, bool) or not isinstance(decimals, int) or decimals < 0:
        errors.append(f"currency.decimals must be a non-negative int, got {decimals!r}")

    # Top-level faucets.
    non_negative(raw.get("starting_balance"), "starting_balance")
    non_negative(raw.get("daily_stipend"), "daily_stipend")

    # Seeds (sink) + rarity multipliers.
    seeds = raw.get("seeds", {})
    non_negative(seeds.get("base_cost"), "seeds.base_cost")
    for rarity, mult in (seeds.get("rarity_multiplier") or {}).items():
        non_negative(mult, f"seeds.rarity_multiplier.{rarity}")

    # Per-application care sinks.
    non_negative(raw.get("nutrients", {}).get("per_application"), "nutrients.per_application")
    non_negative(raw.get("pest_treatment", {}).get("per_application"), "pest_treatment.per_application")
    non_negative(raw.get("disease_treatment", {}).get("per_application"), "disease_treatment.per_application")

    # Pod prices (sinks).
    for tier, price in (raw.get("pods") or {}).items():
        non_negative(price, f"pods.{tier}")

    # Breeding fees (sinks).
    breeding = raw.get("breeding", {})
    non_negative(breeding.get("base_fee"), "breeding.base_fee")
    non_negative(breeding.get("rarity_fee_per_tier"), "breeding.rarity_fee_per_tier")

    # Harvest sale (faucet).
    harvest = raw.get("harvest_sale", {})
    non_negative(harvest.get("base_price_per_gram"), "harvest_sale.base_price_per_gram")
    non_negative(harvest.get("soft_cap_grams"), "harvest_sale.soft_cap_grams")
    for rarity, mult in (harvest.get("rarity_multiplier") or {}).items():
        non_negative(mult, f"harvest_sale.rarity_multiplier.{rarity}")

    # Market fees are fractions of a price (burned), so must be in [0, 1].
    market = raw.get("market", {})
    if "listing_fee_pct" in market:
        fraction(market.get("listing_fee_pct"), "market.listing_fee_pct")
    if "sale_tax_pct" in market:
        fraction(market.get("sale_tax_pct"), "market.sale_tax_pct")

    # Research node costs (sinks).
    for key, node in (raw.get("research", {}).get("nodes") or {}).items():
        if isinstance(node, dict) and "cost" in node:
            non_negative(node.get("cost"), f"research.nodes.{key}.cost")

    if errors:
        raise EconomyConfigError(
            "balance.yaml failed economy-safety validation:\n  - " + "\n  - ".join(errors)
        )


def load_economy_config(path: Optional[str] = None) -> EconomyConfig:
    """Load (uncached) an EconomyConfig from a YAML path, validated on load."""
    settings = get_settings()
    path = path or settings.balance_file
    with open(path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    cfg = EconomyConfig(raw=data)
    validate_economy_config(cfg)
    return cfg


@lru_cache(maxsize=1)
def get_economy_config() -> EconomyConfig:
    """Cached default economy config from the configured balance file."""
    return load_economy_config()
