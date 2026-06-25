"""
Deterministic, offline Admissions agent — the CI/no-key default.

Runs a small fixed intake quiz (``INTAKE_QUIZ``) and scores the answers into an
``AdmissionsRecommendation``: the department whose weighted score is highest wins
(ties broken by sorted department key for byte-stability), the starting ``level``
is read off a dedicated experience question, and the ``track`` is built from that
department's REAL course keys (from ``curriculum.yaml``), ordered by ``level_req``
then key. Same answers in -> same recommendation out, with no network and no
randomness, so the whole admissions path runs free in CI. A real, free-form
provider (e.g. ``ClaudeAdmissions``) would be a later sub-deliverable.

The quiz definition is exposed (``INTAKE_QUIZ`` / ``quiz()``) so the web client and
tests can render and exercise the same questions the scorer understands. Unknown
or missing answers never crash — each question contributes nothing when its answer
is absent, and the experience question defaults to ``beginner``.
"""

from __future__ import annotations

from typing import Dict, List

from .provider import (
    AdmissionsLevel,
    AdmissionsProvider,
    AdmissionsRecommendation,
)

# The six departments the quiz can route to — the REAL curriculum department keys
# (mirrors the skills-graph domains: cultivation/genetics/nutrients/ipm/chemistry/
# postharvest). Used as the deterministic tiebreak ordering when scores are equal.
_DEPARTMENTS = (
    "cultivation",
    "genetics",
    "nutrients",
    "ipm",
    "chemistry",
    "postharvest",
)

# The fixed intake quiz. Each question is ``{id, prompt, choices: [{id, label,
# weights}]}``; a choice's ``weights`` maps a department key -> points it adds. The
# dedicated ``experience`` question carries ``level`` on each choice instead, which
# the scorer reads to pick the starting level. Keeping this a plain data structure
# (no behavior) lets the web/tests read it verbatim.
INTAKE_QUIZ: List[dict] = [
    {
        "id": "goal",
        "prompt": "What pulls you to growing the most?",
        "choices": [
            {"id": "big_harvests", "label": "Bigger, healthier harvests", "weights": {"cultivation": 2}},
            {"id": "new_strains", "label": "Designing and breeding new strains", "weights": {"genetics": 2}},
            {"id": "feeding", "label": "Dialing in feeding and the root zone", "weights": {"nutrients": 2}},
            {"id": "lab", "label": "The chemistry — cannabinoids and terpenes", "weights": {"chemistry": 2}},
        ],
    },
    {
        "id": "trouble",
        "prompt": "Which problem would you most like to master?",
        "choices": [
            {"id": "pests", "label": "Pests and disease wrecking a crop", "weights": {"ipm": 2}},
            {"id": "drying", "label": "Drying and curing without losing quality", "weights": {"postharvest": 2}},
            {"id": "environment", "label": "Keeping the grow environment perfectly tuned", "weights": {"cultivation": 1, "nutrients": 1}},
            {"id": "inconsistent", "label": "Plants that come out inconsistent batch to batch", "weights": {"genetics": 1, "cultivation": 1}},
        ],
    },
    {
        "id": "enjoy",
        "prompt": "Pick the task that sounds like the best afternoon.",
        "choices": [
            {"id": "scouting", "label": "Scouting leaves for early pest signs", "weights": {"ipm": 2}},
            {"id": "crossing", "label": "Making a deliberate cross and labeling seeds", "weights": {"genetics": 2}},
            {"id": "mixing", "label": "Mixing a nutrient solution to a target EC/pH", "weights": {"nutrients": 2}},
            {"id": "curing", "label": "Burping jars and tracking the cure", "weights": {"postharvest": 2}},
        ],
    },
    {
        "id": "outcome",
        "prompt": "A year from now, what win matters most?",
        "choices": [
            {"id": "yield", "label": "Reliable, heavy yields", "weights": {"cultivation": 2}},
            {"id": "potency", "label": "Lab-verified potency and terpene profile", "weights": {"chemistry": 2}},
            {"id": "shelf", "label": "Bag appeal that survives months of storage", "weights": {"postharvest": 2}},
            {"id": "stable_line", "label": "A stable line that's truly my own", "weights": {"genetics": 2}},
        ],
    },
    {
        "id": "experience",
        "prompt": "How much growing have you done before?",
        "choices": [
            {"id": "none", "label": "Brand new — never grown", "level": "beginner"},
            {"id": "some", "label": "A few grows under my belt", "level": "intermediate"},
            {"id": "lots", "label": "Experienced — many cycles, maybe commercial", "level": "advanced"},
        ],
    },
]

