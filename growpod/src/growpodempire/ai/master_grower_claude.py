"""
Claude-backed Master Grower — the real provider behind the FREE bot.

Mirrors ClaudeLecturerProvider: the official Anthropic SDK with structured
outputs returns a validated MasterGrowerReport; `anthropic` is imported lazily
so the mock path needs no dependency or key.

Grounding model: ONE cheap API call per question. The provider pre-fetches the
read-only tool results itself (plant state + diagnosis when the ask is
plant-scoped, strain lookup + knowledge search from the question text) and
hands them to Claude as the ONLY permitted sources — the model must answer
from them, cite them, and refuse out-of-scope asks. This keeps cost flat and
predictable (no agentic tool loop) on a small-model budget.
"""

import json
import logging

from .provider import (
    AdvisorError,
    MasterGrowerProvider,
    MasterGrowerReport,
    MasterGrowerTools,
)

logger = logging.getLogger("growpodempire.master_grower")

# Small, cheap model by default — the bot is free for players, so its unit cost
# must stay near zero. Override via MASTER_GROWER_MODEL.
_MODEL_DEFAULT = "claude-haiku-4-5-20251001"

_SYSTEM_PROMPT = (
    "You are the Master Grower of GrowVerse — a free, in-game cannabis "
    "cultivation mentor. You receive a JSON payload with the player's question "
    "and a `sources` object holding the ONLY material you may rely on: "
    "optionally the live plant state and an advisor diagnosis, a strain record, "
    "and knowledge-base entries. Answer the question using facts from those "
    "sources ONLY, and cite each source you used (source = its key path, "
    "snippet = the exact text/figure relied on). If the sources don't contain "
    "enough to answer, say so plainly rather than inventing figures. REFUSE "
    "(refused=true, empty citations) any legal or medical advice ask and any "
    "pay-to-win 'what should I buy to win' ask — GrowVerse is free and "
    "complete; include a short disclaimer explaining the refusal. Keep answers "
    "tight and practical; suggest concrete in-game care actions only when the "
    "sources support them."
)


class ClaudeMasterGrower(MasterGrowerProvider):
    def __init__(self, api_key: str, model: str = _MODEL_DEFAULT):
        if not api_key:
            raise AdvisorError("ANTHROPIC_API_KEY is required for the Claude Master Grower")
        try:
            import anthropic  # lazy: only needed on the real path
        except ImportError as exc:  # pragma: no cover
            raise AdvisorError("the 'anthropic' package is not installed") from exc

        self._model = model
        self._client = anthropic.Anthropic(api_key=api_key)

    def name(self) -> str:
        return f"claude:{self._model}"

    # ----- grounding ------------------------------------------------------
    def _gather_sources(self, question: str, tools: MasterGrowerTools) -> dict:
        """Pre-fetch every read-only source the model may cite. Tool failures
        degrade to an absent source, never to a failed answer."""
        sources: dict = {}
        player_id = getattr(tools, "player_id", None)
        plant_id = getattr(tools, "plant_id", None)
        if player_id and plant_id:
            try:
                sources["plant_state"] = tools.get_plant_state(player_id, plant_id)
            except Exception as exc:
                logger.warning("plant_state tool failed: %s", exc)
            try:
                sources["diagnosis"] = tools.diagnose_plant(player_id, plant_id).model_dump()
            except Exception as exc:
                logger.warning("diagnose tool failed: %s", exc)
        try:
            strain = tools.lookup_strain(question)
            if strain:
                sources["strain"] = strain
        except Exception as exc:
            logger.warning("strain tool failed: %s", exc)
        try:
            knowledge = tools.search_knowledge(question)
            if knowledge:
                sources["knowledge"] = knowledge
        except Exception as exc:
            logger.warning("knowledge tool failed: %s", exc)
        return sources

    # ----- provider entrypoint ---------------------------------------------
    def answer(self, question: str, tools: MasterGrowerTools) -> MasterGrowerReport:
        payload = {"question": question, "sources": self._gather_sources(question, tools)}
        try:
            response = self._client.messages.parse(
                model=self._model,
                max_tokens=1500,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
                output_format=MasterGrowerReport,
            )
        except Exception as exc:
            req_id = getattr(exc, "request_id", None)
            logger.warning("master-grower request failed (request_id=%s): %s", req_id, exc)
            raise AdvisorError(f"master grower backend error: {exc}") from exc

        report = response.parsed_output
        if report is None:
            raise AdvisorError("master grower returned no structured output")
        return report
