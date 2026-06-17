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
from .models import Strain
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


def main() -> None:
    # Ensure tables exist when run directly against a fresh SQLite DB.
    init_db()
    count = seed_strains()
    print(f"Seeded/updated {count} strains.")


if __name__ == "__main__":
    sys.exit(main())
