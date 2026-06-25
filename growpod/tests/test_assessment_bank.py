"""
Content tests for the authored assessment banks (data/assessments/*.yaml).

These guard the *content*, not the grader: every authored item must be
structurally valid and must grade its own answer key as correct, every exam must
resolve its referenced item ids, and answering an exam with the keys must clear
its gate. A malformed bank fails CI here — loudly, at build time, not at play time.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.services import assessment_service as A
from growpodempire.services.university_service import load_curriculum

# Courses that ship an authored assessment bank.
BANKED_COURSES = ["bio-101"]


@pytest.mark.parametrize("course", BANKED_COURSES)
class TestBankContent:
    def test_bank_loads(self, course):
        bank = A.load_bank(course)
        assert bank, f"no assessment bank loaded for {course}"
        assert bank.get("course") == course

    def test_every_item_is_valid_and_self_consistent(self, course):
        errors = A.validate_items(A.all_items(course))
        assert errors == [], f"{course} bank has authoring errors: {errors}"

    def test_items_exist(self, course):
        assert len(A.all_items(course)) >= 1

    def test_every_item_tags_a_known_type(self, course):
        bad = [it.get("id") for it in A.all_items(course) if it.get("type") not in A.ITEM_TYPES]
        assert bad == [], f"{course} items with unknown type: {bad}"

    def test_every_item_has_explained_feedback(self, course):
        missing = [it.get("id") for it in A.all_items(course) if not (it.get("explain") or "").strip()]
        assert missing == [], f"{course} items missing 'explain' feedback: {missing}"

    def test_banked_course_exists_in_curriculum(self, course):
        assert course in load_curriculum().get("courses", {}), (
            f"{course} has an assessment bank but no curriculum.yaml course"
        )


class TestExamsResolveAndGate:
    def test_midterm_resolves_all_item_ids(self):
        spec = A.exam("bio-101", "midterm")
        assert spec, "bio-101 midterm missing"
        # No dangling ids: every referenced id resolved to a real item.
        raw = A.load_bank("bio-101")["exams"]["midterm"]["item_ids"]
        assert len(spec["items"]) == len(raw), "midterm references an unknown item id"
        assert spec["pass"] == 0.70

    def test_mastery_resolves_all_item_ids(self):
        spec = A.exam("bio-101", "mastery")
        raw = A.load_bank("bio-101")["exams"]["mastery"]["item_ids"]
        assert len(spec["items"]) == len(raw), "mastery references an unknown item id"
        assert spec["pass"] == 0.80

    def test_answer_key_passes_midterm(self):
        spec = A.exam("bio-101", "midterm")
        keys = {it["id"]: A._self_answer(it) for it in spec["items"]}
        result = A.grade_exam("bio-101", "midterm", keys)
        assert result["score"] == 1.0
        assert result["passed"] is True

    def test_answer_key_passes_mastery(self):
        spec = A.exam("bio-101", "mastery")
        keys = {it["id"]: A._self_answer(it) for it in spec["items"]}
        result = A.grade_exam("bio-101", "mastery", keys)
        assert result["score"] == 1.0
        assert result["passed"] is True

    def test_empty_responses_fail_the_gates(self):
        assert A.grade_exam("bio-101", "midterm", {})["passed"] is False
        assert A.grade_exam("bio-101", "mastery", {})["passed"] is False

    def test_unknown_exam_raises(self):
        with pytest.raises(A.AssessmentError):
            A.grade_exam("bio-101", "final-boss", {})

    def test_missing_bank_is_empty_not_error(self):
        assert A.load_bank("nonexistent-course") == {}
        assert A.all_items("nonexistent-course") == []
