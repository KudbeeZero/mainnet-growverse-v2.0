"""
Deterministic, offline Master Grower — the CI/no-key default.

Classifies a question by keywords, then either REFUSES (legal/medical advice or
pay-to-win "what should I buy to win" asks) or routes to one of the read-only
tools and answers strictly from that tool's output. It never invents figures:
every number in the answer is pulled verbatim from a cited tool result, and a
non-refused substantive answer always carries at least one Citation. No network,
no randomness — the whole path runs free in CI. The real, free-form provider
would be a later `ClaudeMasterGrower` sub-deliverable.

The bound tools handle (MasterGrowerService) exposes the in-scope plant via
`.player_id` / `.plant_id` so this provider can call the plant tools without the
question having to restate ids.
"""

from typing import List

from .provider import (
    Citation,
    MasterGrowerProvider,
    MasterGrowerReport,
    MasterGrowerTools,
)

# Educational disclaimer attached to legal/medical-adjacent (but answerable)
# horticulture answers, and to refusals of legal/medical asks.
_EDU_DISCLAIMER = "This is educational, not legal or medical advice."

# Refuse to coach buying advantages — the game is free and complete.
_P2W_DISCLAIMER = (
    "I won't advise buying advantages — GrowVerse is free and complete, and skill "
    "(not spend) is how you win. Ask me about growing technique or strains instead."
)

# Keyword buckets for classification (lowercased substring match).
_LEGAL_MEDICAL = (
    "is this legal", "is it legal", "legal to", "illegal", "lawyer",
    "dosage", "dose", "how much should i take", "medical", "prescription",
    "cure my", "treat my anxiety", "treat my pain", "diagnose me", "mg of thc",
    "how much thc should i", "get high", "ingest",
)
_PAY_TO_WIN = (
    "pay to win", "pay-to-win", "buy to win", "buy xp", "buy levels",
    "win fastest", "fastest way to spend", "buy to win fastest",
    "spend money to win", "buy advantages", "buy power", "buy my way",
    "fastest way to win", "what should i buy", "what do i buy",
)
_PLANT_WORDS = (
    "my plant", "this plant", "plant state", "health", "diagnose", "diagnosis",
    "wilting", "yellowing", "sick", "dying", "what's wrong", "whats wrong",
    "wrong with", "care for my", "underwater", "overwater", "should i water",
    "should i feed",
)


