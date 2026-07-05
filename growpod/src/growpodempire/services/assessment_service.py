"""
Pure, deterministic assessment grading for GrowPod University.

CI-safe by construction: every supported item type carries a machine-checkable
answer key, so grading is a pure function that never needs a live AI — mirroring
the shipped practical checks (`university_service._practical_met`). See
`docs/research/university/bio-101-assessment-bank.md` for the item shapes and the
grading contract, and `docs/memory/design/07-university-phase-2.md` §5 for the
deterministic-grading standard.

Supported item types and their answer keys:
- ``mcq``       — single correct index (0-based int).            ``answer: 1``
- ``multi``     — exact set of indices (order-independent).      ``answer: [0, 2, 4]``
- ``tf``        — boolean.                                       ``answer: true``
- ``numeric``   — value within a tolerance band.                ``answer: {value: 700, tol: 100}``
- ``drag_sort`` — exact key→value pairing, or an exact ordering. ``pairs: {...}, answer: exact_pairing``
                  ``answer: [2, 0, 1]`` for an ordering.

Graders are total functions of ``(item, response)``: a missing/``None`` response
is graded incorrect (never an error); a malformed *item* raises
:class:`AssessmentError` (an authoring bug, surfaced loudly in tests/CI).
"""
from __future__ import annotations

import os

import yaml

from typing import Any, Mapping

ITEM_TYPES = ("mcq", "multi", "tf", "numeric", "drag_sort")

# Gate thresholds from the assessment-bank contract (§ "Grading contract").
MIDTERM_PASS = 0.70
MASTERY_PASS = 0.80


class AssessmentError(ValueError):
    """A malformed assessment item — an authoring bug, not a wrong answer."""


def _is_real_int(x: Any) -> bool:
    # In Python ``True`` is an int; reject bools where an index is expected.
    return isinstance(x, int) and not isinstance(x, bool)


