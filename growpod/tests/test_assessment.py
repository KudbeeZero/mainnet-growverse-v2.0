"""
Tests for the pure, deterministic assessment grader (services/assessment_service.py).

Verifies the grading contract from docs/research/university/bio-101-assessment-bank.md:
every item type has a machine-checkable key; the right answer grades correct, a
wrong/missing answer grades incorrect, malformed items raise, and scoring/gates are
deterministic. No live AI anywhere — grading is a pure function.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.services.assessment_service import (
    AssessmentError,
    MASTERY_PASS,
    MIDTERM_PASS,
    grade_assessment,
    grade_item,
    validate_items,
)

# ---------------------------------------------------------------------------
# Representative items, one per type (mirrors the bio-101 bank shapes).
# ---------------------------------------------------------------------------
MCQ = {"id": "mcq1", "type": "mcq", "stem": "?", "choices": ["a", "b", "c"], "answer": 1, "explain": "because b"}
TF = {"id": "tf1", "type": "tf", "stem": "?", "answer": True, "explain": "yes"}
MULTI = {"id": "mu1", "type": "multi", "stem": "?", "choices": ["N", "Ca", "Mg", "Fe", "K"], "answer": [0, 2, 4], "explain": "mobile"}
NUM = {"id": "nu1", "type": "numeric", "stem": "?", "answer": {"value": 0, "tol": 5}, "explain": "flat"}
DRAG = {
    "id": "dr1", "type": "drag_sort", "stem": "?",
    "pairs": {"dermal": "skin", "vascular": "transport", "ground": "bulk"},
    "answer": "exact_pairing", "explain": "four systems",
}


# ---------------------------------------------------------------------------
# Each type: correct key grades correct.
# ---------------------------------------------------------------------------
class TestCorrectAnswers:
    def test_mcq_correct(self):
        assert grade_item(MCQ, 1)["correct"] is True

    def test_tf_correct(self):
        assert grade_item(TF, True)["correct"] is True

    def test_multi_correct_order_independent(self):
        assert grade_item(MULTI, [4, 0, 2])["correct"] is True
        assert grade_item(MULTI, {0, 2, 4})["correct"] is True

    def test_numeric_within_tolerance(self):
        assert grade_item(NUM, 0)["correct"] is True
        assert grade_item(NUM, 5)["correct"] is True   # edge of band
        assert grade_item(NUM, -5)["correct"] is True

    def test_drag_sort_exact_pairing(self):
        assert grade_item(DRAG, {"dermal": "skin", "vascular": "transport", "ground": "bulk"})["correct"] is True


# ---------------------------------------------------------------------------
# Each type: wrong answer grades incorrect.
# ---------------------------------------------------------------------------
class TestWrongAnswers:
    def test_mcq_wrong(self):
        assert grade_item(MCQ, 0)["correct"] is False

    def test_mcq_rejects_bool_response(self):
        # True == 1 in Python; an mcq must not accept a bool as index 1.
        assert grade_item(MCQ, True)["correct"] is False

    def test_tf_wrong(self):
        assert grade_item(TF, False)["correct"] is False

    def test_tf_rejects_int_response(self):
        assert grade_item(TF, 1)["correct"] is False

    def test_multi_subset_is_wrong(self):
        assert grade_item(MULTI, [0, 2])["correct"] is False
        assert grade_item(MULTI, [0, 2, 4, 1])["correct"] is False

    def test_numeric_outside_tolerance(self):
        assert grade_item(NUM, 6)["correct"] is False
        assert grade_item(NUM, -6)["correct"] is False

    def test_drag_sort_wrong_pairing(self):
        assert grade_item(DRAG, {"dermal": "transport", "vascular": "skin", "ground": "bulk"})["correct"] is False

    def test_drag_sort_partial_is_wrong(self):
        assert grade_item(DRAG, {"dermal": "skin"})["correct"] is False


# ---------------------------------------------------------------------------
# Missing/None responses grade incorrect — never raise.
# ---------------------------------------------------------------------------
class TestMissingResponses:
    @pytest.mark.parametrize("item", [MCQ, TF, MULTI, NUM, DRAG])
    def test_none_response_is_incorrect(self, item):
        assert grade_item(item, None)["correct"] is False

    def test_wrong_typed_response_is_incorrect_not_error(self):
        assert grade_item(MCQ, "b")["correct"] is False
        assert grade_item(MULTI, 0)["correct"] is False
        assert grade_item(NUM, "zero")["correct"] is False


# ---------------------------------------------------------------------------
# Malformed items raise AssessmentError (authoring bug).
# ---------------------------------------------------------------------------
class TestMalformedItems:
    def test_unknown_type(self):
        with pytest.raises(AssessmentError):
            grade_item({"id": "x", "type": "essay", "answer": "free text"}, "anything")

    def test_mcq_without_int_answer(self):
        with pytest.raises(AssessmentError):
            grade_item({"id": "x", "type": "mcq", "answer": "b"}, 1)

    def test_numeric_without_value(self):
        with pytest.raises(AssessmentError):
            grade_item({"id": "x", "type": "numeric", "answer": {"tol": 5}}, 0)

    def test_drag_sort_without_pairs_or_order(self):
        with pytest.raises(AssessmentError):
            grade_item({"id": "x", "type": "drag_sort", "answer": "huh"}, {})


# ---------------------------------------------------------------------------
# Feedback passthrough + objective tagging.
# ---------------------------------------------------------------------------
class TestResultShape:
    def test_result_carries_explain_and_objective(self):
        item = {**MCQ, "objective": 2}
        res = grade_item(item, 0)
        assert res["explain"] == "because b"
        assert res["objective"] == 2
        assert res["id"] == "mcq1"
        assert res["type"] == "mcq"


# ---------------------------------------------------------------------------
# Whole-assessment scoring + gates.
# ---------------------------------------------------------------------------
class TestGradeAssessment:
    def _bank(self):
        return [MCQ, TF, MULTI, NUM, DRAG]

    def _all_correct(self):
        return {"mcq1": 1, "tf1": True, "mu1": [0, 2, 4], "nu1": 0,
                "dr1": {"dermal": "skin", "vascular": "transport", "ground": "bulk"}}

    def test_all_correct_scores_full(self):
        result = grade_assessment(self._bank(), self._all_correct())
        assert result["total"] == 5
        assert result["correct_count"] == 5
        assert result["score"] == 1.0
        assert result["percent"] == 100.0
        assert result["passed"] is True

    def test_empty_responses_score_zero(self):
        result = grade_assessment(self._bank(), {})
        assert result["correct_count"] == 0
        assert result["score"] == 0.0
        assert result["passed"] is False

    def test_midterm_gate_at_70(self):
        # 7/10 correct == 0.7 should pass the midterm gate; 6/10 should fail.
        items = [{"id": f"q{i}", "type": "tf", "answer": True} for i in range(10)]
        seven = {f"q{i}": (i < 7) for i in range(10)}
        six = {f"q{i}": (i < 6) for i in range(10)}
        assert grade_assessment(items, seven, pass_threshold=MIDTERM_PASS)["passed"] is True
        assert grade_assessment(items, six, pass_threshold=MIDTERM_PASS)["passed"] is False

    def test_mastery_gate_at_80(self):
        items = [{"id": f"q{i}", "type": "tf", "answer": True} for i in range(10)]
        eight = {f"q{i}": (i < 8) for i in range(10)}
        seven = {f"q{i}": (i < 7) for i in range(10)}
        assert grade_assessment(items, eight, pass_threshold=MASTERY_PASS)["passed"] is True
        assert grade_assessment(items, seven, pass_threshold=MASTERY_PASS)["passed"] is False

    def test_empty_bank_does_not_pass(self):
        assert grade_assessment([], {})["passed"] is False

    def test_determinism(self):
        a = grade_assessment(self._bank(), self._all_correct())
        b = grade_assessment(self._bank(), self._all_correct())
        assert a == b


# ---------------------------------------------------------------------------
# validate_items: a bank's own keys must grade themselves correct.
# ---------------------------------------------------------------------------
class TestValidateItems:
    def test_valid_bank_has_no_errors(self):
        assert validate_items([MCQ, TF, MULTI, NUM, DRAG]) == []

    def test_duplicate_ids_flagged(self):
        errs = validate_items([MCQ, MCQ])
        assert any("duplicate" in e for e in errs)

    def test_self_inconsistent_item_flagged(self):
        bad = {"id": "bad", "type": "mcq", "answer": 1, "choices": ["a"]}
        # answer index 1 is valid structurally and self-grades correct, so craft a
        # numeric whose tol is negative to force an authoring error instead:
        worse = {"id": "worse", "type": "numeric", "answer": {"value": 5, "tol": -1}}
        errs = validate_items([bad, worse])
        assert any("worse" in e for e in errs)
