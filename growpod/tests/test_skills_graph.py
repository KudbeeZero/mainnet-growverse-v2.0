"""Skills graph (Phase 6b): referential integrity + acyclic prerequisites.

The load-bearing guarantees under test:
  * 1:1 COVERAGE — every ``course_skills`` key is a real curriculum course, and
    every curriculum course appears in ``course_skills`` (like the strain-KB
    sync test).
  * NO DANGLING SKILL IDs — every skill_id referenced in any ``prerequisites[]``
    or in any ``course_skills`` value is defined in ``skills``.
  * ACYCLIC — the prerequisite edges form a DAG (a DFS cycle check passes), and
    the cycle check actually CATCHES a synthetic cycle.
  * ROUND-TRIP — ``skills_for_course`` / ``course_for_skill`` invert each other
    for a sample.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.services.skills import (
    all_skill_ids,
    course_for_skill,
    load_skills,
    skills_for_course,
)
from growpodempire.services.university_service import load_curriculum

CURRICULUM_DEPARTMENTS = {
    "cultivation",
    "genetics",
    "nutrients",
    "ipm",
    "chemistry",
    "postharvest",
}
CAREER_ROLES = {
    "cultivator",
    "budtender",
    "breeder",
    "extraction-tech",
    "compliance",
    "operator",
}


# ----- cycle check (DFS over the prerequisite edges) -------------------------

def _has_cycle(edges: dict) -> bool:
    """True if the directed graph ``node -> [prereqs]`` contains a cycle.

    DFS with a three-color (white/gray/black) marking: a back-edge into a node
    still on the current DFS stack (gray) is a cycle.
    """
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {node: WHITE for node in edges}

    def visit(node: str) -> bool:
        color[node] = GRAY
        for nxt in edges.get(node, []):
            c = color.get(nxt, WHITE)
            if c == GRAY:
                return True  # back-edge -> cycle
            if c == WHITE and visit(nxt):
                return True
        color[node] = BLACK
        return False

    return any(color[node] == WHITE and visit(node) for node in edges)


def _prereq_edges() -> dict:
    skills = load_skills()["skills"]
    return {sid: list(s.get("prerequisites", []) or []) for sid, s in skills.items()}


# ----- coverage / referential integrity --------------------------------------

def test_course_skills_keys_are_real_curriculum_courses():
    courses = set(load_curriculum()["courses"].keys())
    mapped = set(load_skills()["course_skills"].keys())
    unknown = mapped - courses
    assert not unknown, f"course_skills references non-curriculum courses: {unknown}"


def test_every_curriculum_course_is_covered_one_to_one():
    courses = set(load_curriculum()["courses"].keys())
    mapped = set(load_skills()["course_skills"].keys())
    missing = courses - mapped
    assert not missing, f"curriculum courses with no skills mapping: {missing}"
    # 1:1: identical sets (sync invariant, like the strain-KB test).
    assert courses == mapped


def test_no_dangling_skill_ids_in_prerequisites():
    defined = all_skill_ids()
    for sid, skill in load_skills()["skills"].items():
        for prereq in skill.get("prerequisites", []) or []:
            assert prereq in defined, f"{sid} prereq {prereq!r} is not a defined skill"


def test_no_dangling_skill_ids_in_course_skills():
    defined = all_skill_ids()
    for course_key, skill_ids in load_skills()["course_skills"].items():
        assert skill_ids, f"{course_key} maps to no skills"
        for sid in skill_ids:
            assert sid in defined, f"{course_key} -> {sid!r} is not a defined skill"


def test_skill_fields_are_well_formed():
    for sid, skill in load_skills()["skills"].items():
        assert skill.get("name"), f"{sid} missing name"
        assert skill.get("domain") in CURRICULUM_DEPARTMENTS, (
            f"{sid} domain {skill.get('domain')!r} not a curriculum department"
        )
        assert skill.get("description"), f"{sid} missing description"
        assert isinstance(skill.get("prerequisites", []), list)
        assert skill.get("mastery_scale"), f"{sid} missing mastery_scale"
        assert skill.get("assessment_methods"), f"{sid} missing assessment_methods"
        links = skill.get("career_links") or []
        assert links, f"{sid} missing career_links"
        for role in links:
            assert role in CAREER_ROLES, f"{sid} unknown career link {role!r}"


# ----- acyclic ---------------------------------------------------------------

def test_prerequisite_graph_is_acyclic():
    assert not _has_cycle(_prereq_edges()), "prerequisite graph must be a DAG"


def test_cycle_check_catches_a_real_cycle():
    # Prove the detector works: a -> b -> a is a cycle.
    cyclic = {"a": ["b"], "b": ["a"]}
    assert _has_cycle(cyclic)
    # And a self-loop.
    assert _has_cycle({"a": ["a"]})
    # A genuine DAG is not flagged.
    assert not _has_cycle({"a": ["b"], "b": ["c"], "c": []})


def test_at_least_one_prereq_edge_exists():
    # The graph is a real DAG, not a flat list: some advanced skill depends on an
    # intro skill.
    edges = _prereq_edges()
    assert any(prereqs for prereqs in edges.values())


# ----- round-trip ------------------------------------------------------------

def test_skills_for_course_and_course_for_skill_round_trip():
    # cult-101 teaches `cultivation-fundamentals`; that skill round-trips back.
    skills = skills_for_course("cult-101")
    assert "cultivation-fundamentals" in skills
    for sid in skills:
        assert "cult-101" in course_for_skill(sid)

    # Inverse direction for a sample skill.
    courses = course_for_skill("drying-curing")
    assert "ph-101" in courses
    for ck in courses:
        assert "drying-curing" in skills_for_course(ck)


def test_unknown_course_and_skill_return_empty():
    assert skills_for_course("does-not-exist") == []
    assert course_for_skill("no-such-skill") == []
