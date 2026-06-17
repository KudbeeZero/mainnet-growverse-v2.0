"""
Claude-backed GrowPod University professor.

Mirrors ClaudeAdvisorProvider: the official Anthropic SDK with structured outputs
returns a validated LectureReport. `anthropic` is imported lazily so the mock
path needs no dependency or key.
"""

import json
import logging

from .provider import LecturerProvider, LectureReport, AdvisorError

logger = logging.getLogger("growpodempire.lecturer")

_SYSTEM_PROMPT = (
    "You are the Professor at GrowPod University — the Master Grower teaching "
    "cannabis cultivation science in the game GROWv2. You receive a JSON context "
    "with the course name, the lecture topic and its learning objectives, the "
    "requested level (beginner/intermediate/advanced), and optionally the "
    "student's live grow state. Deliver a real-looking, academically credible but "
    "practical lecture: rooted in real horticultural science (botany, plant "
    "genetics, nutrient science, IPM, cannabinoid/terpene chemistry, post-harvest) "
    "and in the game's mechanics. Cover every learning objective, keep it concise "
    "(a few hundred to ~1200 words), and finish with concrete takeaways and one "
    "comprehension-check question. Do not fabricate citations or numbers not "
    "implied by the topic."
)

_MODEL_DEFAULT = "claude-opus-4-8"


class ClaudeLecturerProvider(LecturerProvider):
    def __init__(self, api_key: str, model: str = _MODEL_DEFAULT):
        if not api_key:
            raise AdvisorError("ANTHROPIC_API_KEY is required for the Claude lecturer")
        try:
            import anthropic  # lazy: only needed on the real path
        except ImportError as exc:  # pragma: no cover
            raise AdvisorError("the 'anthropic' package is not installed") from exc

        self._model = model
        self._client = anthropic.Anthropic(api_key=api_key)

    def name(self) -> str:
        return f"claude:{self._model}"

    def lecture(self, context: dict) -> LectureReport:
        try:
            response = self._client.messages.parse(
                model=self._model,
                max_tokens=8000,
                thinking={"type": "adaptive"},
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": json.dumps(context, default=str)}],
                output_format=LectureReport,
            )
        except Exception as exc:
            req_id = getattr(exc, "request_id", None)
            logger.warning("lecture request failed (request_id=%s): %s", req_id, exc)
            raise AdvisorError(f"lecturer backend error: {exc}") from exc

        report = response.parsed_output
        if report is None:
            raise AdvisorError("lecturer returned no structured output")
        return report
