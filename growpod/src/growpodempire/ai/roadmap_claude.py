"""
Claude-backed Roadmap agent (Phase 6d).

Uses MockRoadmap's deterministic topological sort to build a prerequisite-
respecting study path (guaranteeing real skill_ids), then asks Claude to
write a personalized, motivating rationale. This keeps the mathematical
correctness of the deterministic plan while adding a human-quality explanation
of *why* this path is the right one for this specific learner. `anthropic` is
imported lazily so the mock path never needs a key or network access.
"""

from __future__ import annotations

import json
import logging

from pydantic import BaseModel

from .provider import RoadmapError, RoadmapPlan, RoadmapProvider

logger = logging.getLogger("growpodempire.roadmap")

_MODEL_DEFAULT = "claude-haiku-4-5-20251001"

_SYSTEM_PROMPT = (
    "You are the Academic Advisor at GrowPod University in the cannabis "
    "cultivation game GROWv2. You receive a JSON payload describing a learner's "
    "personalized study path: how many skills they've already mastered, how many "
    "remain, the first and last skills in the path, the subject domains covered, "
    "and the number of study days. Write a motivating 2-3 sentence rationale that "
    "explains why this path is the right one for this learner — what they'll build "
    "first, why the order makes sense, and what they'll be capable of by the end. "
    "Be specific and encouraging. If all skills are mastered, congratulate the "
    "learner warmly."
)


class _ClaudeRationale(BaseModel):
    rationale: str


class ClaudeRoadmap(RoadmapProvider):
    def __init__(self, api_key: str, model: str = _MODEL_DEFAULT):
        if not api_key:
            raise RoadmapError("ANTHROPIC_API_KEY is required for ClaudeRoadmap")
        try:
            import anthropic  # lazy: only needed on the real path
        except ImportError as exc:  # pragma: no cover
            raise RoadmapError("the 'anthropic' package is not installed") from exc

        self._model = model
        self._client = anthropic.Anthropic(api_key=api_key)

    def name(self) -> str:
        return f"claude:{self._model}"

    def recommend(self, *, mastery_by_skill: dict, horizon_days: int = 7) -> RoadmapPlan:
        from .roadmap_mock import MockRoadmap

        # Build the structurally-correct plan first (guaranteed real skill_ids and
        # valid prerequisite order from the deterministic topological sort).
        plan = MockRoadmap().recommend(
            mastery_by_skill=mastery_by_skill, horizon_days=horizon_days
        )

        payload = {
            "horizon_days": horizon_days,
            "mastered_count": len(plan.skipped_mastered),
            "remaining_count": len(plan.steps),
            "first_skill": plan.steps[0].name if plan.steps else None,
            "last_skill": plan.steps[-1].name if plan.steps else None,
            "domains": sorted({s.domain for s in plan.steps}),
        }

        try:
            response = self._client.messages.parse(
                model=self._model,
                max_tokens=300,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": json.dumps(payload)}],
                output_format=_ClaudeRationale,
            )
            result = response.parsed_output
        except Exception as exc:
            req_id = getattr(exc, "request_id", None)
            logger.warning("roadmap rationale request failed (request_id=%s): %s", req_id, exc)
            raise RoadmapError(f"roadmap backend error: {exc}") from exc

        if result is None:
            raise RoadmapError("roadmap returned no structured output")

        return plan.model_copy(update={"rationale": result.rationale})
