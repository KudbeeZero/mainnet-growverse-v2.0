"""
Pure pricing formulas. No DB, no randomness — deterministic and unit-tested.

All money is returned as a quantized Decimal.
"""

from decimal import Decimal

from ..enums import Rarity, rarity_index
from .config import EconomyConfig
from .ledger import to_money


def seed_price(rarity: "Rarity | str", cfg: EconomyConfig) -> Decimal:
    """Price of buying a single seed of the given rarity."""
    rarity = Rarity(rarity).value if not isinstance(rarity, str) else rarity
    base = cfg.seed_base_cost()
    mult = cfg.seed_rarity_multiplier(rarity)
    return to_money(base * mult)


def breeding_fee(
    rarity_a: "Rarity | str", rarity_b: "Rarity | str", cfg: EconomyConfig
) -> Decimal:
    """Fee to cross two strains; scales with the parents' average rarity tier."""
    avg_tier = (rarity_index(rarity_a) + rarity_index(rarity_b)) / 2.0
    fee = cfg.breeding_base_fee + avg_tier * cfg.breeding_rarity_fee_per_tier
    return to_money(fee)


def quality_factor(quality: float, cfg: EconomyConfig) -> float:
    """Map a 0..100 quality score to a non-linear 0.5..1.0 value multiplier."""
    exponent = float(cfg.harvest["quality_curve_exponent"])
    q = max(0.0, min(100.0, quality)) / 100.0
    return 0.5 + 0.5 * (q ** exponent)


def terpene_bonus(terpene_intensity: float, cfg: EconomyConfig) -> float:
    """A multiplier (>= 1.0) rewarding a strong dominant-terpene expression.

    `terpene_intensity` is the strongest expressed terpene (0..1); a fully
    expressed terpene earns up to `harvest_sale.terpene_premium_max`.
    """
    premium_max = float(cfg.harvest.get("terpene_premium_max", 0.0))
    return 1.0 + premium_max * max(0.0, min(1.0, terpene_intensity))


def harvest_value(
    weight_g: float,
    quality: float,
    rarity: "Rarity | str",
    cfg: EconomyConfig,
    *,
    thc_actual: float = 15.0,
    terpene_intensity: float = 0.0,
) -> Decimal:
    """Sale value of a harvest at the NPC market.

    value = effective_weight * base_per_gram * rarity_mult * thc_bonus
            * terpene_bonus * quality
    where weight above the soft cap yields diminishing marginal value.
    """
    rarity = Rarity(rarity).value if not isinstance(rarity, str) else rarity
    h = cfg.harvest

    base_per_gram = float(h["base_price_per_gram"])
    rarity_mult = float(h["rarity_multiplier"][rarity])
    thc_bonus = 1.0 + max(0.0, thc_actual - 15.0) * float(
        h["thc_bonus_per_pct_over_15"]
    )

    soft_cap = float(h["soft_cap_grams"])
    soft_factor = float(h["soft_cap_factor"])
    if weight_g <= soft_cap:
        effective_weight = weight_g
    else:
        effective_weight = soft_cap + (weight_g - soft_cap) * soft_factor

    value = (
        effective_weight
        * base_per_gram
        * rarity_mult
        * thc_bonus
        * terpene_bonus(terpene_intensity, cfg)
        * quality_factor(quality, cfg)
    )
    # Absolute payout ceiling (launch-profile guard): caps a single sale so the
    # stacked rarity x THC x terpene x quality multipliers can't mint a runaway
    # amount. Absent in the free-playtest profile (uncapped); set in the launch
    # overlay (`harvest_sale.max_payout_grow`).
    cap = h.get("max_payout_grow")
    if cap is not None:
        value = min(value, float(cap))
    return to_money(value)


def cup_score(
    weight_g: float,
    quality: float,
    rarity: "Rarity | str",
    cfg: EconomyConfig,
    *,
    thc_actual: float = 15.0,
    cbd_actual: float = 0.0,
    terpene_intensity: float = 0.0,
) -> float:
    """Deterministic, server-authoritative Cannabis Cup score (0..~100+).

    A judge's scorecard, NOT a sale price: it rewards *quality* (cure/health),
    *potency*, *terpene expression*, and a little *yield*, then applies a rarity
    prestige multiplier. Pure function of the harvest's snapshotted attributes —
    no randomness — so an entry's score is reproducible and verifiable.
    """
    rarity = Rarity(rarity).value if not isinstance(rarity, str) else rarity
    cup = cfg.raw.get("cannabis_cup", {})
    s = cup.get("scoring", {})

    weight_norm = min(1.0, max(0.0, weight_g) / float(s.get("weight_norm_grams", 150.0)))
    quality_norm = max(0.0, min(100.0, quality)) / 100.0
    thc_norm = max(0.0, min(float(s.get("thc_norm_pct", 30.0)), thc_actual)) / float(
        s.get("thc_norm_pct", 30.0)
    )
    cbd_norm = max(0.0, min(float(s.get("cbd_norm_pct", 20.0)), cbd_actual)) / float(
        s.get("cbd_norm_pct", 20.0)
    )
    terp_norm = max(0.0, min(1.0, terpene_intensity))

    base = 100.0 * (
        quality_norm * float(s.get("quality_weight", 0.35))
        + thc_norm * float(s.get("thc_weight", 0.20))
        + terp_norm * float(s.get("terpene_weight", 0.25))
        + weight_norm * float(s.get("weight_weight", 0.15))
        + cbd_norm * float(s.get("cbd_weight", 0.05))
    )
    rarity_mult = float(s.get("rarity_multiplier", {}).get(rarity, 1.0))
    return round(base * rarity_mult, 2)
