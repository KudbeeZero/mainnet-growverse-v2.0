"""
Idempotent strain-catalog seeder.

Loads data/strains.yaml and upserts each strain by slug, so re-running never
creates duplicates. Genome and display ranges are derived from the declared
trait values + stability. Safe to run as a Render post-migrate hook.

Usage:
    python -m growpodempire.db.seed
"""

import re
import sys
from typing import Dict

import yaml

from ..config import get_settings
from ..enums import Rarity, LineageType
from ..genetics.traits import genome_from_traits, terpene_genes_from_tags
from ..genetics.breeding import derive_strain_fields
from .models import Strain, StorePartner, FeaturedItem, Bundle
from .session import session_scope, init_db


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug


def _build_strain_kwargs(entry: Dict) -> Dict:
    # Seed quantitative terpene genes from the catalog's qualitative tags, unless
    # the entry already declares explicit terpene trait values.
    traits = {**terpene_genes_from_tags(entry.get("terpenes")), **entry["traits"]}
    dominant = {t: "dominant" for t in entry.get("dominant", [])}
    genome = genome_from_traits(traits, dominant)
    stability = float(entry.get("stability", 1.0))
    fields = derive_strain_fields(genome, stability)

    # Validate enums early for a clear error if the catalog is malformed.
    rarity = Rarity(entry["rarity"]).value
    lineage = LineageType(entry["lineage_type"]).value

    return {
        "name": entry["name"],
        "slug": slugify(entry["name"]),
        "lineage_type": lineage,
        "rarity": rarity,
        "season": entry.get("season", "all"),
        "terpenes": entry.get("terpenes", []),
        "genome": genome,
        "stability": stability,
        "generation": 0,
        "is_base_catalog": True,
        **fields,
    }


def seed_strains(path: str = None) -> int:
    """Upsert all catalog strains. Returns the number of rows seen."""
    settings = get_settings()
    path = path or settings.strains_file
    with open(path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)

    entries = data["strains"]
    with session_scope() as session:
        for entry in entries:
            kwargs = _build_strain_kwargs(entry)
            existing = (
                session.query(Strain)
                .filter(Strain.slug == kwargs["slug"])
                .one_or_none()
            )
            if existing is None:
                session.add(Strain(**kwargs))
            else:
                for key, value in kwargs.items():
                    setattr(existing, key, value)
    return len(entries)


def seed_store(session=None) -> None:
    """Seed placeholder dispensary partners, featured items, and bundle deals."""
    from decimal import Decimal

    def _run(s):
        # --- Partners (idempotent by name) ---
        PARTNERS = [
            {
                "name": "Green Thumb Collective",
                "logo_url": "https://placehold.co/80x80/1a3a1a/4ade80?text=GTC",
                "tagline": "Farm-to-bong, since 2018",
                "product_type": "consumable",
                "product_id": "bloom_booster",
                "price_gc": Decimal("55"),
                "display_order": 0,
            },
            {
                "name": "Pacific Peaks Dispensary",
                "logo_url": "https://placehold.co/80x80/0a2a3a/60a5fa?text=PPD",
                "tagline": "Summit-quality genetics, every drop",
                "product_type": "consumable",
                "product_id": "rejuvenation_tonic",
                "price_gc": Decimal("75"),
                "display_order": 1,
            },
            {
                "name": "Urban Harvest Co.",
                "logo_url": "https://placehold.co/80x80/2a1a3a/a78bfa?text=UHC",
                "tagline": "City-grown, craft-curated",
                "product_type": "consumable",
                "product_id": "cal_mag_boost",
                "price_gc": Decimal("28"),
                "display_order": 2,
            },
        ]
        for p_data in PARTNERS:
            existing = (
                s.query(StorePartner).filter(StorePartner.name == p_data["name"]).one_or_none()
            )
            if existing is None:
                s.add(StorePartner(**p_data))

        # --- Featured items (idempotent by item_id+item_type) ---
        FEATURED = [
            {
                "item_type": "consumable",
                "item_id": "cal_mag_boost",
                "label": "Cal-Mag Boost — Nutrient deal of the week",
                "badge": "new",
            },
            {
                "item_type": "consumable",
                "item_id": "rejuvenation_tonic",
                "label": "Rejuvenation Tonic — Rescue any struggling plant",
                "badge": "limited",
            },
        ]
        for f_data in FEATURED:
            existing = (
                s.query(FeaturedItem)
                .filter(
                    FeaturedItem.item_type == f_data["item_type"],
                    FeaturedItem.item_id == f_data["item_id"],
                )
                .one_or_none()
            )
            if existing is None:
                s.add(FeaturedItem(**f_data))

        # --- Bundles (idempotent by name) ---
        BUNDLES = [
            {
                "name": "Bloom Bundle",
                "description": "Bloom Booster + Neem Oil + Cal-Mag — all you need for a perfect flowering run",
                "discount_pct": 0.15,
                "components": [
                    {"type": "consumable", "key": "bloom_booster", "qty": 1},
                    {"type": "consumable", "key": "neem_oil", "qty": 1},
                    {"type": "consumable", "key": "cal_mag_boost", "qty": 1},
                ],
                "active": True,
            },
            {
                "name": "IPM Starter Kit",
                "description": "Ladybugs + Neem Oil + Rejuvenation Tonic — the complete pest & disease toolkit",
                "discount_pct": 0.10,
                "components": [
                    {"type": "consumable", "key": "ladybugs", "qty": 1},
                    {"type": "consumable", "key": "neem_oil", "qty": 1},
                    {"type": "consumable", "key": "rejuvenation_tonic", "qty": 1},
                ],
                "active": True,
            },
        ]
        for b_data in BUNDLES:
            existing = s.query(Bundle).filter(Bundle.name == b_data["name"]).one_or_none()
            if existing is None:
                s.add(Bundle(**b_data))

    if session is not None:
        _run(session)
    else:
        with session_scope() as s:
            _run(s)


def main() -> None:
    # Ensure tables exist when run directly against a fresh SQLite DB.
    init_db()
    count = seed_strains()
    seed_store()
    print(f"Seeded/updated {count} strains + store data.")


if __name__ == "__main__":
    sys.exit(main())
