"""
Shared enumerations used across the persistence, economy, and genetics layers.

Kept in one place so the SQLAlchemy ORM, the Pydantic API schemas, and the game
services all reference an identical contract.
"""

from enum import Enum


class GrowthStage(str, Enum):
    """Growth stages of a cannabis plant (mirrors models.GrowthStage)."""
    SEED = "seed"
    GERMINATION = "germination"
    SEEDLING = "seedling"
    VEGETATIVE = "vegetative"
    FLOWERING = "flowering"
    LATE_FLOWER = "late_flower"
    HARVEST = "harvest"


class Rarity(str, Enum):
    """Strain / asset rarity tiers (ordered low -> high)."""
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    EPIC = "epic"
    LEGENDARY = "legendary"


# Ordered for index/comparison math (e.g. pricing, rarity rolls).
RARITY_ORDER = [
    Rarity.COMMON,
    Rarity.UNCOMMON,
    Rarity.RARE,
    Rarity.EPIC,
    Rarity.LEGENDARY,
]


def rarity_index(rarity: "Rarity | str") -> int:
    """Return the 0-based tier index of a rarity value."""
    r = Rarity(rarity) if not isinstance(rarity, Rarity) else rarity
    return RARITY_ORDER.index(r)


class LineageType(str, Enum):
    """Where a strain's genetics originate."""
    LANDRACE = "landrace"
    HYBRID = "hybrid"
    BRED = "bred"


class SeedSource(str, Enum):
    """How a seed stack entered a player's inventory."""
    STARTER = "starter"
    PURCHASED = "purchased"
    BRED = "bred"
    MARKET = "market"


class LedgerEntryType(str, Enum):
    """Currency movement categories (faucets and sinks)."""
    STARTING_GRANT = "starting_grant"
    DAILY_STIPEND = "daily_stipend"
    SEED_PURCHASE = "seed_purchase"
    NUTRIENT_PURCHASE = "nutrient_purchase"
    POD_PURCHASE = "pod_purchase"
    PEST_TREATMENT = "pest_treatment"
    DISEASE_TREATMENT = "disease_treatment"
    HARVEST_SALE = "harvest_sale"
    MARKET_SALE = "market_sale"
    MARKET_BUY = "market_buy"
    MARKET_FEE = "market_fee"
    BREEDING_FEE = "breeding_fee"
    REWARD = "reward"
    AUCTION_BID = "auction_bid"
    AUCTION_REFUND = "auction_refund"
    ASA_WITHDRAWAL = "asa_withdrawal"
    ASA_DEPOSIT = "asa_deposit"
    RESEARCH_UNLOCK = "research_unlock"
    SHOP_PURCHASE = "shop_purchase"
    ADJUSTMENT = "adjustment"
    CUP_ENTRY_FEE = "cup_entry_fee"        # sink: charged to enter a seasonal cup
    CUP_PRIZE_PAYOUT = "cup_prize_payout"  # faucet: awarded to cup placers
    TUITION = "tuition"                    # sink: GrowPod University course enrollment
    POD_CLEANUP = "pod_cleanup"            # sink: paid to clear a harvested/dead plant
    GROWTH_BOOST = "growth_boost"          # sink: paid to fast-forward + revive a plant
    STAKING_REWARD = "staking_reward"      # faucet: post-cure bonus GC from an NFT staking lock


class ListingStatus(str, Enum):
    """Lifecycle of a marketplace listing."""
    ACTIVE = "active"
    SOLD = "sold"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ListingItemType(str, Enum):
    """What kind of item a marketplace listing sells."""
    SEED = "seed"
    HARVEST = "harvest"


class NFTStatus(str, Enum):
    """On-chain minting state for harvests / stabilized strains (Phase 3)."""
    NONE = "none"
    PENDING = "pending"
    MINTED = "minted"
    FAILED = "failed"


class NFTAssetType(str, Enum):
    """What kind of game entity an `NFTAsset` marketplace-tracking row wraps.

    Only HARVEST is wired up (Sprint 4 MVP); SEED is reserved for the design
    doc's full scope (seed NFTs) and is not yet produced anywhere.
    """
    HARVEST = "harvest"
    SEED = "seed"


class NFTAssetStatus(str, Enum):
    """Marketplace lifecycle of a minted `NFTAsset` (distinct from the
    on-chain `NFTStatus` of the underlying Harvest, which only tracks
    none/pending/minted/failed)."""
    MINTED = "minted"
    LISTED = "listed"
    STAKING = "staking"
    TRADED = "traded"


class NFTTradeStatus(str, Enum):
    """Settlement state of an `NFTTrade` row."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"


class StakingLockStatus(str, Enum):
    """Lifecycle of a `StakingLock` (the "curing room" — cure = staking)."""
    ACTIVE = "active"
    COMPLETE = "complete"
    WITHDRAWN = "withdrawn"
