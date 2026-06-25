"""
HTTP-boundary tests for the exam routes in game_api.py.

The load-bearing guarantee here is a SECURITY one: an exam's answer keys, correct
pairings, and feedback must never reach the client on fetch — grading happens only
server-side on submit. These tests drive the Flask routes and assert that contract,
plus correct scoring/gating and error mapping. Grading is pure (no live AI).
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.services import assessment_service as A

EXAM_GET = "/api/game/university/courses/bio-101/exams/{exam}"
EXAM_SUBMIT = "/api/game/players/{pid}/courses/bio-101/exams/{exam}/submit"


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app
    return create_app(init_database=False).test_client()


def _new_player(client, username="examinee"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _correct_responses(exam_id):
    """Build the fully-correct response map straight from the server-side keys."""
    spec = A.exam("bio-101", exam_id)
    return {it["id"]: A._self_answer(it) for it in spec["items"]}


# ---------------------------------------------------------------------------
# Fetch: client-safe projection — NO answer keys on the wire.
# ---------------------------------------------------------------------------
class TestExamFetchHidesAnswers:
    def test_fetch_returns_items(self, client):
        r = client.get(EXAM_GET.format(exam="midterm"))
        assert r.status_code == 200
        body = r.get_json()
        assert body["id"] == "midterm"
        assert body["pass"] == 0.70
        assert len(body["items"]) == 8

    def test_no_item_leaks_answer_pairs_or_explain(self, client):
        for exam_id in ("midterm", "mastery"):
            body = client.get(EXAM_GET.format(exam=exam_id)).get_json()
            for item in body["items"]:
                assert "answer" not in item, f"{item['id']} leaked an answer key"
                assert "pairs" not in item, f"{item['id']} leaked the correct pairing"
                assert "explain" not in item, f"{item['id']} leaked feedback pre-submit"

    def test_raw_payload_has_no_answer_field(self, client):
        # Belt-and-suspenders: the serialized bytes must not carry an "answer" field.
        raw = client.get(EXAM_GET.format(exam="mastery")).get_data(as_text=True)
        assert '"answer"' not in raw
        assert '"explain"' not in raw

    def test_mcq_exposes_choices_drag_exposes_options_not_pairing(self, client):
        body = client.get(EXAM_GET.format(exam="mastery")).get_json()
        by_id = {it["id"]: it for it in body["items"]}
        assert "choices" in by_id["m1-kc-1"]          # mcq keeps choices
        drag = by_id["m1-kc-2"]                         # drag_sort
        assert "prompt_keys" in drag and "options" in drag
        assert "pairs" not in drag                      # the correct mapping is hidden

    def test_unknown_exam_404(self, client):
        r = client.get(EXAM_GET.format(exam="final-boss"))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Submit: server-side grading, correct scoring + gates.
# ---------------------------------------------------------------------------
class TestExamSubmitGrades:
    def test_correct_answers_pass(self, client):
        pid, key = _new_player(client)
        r = client.post(
            EXAM_SUBMIT.format(pid=pid, exam="mastery"),
            json={"responses": _correct_responses("mastery")},
            headers={"X-API-Key": key},
        )
        assert r.status_code == 201
        body = r.get_json()
        assert body["score"] == 1.0
        assert body["passed"] is True
        # Post-submit feedback IS returned (teaching moment) — that's intended.
        assert any(it.get("explain") for it in body["items"])

    def test_empty_responses_fail_gate(self, client):
        pid, key = _new_player(client)
        r = client.post(
            EXAM_SUBMIT.format(pid=pid, exam="midterm"),
            json={"responses": {}},
            headers={"X-API-Key": key},
        )
        assert r.status_code == 201
        assert r.get_json()["passed"] is False

    def test_submit_requires_auth(self, client):
        pid, _ = _new_player(client)
        r = client.post(
            EXAM_SUBMIT.format(pid=pid, exam="midterm"),
            json={"responses": {}},
        )
        assert r.status_code in (401, 403)

    def test_submit_unknown_exam_404(self, client):
        pid, key = _new_player(client)
        r = client.post(
            EXAM_SUBMIT.format(pid=pid, exam="nope"),
            json={"responses": {}},
            headers={"X-API-Key": key},
        )
        assert r.status_code == 404

    def test_bad_responses_shape_rejected(self, client):
        pid, key = _new_player(client)
        r = client.post(
            EXAM_SUBMIT.format(pid=pid, exam="midterm"),
            data=json.dumps({"responses": [1, 2, 3]}),
            content_type="application/json",
            headers={"X-API-Key": key},
        )
        assert r.status_code == 400
