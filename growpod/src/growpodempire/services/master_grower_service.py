"""
MasterGrowerService — the read-only toolbox + orchestration behind the FREE
"Master Grower" conversational bot.

It implements the four grounding tools the provider may call, and it implements
them by REUSING shipped code: plant state and diagnosis come straight from
`AdvisorService`; strain lookup hits the live `Strain` table and merges the
static knowledge base; knowledge search scans `load_strain_knowledge()`. Every
tool is a pure read — no writes, no ledger, no spend, no entitlement. There is
nothing to pay for here; the feature is free.

`ask()` binds the in-scope player/plant onto the service itself (which IS the
`MasterGrowerTools` handle) and delegates to the configured provider — the
deterministic offline mock by default, so the whole path runs in CI with no key.
"""

from typing import List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

import yaml

from ..ai.factory import shared_master_grower
from ..ai.provider import AdvisorReport, MasterGrowerProvider, MasterGrowerReport
from ..db.models import Strain
from .advisor_service import AdvisorService
from .game_service import load_strain_knowledge


class MasterGrowerService:
    """Read-only toolbox for the Master Grower bot. Implements MasterGrowerTools."""

    def __init__(
        self,
        session: Session,
        provider: Optional[MasterGrowerProvider] = None,
    ):
        self.session = session
        self.provider = provider or shared_master_grower()
        # In-scope plant for the current question (set by `ask`); lets the
        # provider call the plant tools without restating ids.
        self.player_id: Optional[str] = None
        self.plant_id: Optional[str] = None

    # ------------------------------------------------------------ tools (read)
    def get_plant_state(self, player_id: str, plant_id: str) -> dict:
        """Live plant-state context — reuses AdvisorService.build_context."""
        return AdvisorService(self.session).build_context(player_id, plant_id)

    def diagnose_plant(self, player_id: str, plant_id: str) -> AdvisorReport:
        """A full advisor diagnosis — reuses AdvisorService.advise."""
        return AdvisorService(self.session).advise(player_id, plant_id)

    def lookup_strain(self, query: str) -> Optional[dict]:
        """Case-insensitive match a Strain by name/slug; return its public traits
        merged with its strain_knowledge.yaml entry (if any). None if not found."""
        q = (query or "").strip()
        if not q:
            return None
        strain = (
            self.session.query(Strain)
            .filter(or_(Strain.name.ilike(q), Strain.slug.ilike(q)))
            .order_by(Strain.is_base_catalog.desc(), Strain.name)
            .first()
        )
        if strain is None:
            return None
        knowledge = load_strain_knowledge().get(strain.slug)
        return {
            "name": strain.name,
            "slug": strain.slug,
            "traits": {
                "rarity": strain.rarity,
                "lineage_type": strain.lineage_type,
                "indica_ratio": strain.indica_ratio,
                "thc_min": strain.thc_min,
                "thc_max": strain.thc_max,
                "cbd_min": strain.cbd_min,
                "cbd_max": strain.cbd_max,
                "flowering_days_min": strain.flowering_days_min,
                "flowering_days_max": strain.flowering_days_max,
                "yield_min": strain.yield_min,
                "yield_max": strain.yield_max,
                "difficulty": strain.difficulty,
                "terpenes": strain.terpenes or [],
            },
            "lineage_type": strain.lineage_type,
            "in_knowledge_base": knowledge is not None,
            "knowledge": knowledge,
        }

    def search_knowledge(self, query: str) -> List[dict]:
        """Keyword-search the strain knowledge base. Matches query terms against
        each entry's slug + serialized text; returns up to ~3 {'slug','snippet'}."""
        terms = [t for t in (query or "").lower().split() if len(t) > 2]
        if not terms:
            return []
        hits: List[dict] = []
        for slug, entry in load_strain_knowledge().items():
            text = (slug + " " + yaml.safe_dump(entry, sort_keys=False)).lower()
            score = sum(text.count(t) for t in terms)
            if score:
                snippet = self._snippet(slug, entry)
                hits.append({"slug": slug, "snippet": snippet, "_score": score})
        hits.sort(key=lambda h: h["_score"], reverse=True)
        return [{"slug": h["slug"], "snippet": h["snippet"]} for h in hits[:3]]

    @staticmethod
    def _snippet(slug: str, entry: dict) -> str:
        """A compact, factual one-liner drawn from a knowledge entry."""
        parts = [slug]
        for key in ("lineage", "genotype", "effects", "cannabinoids"):
            val = entry.get(key)
            if val:
                parts.append(f"{key}: {val}")
        return " | ".join(str(p) for p in parts)[:300]

    # ------------------------------------------------------------ orchestration
    def ask(
        self,
        question: str,
        *,
        player_id: Optional[str] = None,
        plant_id: Optional[str] = None,
    ) -> MasterGrowerReport:
        """Answer a question via the configured (grounded, refusing) provider.

        Read-only end to end: the provider may call the tools above but nothing
        writes. `player_id`/`plant_id` scope the optional plant tools.
        """
        self.player_id = player_id
        self.plant_id = plant_id
        return self.provider.answer(question, self)