class MockMasterGrower(MasterGrowerProvider):
    def name(self) -> str:
        return "mock"

    def answer(self, question: str, tools: MasterGrowerTools) -> MasterGrowerReport:
        q = (question or "").lower()

        # ---- Refusals (pay-to-win first, then legal/medical) -----------------
        if any(k in q for k in _PAY_TO_WIN):
            return MasterGrowerReport(
                answer=(
                    "I can't help you buy your way to a win. GrowVerse is free and "
                    "complete — there's nothing to purchase for power, and progress "
                    "comes from growing skill, not spending. Happy to coach technique."
                ),
                refused=True,
                disclaimer=_P2W_DISCLAIMER,
            )

        if any(k in q for k in _LEGAL_MEDICAL):
            return MasterGrowerReport(
                answer=(
                    "I can't give legal or medical advice — that's outside what an "
                    "in-game grow coach should weigh in on. I can help with "
                    "cultivation technique and the strain encyclopedia instead."
                ),
                refused=True,
                disclaimer=_EDU_DISCLAIMER,
            )

        # ---- Plant-state / health / diagnosis route --------------------------
        player_id = getattr(tools, "player_id", None)
        plant_id = getattr(tools, "plant_id", None)
        if any(k in q for k in _PLANT_WORDS) and player_id and plant_id:
            return self._answer_plant(player_id, plant_id, tools)

        # ---- Strain / knowledge route (default for substantive questions) ----
        return self._answer_strain(question, tools)

    # ------------------------------------------------------------------ plant
    def _answer_plant(
        self, player_id: str, plant_id: str, tools: MasterGrowerTools
    ) -> MasterGrowerReport:
        report = tools.diagnose_plant(player_id, plant_id)
        plant = tools.get_plant_state(player_id, plant_id).get("plant", {})
        citations = [
            Citation(
                source="plant_state",
                snippet=(
                    f"stage={plant.get('growth_stage')}, "
                    f"health={plant.get('health')}, "
                    f"water_level={plant.get('water_level')}, "
                    f"nutrient_level={plant.get('nutrient_level')}, "
                    f"pest_level={plant.get('pest_level')}, "
                    f"disease_level={plant.get('disease_level')}"
                ),
            )
        ]
        # Answer text reuses ONLY the advisor's own grounded prose + the cited
        # state snippet — no figures are introduced that aren't in the citation.
        answer = f"{report.summary} {report.diagnosis}".strip()
        actions = [s.action for s in report.suggestions]
        return MasterGrowerReport(
            answer=answer,
            citations=citations,
            suggested_actions=actions,
        )

    # ----------------------------------------------------------------- strain
    def _answer_strain(
        self, question: str, tools: MasterGrowerTools
    ) -> MasterGrowerReport:
        # Try a direct strain lookup using the most distinctive token(s) first,
        # then progressively shorter phrases, so "Tell me about Afghani" resolves
        # to the afghani strain.
        strain = self._lookup_best(question, tools)
        if strain is not None:
            slug = strain.get("slug", "?")
            traits = strain.get("traits", {})
            snippet = (
                f"{strain.get('name')} ({slug}): rarity={traits.get('rarity')}, "
                f"thc={traits.get('thc_min')}-{traits.get('thc_max')}%, "
                f"cbd={traits.get('cbd_min')}-{traits.get('cbd_max')}%, "
                f"indica_ratio={traits.get('indica_ratio')}, "
                f"flowering_days={traits.get('flowering_days_min')}-"
                f"{traits.get('flowering_days_max')}, "
                f"difficulty={traits.get('difficulty')}/5, "
                f"terpenes={traits.get('terpenes')}"
            )
            citations = [Citation(source=f"strain_knowledge:{slug}", snippet=snippet)]
            answer = (
                f"{strain.get('name')} is a {traits.get('rarity')} "
                f"{strain.get('lineage_type')} strain. THC runs "
                f"{traits.get('thc_min')}-{traits.get('thc_max')}% and CBD "
                f"{traits.get('cbd_min')}-{traits.get('cbd_max')}%, indica ratio "
                f"{traits.get('indica_ratio')}, flowering in about "
                f"{traits.get('flowering_days_min')}-"
                f"{traits.get('flowering_days_max')} days "
                f"(difficulty {traits.get('difficulty')}/5)."
            )
            return MasterGrowerReport(answer=answer, citations=citations)

        # Fall back to a keyword search of the knowledge base.
        hits = tools.search_knowledge(question)
        if hits:
            citations = [
                Citation(source=f"strain_knowledge:{h['slug']}", snippet=h["snippet"])
                for h in hits
            ]
            lead = hits[0]
            answer = (
                f"From the strain encyclopedia, the closest match is "
                f"'{lead['slug']}': {lead['snippet']}"
            )
            return MasterGrowerReport(answer=answer, citations=citations)

        # No tool yielded data — say so honestly, fabricate nothing.
        return MasterGrowerReport(
            answer=(
                "I don't have grounded data to answer that. Ask me about a strain in "
                "the catalog (by name) or about a specific plant you're growing."
            ),
            citations=[],
        )

    @staticmethod
    def _lookup_best(question: str, tools: MasterGrowerTools):
        """Try whole-question, then trailing 1-3 word phrases, as a strain name."""
        candidates: List[str] = [question]
        words = [w.strip(".,!?;:'\"") for w in question.split() if w.strip(".,!?;:'\"")]
        for n in (3, 2, 1):
            if len(words) >= n:
                candidates.append(" ".join(words[-n:]))
        seen = set()
        for cand in candidates:
            key = cand.lower()
            if not key or key in seen:
                continue
            seen.add(key)
            hit = tools.lookup_strain(cand)
            if hit is not None:
                return hit
        return None