def _is_number(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _grade_mcq(item: Mapping[str, Any], response: Any) -> bool:
    key = item.get("answer")
    if not _is_real_int(key):
        raise AssessmentError(f"mcq item {item.get('id')!r} needs an int 'answer'")
    return _is_real_int(response) and response == key


def _grade_tf(item: Mapping[str, Any], response: Any) -> bool:
    key = item.get("answer")
    if not isinstance(key, bool):
        raise AssessmentError(f"tf item {item.get('id')!r} needs a bool 'answer'")
    return isinstance(response, bool) and response == key


def _grade_multi(item: Mapping[str, Any], response: Any) -> bool:
    key = item.get("answer")
    if not isinstance(key, (list, tuple)) or not all(_is_real_int(i) for i in key):
        raise AssessmentError(f"multi item {item.get('id')!r} needs a list of int 'answer'")
    if not isinstance(response, (list, tuple, set)):
        return False
    if not all(_is_real_int(i) for i in response):
        return False
    return set(response) == set(key)


def _grade_numeric(item: Mapping[str, Any], response: Any) -> bool:
    key = item.get("answer")
    if not isinstance(key, Mapping) or not _is_number(key.get("value")):
        raise AssessmentError(
            f"numeric item {item.get('id')!r} needs answer {{value, tol}}"
        )
    tol = key.get("tol", 0)
    if not _is_number(tol) or tol < 0:
        raise AssessmentError(f"numeric item {item.get('id')!r} needs a non-negative 'tol'")
    if not _is_number(response):
        return False
    return abs(response - key["value"]) <= tol


def _grade_drag_sort(item: Mapping[str, Any], response: Any) -> bool:
    pairs = item.get("pairs")
    key = item.get("answer")
    # Pairing variant: the canonical answer IS the `pairs` mapping.
    if pairs is not None and (key is None or key in ("exact_pairing", "exact")):
        if not isinstance(pairs, Mapping):
            raise AssessmentError(f"drag_sort item {item.get('id')!r} needs a 'pairs' mapping")
        if not isinstance(response, Mapping):
            return False
        return dict(response) == dict(pairs)
    # Ordering variant: the answer is an explicit ordered list.
    if isinstance(key, (list, tuple)):
        if not isinstance(response, (list, tuple)):
            return False
        return list(response) == list(key)
    raise AssessmentError(
        f"drag_sort item {item.get('id')!r} needs 'pairs' (+ exact_pairing) or an ordered 'answer' list"
    )


_GRADERS = {
    "mcq": _grade_mcq,
    "tf": _grade_tf,
    "multi": _grade_multi,
    "numeric": _grade_numeric,
    "drag_sort": _grade_drag_sort,
}


def grade_item(item: Mapping[str, Any], response: Any) -> dict:
    """Grade a single item against a student ``response``.

    Returns a result dict with ``correct`` plus the authored feedback so the UI
    can show the explanation on submit. A ``None`` response grades incorrect.
    """
    itype = item.get("type")
    if itype not in _GRADERS:
        raise AssessmentError(f"item {item.get('id')!r} has unknown type {itype!r}")
    correct = bool(_GRADERS[itype](item, response)) if response is not None else False
    return {
        "id": item.get("id"),
        "type": itype,
        "correct": correct,
        "objective": item.get("objective"),
        "explain": item.get("explain"),
    }


def grade_assessment(
    items, responses: Mapping[str, Any], *, pass_threshold: float = MIDTERM_PASS
) -> dict:
    """Grade a full assessment (a list of items) against ``responses`` keyed by item id.

    Pure and deterministic: identical inputs always yield identical output. Score
    is the fraction correct (0..1); ``passed`` compares it to ``pass_threshold``.
    """
    items = list(items)
    total = len(items)
    responses = responses or {}
    per_item = []
    correct_count = 0
    for item in items:
        result = grade_item(item, responses.get(item.get("id")))
        correct_count += 1 if result["correct"] else 0
        per_item.append(result)
    score = (correct_count / total) if total else 0.0
    return {
        "total": total,
        "correct_count": correct_count,
        "score": score,
        "percent": round(score * 100, 1),
        "passed": total > 0 and score >= pass_threshold,
        "pass_threshold": pass_threshold,
        "items": per_item,
    }


def validate_items(items) -> list:
    """Return a list of authoring errors for ``items`` (empty list = all valid).

    Grades each item with its own authored key and asserts it scores correct;
    a key that doesn't grade itself correct is an authoring bug. Used by content
    tests so a malformed bank fails CI loudly rather than at play time.
    """
    errors = []
    seen_ids = set()
    for item in items:
        iid = item.get("id")
        if iid in seen_ids:
            errors.append(f"duplicate item id {iid!r}")
        seen_ids.add(iid)
        try:
            key = _self_answer(item)
            if not grade_item(item, key)["correct"]:
                errors.append(f"item {iid!r} does not grade its own answer key as correct")
        except AssessmentError as exc:
            errors.append(str(exc))
    return errors


def _self_answer(item: Mapping[str, Any]) -> Any:
    """The canonical correct response for an item (its own answer key)."""
    itype = item.get("type")
    if itype == "drag_sort":
        pairs = item.get("pairs")
        if pairs is not None and item.get("answer") in (None, "exact_pairing", "exact"):
            return dict(pairs)
        return item.get("answer")
    if itype == "numeric":
        ans = item.get("answer")
        return ans.get("value") if isinstance(ans, Mapping) else ans
    return item.get("answer")


# ---------------------------------------------------------------------------
# Data-driven banks — load authored assessment YAML (data/assessments/<course>.yaml).
# Cached per course; mirrors university_service.load_curriculum.
# ---------------------------------------------------------------------------
_BANK_CACHE: dict = {}


def load_bank(course_key: str) -> dict:
    """Load (and cache) the authored assessment bank for a course.

    Returns ``{}`` when no bank file exists (courses without assessments yet).
    """
    if course_key not in _BANK_CACHE:
        from ..config import get_settings

        path = os.path.join(get_settings().assessments_dir, f"{course_key}.yaml")
        if not os.path.exists(path):
            _BANK_CACHE[course_key] = {}
        else:
            with open(path, "r", encoding="utf-8") as fh:
                _BANK_CACHE[course_key] = yaml.safe_load(fh) or {}
    return _BANK_CACHE[course_key]


def all_items(course_key: str) -> list:
    """Every authored item across all modules, in module then authored order."""
    bank = load_bank(course_key)
    items: list = []
    for module in (bank.get("modules") or {}).values():
        items.extend(module.get("items") or [])
    return items


def exam(course_key: str, exam_id: str) -> dict:
    """Resolve a named exam into ``{title, pass, items: [...]}``.

    Exams reference module item ids (``item_ids``) so item content lives once.
    Inline ``items`` are also supported. Returns ``{}`` if the exam is absent.
    """
    spec = (load_bank(course_key).get("exams") or {}).get(exam_id)
    if not spec:
        return {}
    if spec.get("items"):
        items = list(spec["items"])
    else:
        by_id = {it.get("id"): it for it in all_items(course_key)}
        items = [by_id[i] for i in (spec.get("item_ids") or []) if i in by_id]
    return {
        "title": spec.get("title", exam_id),
        "pass": float(spec.get("pass", MIDTERM_PASS)),
        "items": items,
    }


def grade_exam(course_key: str, exam_id: str, responses: Mapping[str, Any]) -> dict:
    """Grade a named exam for a course against ``responses`` keyed by item id."""
    spec = exam(course_key, exam_id)
    if not spec:
        raise AssessmentError(f"no exam {exam_id!r} for course {course_key!r}")
    return grade_assessment(spec["items"], responses, pass_threshold=spec["pass"])


# ---------------------------------------------------------------------------
# Client-safe projection — the ONLY shape an item may take toward the browser.
# Answer keys, correct pairings, and explanations are stripped so a student
# cannot read the answers off the wire; grading always happens server-side.
# ---------------------------------------------------------------------------
_CLIENT_SAFE_OMIT = ("answer", "pairs", "explain")


def public_item(item: Mapping[str, Any]) -> dict:
    """Project an authored item to its client-safe view (no answer/pairs/explain)."""
    safe = {
        "id": item.get("id"),
        "type": item.get("type"),
        "stem": item.get("stem"),
        "objective": item.get("objective"),
    }
    itype = item.get("type")
    if itype in ("mcq", "multi"):
        safe["choices"] = list(item.get("choices") or [])
    elif itype == "drag_sort" and isinstance(item.get("pairs"), Mapping):
        # Expose the left-hand prompts and the pool of options, NOT the pairing.
        safe["prompt_keys"] = list(item["pairs"].keys())
        safe["options"] = sorted(item["pairs"].values())
    return safe


def public_exam(course_key: str, exam_id: str) -> dict:
    """A named exam projected for the client: metadata + answer-stripped items."""
    spec = exam(course_key, exam_id)
    if not spec:
        return {}
    return {
        "id": exam_id,
        "title": spec["title"],
        "pass": spec["pass"],
        "items": [public_item(it) for it in spec["items"]],
    }
