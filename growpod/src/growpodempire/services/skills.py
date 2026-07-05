"""
Skills graph loader (Phase 6b).

A cached reader over ``data/skills.yaml`` — the data-driven SKILLS GRAPH that
sits under the curriculum. Mirrors ``game_service.load_strain_knowledge`` exactly
(module-level cache + ``yaml.safe_load`` from a path under ``data/``).

Exposes the query surface the learner model needs to remap mastery from
``course_key`` onto real ``skill_id``s:

  * ``load_skills()``          -> the full parsed graph ({skills, course_skills}).
  * ``skills_for_course(k)``   -> the skill_ids a course teaches.
  * ``course_for_skill(s)``    -> the course_keys that teach a skill (inverse).
  * ``all_skill_ids()``        -> the set of every defined skill_id.

NON-ECONOMIC: pure data; imports nothing from ``economy``/``ledger``/wallet.
"""

from __future__ import annotations

import yaml

from ..config import get_settings

_SKILLS_CACHE = None


def load_skills() -> dict:
    """Load (and cache) the skills graph — the ``skills`` and ``course_skills``
    maps from ``data/skills.yaml``."""
    global _SKILLS_CACHE
    if _SKILLS_CACHE is None:
        with open(get_settings().skills_file, "r", encoding="utf-8") as fh:
            _SKILLS_CACHE = yaml.safe_load(fh) or {}
    return _SKILLS_CACHE


def skills_for_course(course_key: str) -> list[str]:
    """The skill_ids a course teaches (empty list if the course is unknown)."""
    course_skills = load_skills().get("course_skills", {}) or {}
    return list(course_skills.get(course_key, []) or [])


def course_for_skill(skill_id: str) -> list[str]:
    """The course_keys that teach a skill (inverse of ``skills_for_course``),
    deterministically sorted."""
    course_skills = load_skills().get("course_skills", {}) or {}
    return sorted(
        ck for ck, skill_ids in course_skills.items() if skill_id in (skill_ids or [])
    )


def all_skill_ids() -> set[str]:
    """Every skill_id defined in the ``skills`` map."""
    return set((load_skills().get("skills", {}) or {}).keys())