# Default department when nothing scores (no recognizable answers at all): the
# foundational cultivation track, which has the no-prereq starter courses.
_DEFAULT_DEPARTMENT = "cultivation"
_DEFAULT_LEVEL: AdmissionsLevel = "beginner"


def _choice(question: dict, choice_id) -> dict | None:
    """The choice dict for ``choice_id`` within ``question``, or None if absent."""
    for choice in question.get("choices", []):
        if choice.get("id") == choice_id:
            return choice
    return None


class MockAdmissions(AdmissionsProvider):
    def name(self) -> str:
        return "mock"

    def quiz(self) -> List[dict]:
        """The intake quiz definition (so the web/tests render the same questions)."""
        return INTAKE_QUIZ

    def recommend(self, answers: dict) -> AdmissionsRecommendation:
        answers = dict(answers or {})

        # ---- Score departments from the weighted (non-experience) questions ----
        scores: Dict[str, int] = {d: 0 for d in _DEPARTMENTS}
        level: AdmissionsLevel = _DEFAULT_LEVEL
        for question in INTAKE_QUIZ:
            choice = _choice(question, answers.get(question["id"]))
            if choice is None:
                continue  # unknown/missing answer contributes nothing — never crash
            if question["id"] == "experience":
                lvl = choice.get("level")
                if lvl in ("beginner", "intermediate", "advanced"):
                    level = lvl  # type: ignore[assignment]
                continue
            for dept, points in (choice.get("weights") or {}).items():
                scores[dept] = scores.get(dept, 0) + int(points)

        department = self._top_department(scores)
        track = self._track_for(department)
        rationale = self._rationale(department, level, track)
        return AdmissionsRecommendation(
            school=department,
            department=department,
            track=track,
            level=level,
            rationale=rationale,
        )

    # ------------------------------------------------------------------ scoring
    @staticmethod
    def _top_department(scores: Dict[str, int]) -> str:
        """The highest-scoring department; ties broken by sorted department key so
        identical answers always resolve to the same department, byte-stably."""
        best = max(scores.values()) if scores else 0
        if best <= 0:
            return _DEFAULT_DEPARTMENT
        return sorted(d for d, s in scores.items() if s == best)[0]

    @staticmethod
    def _track_for(department: str) -> List[str]:
        """The department's real course keys, ordered by ``level_req`` then key.

        Read from the live curriculum so the track is always real course keys; a
        department with no courses (shouldn't happen) yields an empty track.
        """
        from ..services.university_service import load_curriculum

        courses = load_curriculum().get("courses", {}) or {}
        in_dept = [
            (key, spec)
            for key, spec in courses.items()
            if (spec or {}).get("department") == department
        ]
        in_dept.sort(key=lambda kv: (int((kv[1] or {}).get("level_req", 0)), kv[0]))
        return [key for key, _ in in_dept]

    @staticmethod
    def _rationale(department: str, level: AdmissionsLevel, track: List[str]) -> str:
        from ..services.university_service import load_curriculum

        depts = load_curriculum().get("departments", {}) or {}
        name = (depts.get(department) or {}).get("name", department)
        first = track[0] if track else "your first course"
        return (
            f"Your answers point at {name}. Starting at the {level} level, "
            f"begin with {first} and work through the {len(track)}-course track."
        )
