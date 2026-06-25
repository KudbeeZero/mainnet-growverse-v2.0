"""
Deterministic, offline Roadmap agent — the CI/no-key default (Phase 6d).

A PURE, READ-ONLY path-builder. Given a learner's ``mastery_by_skill`` and the
skills-graph prerequisites (read via ``services.skills``, never re-parsed here), it
emits a ``RoadmapPlan`` that:

  * SKIPS already-mastered skills — a skill is mastered when its best_score is
    ``>= MASTERY_THRESHOLD`` — and lists them (sorted) in ``skipped_mastered``.
  * ENFORCES prerequisites via a deterministic topological sort: a skill becomes
    ELIGIBLE only once every one of its prerequisites is either already mastered OR
    already placed earlier in the path. Among the currently-eligible skills it picks
    in a STABLE order (sorted by ``(domain, skill_id)``), so identical inputs always
    yield a byte-identical path. The skills graph is a DAG, but a guard still bails
    out rather than looping forever if a prereq can never be satisfied.
  * SPREADS the ordered skills roughly evenly across ``horizon_days`` and sets each
    step's 1-based ``day``.

Same ``mastery_by_skill`` + horizon in -> same plan out, with no network and no
randomness, so the whole roadmap path runs free in CI. NON-ECONOMIC: imports
nothing from ``economy``/``ledger``/wallet; never reads ``balance.yaml``.
"""

from __future__ import annotations

import math
from typing import Dict, List

from .provider import RoadmapPlan, RoadmapProvider, RoadmapStep

# A skill counts as mastered once its best_score reaches this threshold. 0.7 lines
# up with the "proficient" rung of the skills' mastery_scale and the passing bar
# used elsewhere — high enough to mean real competence, low enough that a solid
# course completion clears it.
MASTERY_THRESHOLD = 0.7


def _skills_graph() -> dict:
    """The ``skill_id -> record`` map, via the skills-graph loader (no re-parse)."""
    from ..services.skills import load_skills

    return load_skills().get("skills", {}) or {}


def _prerequisites(skill_id: str, skills: dict) -> List[str]:
    """A skill's prerequisite skill_ids (empty list if unknown / none)."""
    return list((skills.get(skill_id) or {}).get("prerequisites", []) or [])


class MockRoadmap(RoadmapProvider):
    def name(self) -> str:
        return "mock"

    def recommend(
        self, *, mastery_by_skill: dict, horizon_days: int = 7
    ) -> RoadmapPlan:
        mastery = dict(mastery_by_skill or {})
        skills = _skills_graph()

        mastered = {
            sid
            for sid in skills
            if float(mastery.get(sid, 0) or 0) >= MASTERY_THRESHOLD
        }
        ordered = self._topo_order(skills, mastered)
        steps = self._schedule(ordered, skills, horizon_days)
        rationale = self._rationale(steps, mastered, horizon_days)
        return RoadmapPlan(
            horizon_days=horizon_days,
            steps=steps,
            skipped_mastered=sorted(mastered),
            rationale=rationale,
        )

    # ------------------------------------------------------------- ordering
    @staticmethod
    def _topo_order(skills: dict, mastered: set) -> List[str]:
        """Deterministic topological order over the UNMASTERED skills.

        A skill is eligible once every prerequisite is satisfied — already mastered
        or already placed. Among eligible skills, the stable ``(domain, skill_id)``
        key is the tiebreak, so the same inputs always yield the same order. The
        graph is a DAG; the guard only fires if it ever isn't.
        """
        pending = sorted(sid for sid in skills if sid not in mastered)
        satisfied = set(mastered)
        placed: List[str] = []

        while pending:
            eligible = [
                sid
                for sid in pending
                if all(
                    pre in satisfied
                    for pre in _prerequisites(sid, skills)
                )
            ]
            if not eligible:
                # No cycle expected (DAG); bail out deterministically rather than
                # looping forever. Append whatever remains in stable order.
                placed.extend(pending)
                break
            eligible.sort(
                key=lambda sid: (
                    str((skills.get(sid) or {}).get("domain", "")),
                    sid,
                )
            )
            nxt = eligible[0]
            placed.append(nxt)
            satisfied.add(nxt)
            pending.remove(nxt)
        return placed

    # ------------------------------------------------------------- schedule
    @staticmethod
    def _schedule(
        ordered: List[str], skills: dict, horizon_days: int
    ) -> List[RoadmapStep]:
        """Spread the ordered skills roughly evenly across ``horizon_days``.

        ``day`` is 1-based and non-decreasing in path order, so a step's day is
        never earlier than any of its prerequisites' days.
        """
        horizon = max(1, int(horizon_days))
        n = len(ordered)
        per_day = max(1, math.ceil(n / horizon)) if n else 1
        steps: List[RoadmapStep] = []
        for idx, sid in enumerate(ordered):
            rec = skills.get(sid) or {}
            day = min(horizon, idx // per_day + 1)
            steps.append(
                RoadmapStep(
                    skill_id=sid,
                    name=str(rec.get("name", sid)),
                    domain=str(rec.get("domain", "")),
                    day=day,
                    prerequisites=_prerequisites(sid, skills),
                )
            )
        return steps

    # ------------------------------------------------------------ rationale
    @staticmethod
    def _rationale(
        steps: List[RoadmapStep], mastered: set, horizon_days: int
    ) -> str:
        if not steps:
            return (
                "You've already mastered every tracked skill — nothing left to "
                "schedule. Keep practicing to stay sharp."
            )
        first = steps[0].name
        skipped = (
            f" Skipped {len(mastered)} already-mastered skill(s)."
            if mastered
            else ""
        )
        return (
            f"A {horizon_days}-day path through {len(steps)} skill(s) in "
            f"prerequisite order, starting with {first}.{skipped}"
        )
