"""
Claude-backed Master Grower advisor.

Uses the official Anthropic Python SDK with structured outputs so the model
returns a validated AdvisorReport. `anthropic` is imported lazily so the package
(and the MockAdvisorProvider path) works without the dependency installed.

Model + thinking defaults follow current guidance: claude-opus-4-8 with adaptive
thinking (no temperature/budget_tokens — those 400 on this model). The system
prompt is stable (cache-friendly); the volatile per-plant JSON goes in the user
turn.
"""

import json
import logging

from .provider import AdvisorProvider, AdvisorReport, AdvisorError

logger = logging.getLogger("growpodempire.advisor")

_SYSTEM_PROMPT = (
    "You are the Master Grower, an expert in-game cannabis cultivation advisor for "
    "the game GROWv2. You receive a JSON snapshot of one plant's live simulated "
    "state: its growth stage, height, health, water/nutrient levels, pest and "
    "disease levels, condition flags, a genome summary (THC/CBD/indica ratio, "
    "resistances, terpenes), the pod environment, and recent events.\n\n"
    "Diagnose the plant and recommend concrete next actions. Ground every "
    "statement in the numbers you are given — do not invent yields, prices, or "
    "data not present. Recommend actions only from the allowed set (water, feed, "
    "treat_pests, treat_disease, adjust_environment, harvest, wait). Be concise "
    "and practical: a player should be able to act on your summary immediately. "
    "Order suggestions by urgency. The context also includes the player's "
    "unlocked research and recommended next upgrades — when the plant is stable "
    "you may briefly coach which upgrade helps most, but keep the structured "
    "suggestions limited to the allowed care actions."
)

_MODEL_DEFAULT = "claude-opus-4-8"


class ClaudeAdvisorProvider(AdvisorProvider):
    def __init__(self, api_key: str, model: str = _MODEL_DEFAULT):
        if not api_key:
            raise AdvisorError("ANTHROPIC_API_KEY is required for the Claude advisor")
        try:
            import anthropic  # lazy: only needed on the real path
        except ImportError as exc:  # pragma: no cover
            raise AdvisorError("the 'anthropic' package is not installed") from exc

        self._model = model
        self._client = anthropic.Anthropic(api_key=api_key)

    def name(self) -> str:
        return f"claude:{self._model}"

    def diagnose(self, context: dict) -> AdvisorReport:
        try:
            response = self._client.messages.parse(
                model=self._model,
                max_tokens=16000,
                thinking={"type": "adaptive"},
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": json.dumps(context, default=str)}],
                output_format=AdvisorReport,
            )
        except Exception as exc:  # surface a clean domain error to the API layer
            req_id = getattr(exc, "request_id", None)
            logger.warning("advisor request failed (request_id=%s): %s", req_id, exc)
            raise AdvisorError(f"advisor backend error: {exc}") from exc

        report = response.parsed_output
        if report is None:
            raise AdvisorError("advisor returned no structured output")
        return report
