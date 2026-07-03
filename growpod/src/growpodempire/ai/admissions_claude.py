"""
Claude-backed Admissions agent (Phase 6c).

Interprets intake quiz answers with Claude to produce a personalized
department recommendation and rationale. The department must exist in the
live curriculum — if Claude suggests an unrecognised key the factory falls
back to MockAdmissions, preserving the guaranteed-valid invariant. Course
track keys are always built from the live curriculum (never from Claude's
output), so they are always real. `anthropic` is imported lazily so the
mock path never needs a key or network access.
"""

from __future__ import annotations

import json
import logging

from pydantic import BaseModel

from .provider import (
    AdmissionsError,
    AdmissionsLevel,
    AdmissionsProvider,
    AdmissionsRecommendation,
)

logger = logging.getLogger("growpodempire.admissions")

_MODEL_DEFAULT = "claude-haiku-4-5-20251001"

_SYSTEM_PROMPT = (
    "You are the Admissions Counselor at GrowPod University in the cannabis "
    "cultivation game GROWv2. You receive a JSON payload with the intake quiz "
    "(questions and choices), the player's answers, and the list of valid "
    "department keys. Based on the player's answers, choose the single best "
    "department from ``available_departments`` and set the starting level "
    "(beginner/intermediate/advanced) from the experience question. Write a "
    "2-3 sentence rationale that is personal and specific — reference what "
    "the player actually said to show you understood their goals. Be "
    "encouraging. The department value MUST be one of the strings in "
    "``available_departments`` — never invent a new one."
)


class _ClaudeChoice(BaseModel):
    department: str
    level: AdmissionsLevel
    rationale: str


def _track_for(department: str) -> list:
    """Ordered real course keys for ``department`` from the live curriculum."""
    from ..services.university_service import load_curriculum

    courses = load_curriculum().get("courses", {}) or {}
    in_dept = [
        (key, spec)
        for key, spec in courses.items()
        if (spec or {}).get("department") == department
    ]
    in_dept.sort(key=lambda kv: (int((kv[1] or {}).get("level_req", 0)), kv[0]))
    return [key for key, _ in in_dept]


class ClaudeAdmissions(AdmissionsProvider):
    def __init__(self, api_key: str, model: str = _MODEL_DEFAULT):
        if not api_key:
            raise AdmissionsError("ANTHROPIC_API_KEY is required for ClaudeAdmissions")
        try:
            import anthropic  # lazy: only needed on the real path
        except ImportError as exc:  # pragma: no cover
            raise AdmissionsError("the 'anthropic' package is not installed") from exc

        self._model = model
        self._client = anthropic.Anthropic(api_key=api_key)

    def name(self) -> str:
        return f"claude:{self._model}"

    def recommend(self, answers: dict) -> AdmissionsRecommendation:
        from ..services.university_service import load_curriculum
        from .admissions_mock import INTAKE_QUIZ, MockAdmissions

        curriculum = load_curriculum()
        departments = sorted((curriculum.get("departments") or {}).keys())

        payload = {
            "quiz": INTAKE_QUIZ,
            "answers": dict(answers or {}),
            "available_departments": departments,
        }

        try:
            response = self._client.messages.parse(
                model=self._model,
                max_tokens=500,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": json.dumps(payload)}],
                output_format=_ClaudeChoice,
            )
            choice = response.parsed_output
        except Exception as exc:
            req_id = getattr(exc, "request_id", None)
            logger.warning("admissions request failed (request_id=%s): %s", req_id, exc)
            raise AdmissionsError(f"admissions backend error: {exc}") from exc

        if choice is None:
            raise AdmissionsError("admissions returned no structured output")

        # Validate department — if Claude suggested a non-existent key, fall back.
        if choice.department not in departments:
            logger.warning(
                "admissions: Claude suggested unknown department %r — falling back to mock",
                choice.department,
            )
            return MockAdmissions().recommend(answers)

        track = _track_for(choice.department)
        return AdmissionsRecommendation(
            school=choice.department,
            department=choice.department,
            track=track,
            level=choice.level,
            rationale=choice.rationale,
        )
