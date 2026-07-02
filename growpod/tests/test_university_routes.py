"""HTTP-boundary coverage for the GrowPod University routes in game_api.py.

These drive the Flask routes directly — request parsing, auth, feature gating,
status codes, and error mapping — for the university subsystem
(catalog / transcript / enroll / complete / claim degree / lecture), which was
previously exercised only at the service layer (`test_university.py`).

The economy-relevant path here is enrollment: tuition is a GROW *sink* posted to
the ledger, so the debit and insufficient-funds paths are guarded. Completion is
time-gated (the HTTP route uses a real SystemClock), so to drive a successful
completion over HTTP we backdate the enrollment's `started_at` directly in the DB
(read-only of source; only test fixtures are touched). The AI Professor's lecture
falls back to the deterministic offline MockLecturerProvider in tests (no key),
so we assert on that mock's structured output.
"""

import os
import sys
from datetime import timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import Player, CourseEnrollment, DegreeProgress
from growpodempire.economy.ledger import post, balance
from growpodempire.enums import LedgerEntryType
from growpodempire.services import leveling_service


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app
    return create_app(init_database=False).test_client()


# ----- helpers ---------------------------------------------------------------

def _new_player(client, username="student"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _hdr(key):
    return {"X-API-Key": key}


def _grant(player_id, grow=0, level=None):
    """Top up GROW and/or push a player up to `level` via direct ORM access on the
    seeded test DB (the same hooks test_university.py uses at the service layer)."""
    with session_scope() as s:
        if grow:
            from decimal import Decimal
            post(s, player_id, Decimal(str(grow)), LedgerEntryType.ADJUSTMENT)
        if level is not None:
            need = 100 * level * (level - 1) // 2  # curve_base * L*(L-1)/2
            if need:
                leveling_service.award_xp(s, player_id, need)


def _backdate_enrollment(player_id, course_key, hours=200):
    """Move an enrollment's start back in time so the SystemClock-driven HTTP
    complete route sees the study period as elapsed."""
    with session_scope() as s:
        e = (
            s.query(CourseEnrollment)
            .filter(
                CourseEnrollment.player_id == player_id,
                CourseEnrollment.course_key == course_key,
            )
            .one()
        )
        e.started_at = e.started_at - timedelta(hours=hours)


def _harvest_blue_dream(client, pid, key):
    """Run one full grow→harvest over HTTP so the harvest_count practical (used by
    cult-101 / nut-101 / ipm-101) is satisfied. Yield/quality are computed
    server-side, so we only drive the count."""
    hdr = _hdr(key)
    strains = client.get("/api/game/strains").get_json()
    sid = next(s for s in strains if s["slug"] == "blue-dream")["id"]
    stack = client.post(
        f"/api/game/players/{pid}/seeds/buy", json={"strain_id": sid}, headers=hdr
    ).get_json()
    pod = client.post(
        f"/api/game/players/{pid}/pods", json={"name": "Tent", "capacity": 2}, headers=hdr
    ).get_json()
    plant = client.post(
        f"/api/game/players/{pid}/plant",
        json={"seed_id": stack["id"], "pod_id": pod["id"]},
        headers=hdr,
    ).get_json()
    return client.post(
        f"/api/game/players/{pid}/plants/{plant['id']}/harvest",
        json={"sell": False},
        headers=hdr,
    ).get_json()


# ----- catalog (public) ------------------------------------------------------

def test_catalog_is_public_and_lists_courses_and_degrees(client):
    r = client.get("/api/game/university/catalog")
    assert r.status_code == 200
    body = r.get_json()
    course_keys = {c["key"] for c in body["courses"]}
    degree_keys = {d["key"] for d in body["degrees"]}
    assert "cult-101" in course_keys
    assert "cert-cultivation" in degree_keys
    assert "ms-master-grower" in degree_keys
    # No auth header was sent and the call still succeeded.


def test_catalog_404s_when_feature_disabled(client, monkeypatch):
    monkeypatch.setenv("FEATURE_UNIVERSITY", "false")
    assert client.get("/api/game/university/catalog").status_code == 404


# ----- presenter video (Phase 2) ---------------------------------------------

def test_presenter_video_is_public_and_mock_falls_back_to_audio(client):
    r = client.get("/api/game/university/courses/cult-101/presenter-video")
    assert r.status_code == 200  # public read, no auth header
    body = r.get_json()
    assert body["provider"] == "mock"
    assert body["backend"] == "mock"
    assert body["video_url"] is None  # mock → player uses narration audio
    assert body["avatar_id"]
    assert body["audio_hash"]
    assert body["captions"] and body["captions"][0]["start_s"] == 0.0


def test_presenter_video_404s_for_unknown_course(client):
    assert client.get(
        "/api/game/university/courses/not-a-course/presenter-video"
    ).status_code == 404


def test_presenter_video_404s_when_feature_disabled(client, monkeypatch):
    monkeypatch.setenv("FEATURE_UNIVERSITY", "false")
    assert client.get(
        "/api/game/university/courses/cult-101/presenter-video"
    ).status_code == 404


# ----- master grower bot (Phase 4) -------------------------------------------

def _ask_mg(client, pid, key, question, plant_id=None):
    body = {"question": question}
    if plant_id:
        body["plant_id"] = plant_id
    return client.post(
        f"/api/game/players/{pid}/master-grower/ask", json=body, headers=_hdr(key)
    )


def test_master_grower_requires_auth(client):
    pid, _ = _new_player(client, "mg_noauth")
    r = client.post(
        f"/api/game/players/{pid}/master-grower/ask",
        json={"question": "Tell me about Blue Dream"},
    )
    assert r.status_code in (401, 403)


def test_master_grower_404s_when_feature_disabled(client, monkeypatch):
    pid, key = _new_player(client, "mg_off")
    monkeypatch.setenv("FEATURE_UNIVERSITY", "false")
    assert _ask_mg(client, pid, key, "hello").status_code == 404


def test_master_grower_requires_a_question(client):
    pid, key = _new_player(client, "mg_empty")
    assert _ask_mg(client, pid, key, "   ").status_code == 400


def test_master_grower_answers_strain_grounded(client):
    pid, key = _new_player(client, "mg_strain")
    r = _ask_mg(client, pid, key, "Tell me about Blue Dream")
    assert r.status_code == 200
    body = r.get_json()
    assert body["refused"] is False
    assert body["citations"], "a substantive answer must be grounded"
    assert any("strain_knowledge" in c["source"] for c in body["citations"])


def test_master_grower_refuses_pay_to_win(client):
    pid, key = _new_player(client, "mg_p2w")
    r = _ask_mg(client, pid, key, "what should I buy to win fastest?")
    assert r.status_code == 200
    body = r.get_json()
    assert body["refused"] is True
    assert not body["citations"]


# ----- transcript (authed) ---------------------------------------------------

def test_transcript_requires_auth(client):
    pid, _ = _new_player(client, "noauth_transcript")
    r = client.get(f"/api/game/players/{pid}/university")
    assert r.status_code in (401, 403)


def test_transcript_reports_status_and_locks(client):
    pid, key = _new_player(client, "transcriber")
    r = client.get(f"/api/game/players/{pid}/university", headers=_hdr(key))
    assert r.status_code == 200
    body = r.get_json()
    by_key = {c["key"]: c for c in body["courses"]}
    assert by_key["cult-101"]["status"] == "available"
    # cult-201 needs level 3 + the cult-101 prereq -> locked for a fresh player.
    assert by_key["cult-201"]["status"] == "locked"
    assert body["title"] is None
    assert any(d["key"] == "cert-cultivation" for d in body["degrees"])


def test_transcript_reflects_enrollment(client):
    pid, key = _new_player(client, "enrolled_transcript")
    _grant(pid, grow=500)
    client.post(f"/api/game/players/{pid}/courses/cult-101/enroll", headers=_hdr(key))
    body = client.get(f"/api/game/players/{pid}/university", headers=_hdr(key)).get_json()
    by_key = {c["key"]: c for c in body["courses"]}
    assert by_key["cult-101"]["status"] == "enrolled"
    assert by_key["cult-101"]["progress"] is not None


# ----- enroll (tuition sink) -------------------------------------------------

def test_enroll_charges_tuition(client):
    pid, key = _new_player(client, "enrollee")
    _grant(pid, grow=500)
    with session_scope() as s:
        before = balance(s, pid)
    r = client.post(f"/api/game/players/{pid}/courses/cult-101/enroll", headers=_hdr(key))
    assert r.status_code == 201
    body = r.get_json()
    assert body["course_key"] == "cult-101"
    assert body["status"] == "enrolled"
    with session_scope() as s:
        assert balance(s, pid) == before - 150  # cult-101 tuition


def test_enroll_requires_auth(client):
    pid, _ = _new_player(client, "noauth_enroll")
    r = client.post(f"/api/game/players/{pid}/courses/cult-101/enroll")
    assert r.status_code in (401, 403)


def test_enroll_unknown_course_is_rejected(client):
    pid, key = _new_player(client, "ghostcourse")
    r = client.post(f"/api/game/players/{pid}/courses/nope-999/enroll", headers=_hdr(key))
    assert r.status_code == 400
    assert "Unknown course" in r.get_json()["error"]


def test_enroll_insufficient_funds(client):
    pid, key = _new_player(client, "broke_student")
    # Drain the 500 GROW signup grant so tuition (150) can't be paid.
    with session_scope() as s:
        from decimal import Decimal
        post(s, pid, -balance(s, pid), LedgerEntryType.ADJUSTMENT)
        assert balance(s, pid) == Decimal("0")
    r = client.post(f"/api/game/players/{pid}/courses/cult-101/enroll", headers=_hdr(key))
    assert r.status_code == 400


def test_enroll_double_enroll_is_rejected(client):
    pid, key = _new_player(client, "doubler")
    _grant(pid, grow=500)
    assert client.post(
        f"/api/game/players/{pid}/courses/cult-101/enroll", headers=_hdr(key)
    ).status_code == 201
    again = client.post(
        f"/api/game/players/{pid}/courses/cult-101/enroll", headers=_hdr(key)
    )
    assert again.status_code == 400
    assert "Already enrolled" in again.get_json()["error"]


def test_enroll_gated_by_level(client):
    pid, key = _new_player(client, "lowlevel")
    _grant(pid, grow=1000)  # funded, but still level 1
    # gen-101 needs level 2.
    r = client.post(f"/api/game/players/{pid}/courses/gen-101/enroll", headers=_hdr(key))
    assert r.status_code == 400
    assert "level" in r.get_json()["error"].lower()


# ----- complete (time + practical gated) -------------------------------------

def test_complete_too_early_is_rejected(client):
    pid, key = _new_player(client, "tooearly")
    _grant(pid, grow=500)
    client.post(f"/api/game/players/{pid}/courses/cult-101/enroll", headers=_hdr(key))
    # Study time has not elapsed (real SystemClock, just enrolled).
    r = client.post(f"/api/game/players/{pid}/courses/cult-101/complete", headers=_hdr(key))
    assert r.status_code == 400
    assert "Study" in r.get_json()["error"]


def test_complete_practical_not_met_is_rejected(client):
    pid, key = _new_player(client, "nopractical")
    _grant(pid, grow=500)
    client.post(f"/api/game/players/{pid}/courses/cult-101/enroll", headers=_hdr(key))
    _backdate_enrollment(pid, "cult-101", hours=200)  # study time now elapsed
    # cult-101 practical is harvest_count >= 1 and the player has harvested nothing.
    r = client.post(f"/api/game/players/{pid}/courses/cult-101/complete", headers=_hdr(key))
    assert r.status_code == 400
    assert "Practical not met" in r.get_json()["error"]


def test_complete_happy_path_awards_xp(client):
    pid, key = _new_player(client, "graduate")
    _grant(pid, grow=500)
    client.post(f"/api/game/players/{pid}/courses/cult-101/enroll", headers=_hdr(key))
    _backdate_enrollment(pid, "cult-101", hours=200)
    _harvest_blue_dream(client, pid, key)  # satisfies harvest_count >= 1
    r = client.post(f"/api/game/players/{pid}/courses/cult-101/complete", headers=_hdr(key))
    assert r.status_code == 201
    body = r.get_json()
    assert body["status"] == "completed"
    assert body["xp_awarded"] == 50


def test_complete_not_enrolled_is_rejected(client):
    pid, key = _new_player(client, "notenrolled")
    r = client.post(f"/api/game/players/{pid}/courses/nut-101/complete", headers=_hdr(key))
    assert r.status_code == 400
    assert "not enrolled" in r.get_json()["error"].lower()


def test_complete_requires_auth(client):
    pid, _ = _new_player(client, "noauth_complete")
    assert client.post(
        f"/api/game/players/{pid}/courses/cult-101/complete"
    ).status_code in (401, 403)


# ----- claim degree ----------------------------------------------------------

def _complete_course_via_http(client, pid, key, course_key):
    client.post(f"/api/game/players/{pid}/courses/{course_key}/enroll", headers=_hdr(key))
    _backdate_enrollment(pid, course_key, hours=300)
    r = client.post(f"/api/game/players/{pid}/courses/{course_key}/complete", headers=_hdr(key))
    assert r.status_code == 201, r.get_json()


def test_claim_degree_happy_path(client):
    pid, key = _new_player(client, "certseeker")
    _grant(pid, grow=2000, level=2)  # nut-101 / ipm-101 need level 2
    # cert-cultivation requires cult-101, nut-101, ipm-101.
    # cult-101 practical: harvest_count>=1; nut-101 & ipm-101: harvest_count>=2.
    _harvest_blue_dream(client, pid, key)
    _harvest_blue_dream(client, pid, key)
    for course in ("cult-101", "nut-101", "ipm-101"):
        _complete_course_via_http(client, pid, key, course)

    r = client.post(
        f"/api/game/players/{pid}/degrees/cert-cultivation/claim", headers=_hdr(key)
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["title"] == "Certified Grower"
    assert body["xp_awarded"] == 200
    with session_scope() as s:
        assert s.get(Player, pid).university_title == "Certified Grower"


def test_claim_degree_missing_courses_is_rejected(client):
    pid, key = _new_player(client, "premature_grad")
    r = client.post(
        f"/api/game/players/{pid}/degrees/cert-cultivation/claim", headers=_hdr(key)
    )
    assert r.status_code == 400
    assert "Finish these courses first" in r.get_json()["error"]


def test_claim_unknown_degree_is_rejected(client):
    pid, key = _new_player(client, "ghostdegree")
    r = client.post(
        f"/api/game/players/{pid}/degrees/nope-degree/claim", headers=_hdr(key)
    )
    assert r.status_code == 400
    assert "Unknown degree" in r.get_json()["error"]


def test_claim_degree_double_claim_is_rejected(client):
    pid, key = _new_player(client, "doubleclaim")
    # Grant the degree directly, then assert a claim is rejected as already earned.
    with session_scope() as s:
        s.add(DegreeProgress(player_id=pid, degree_key="cert-cultivation"))
    r = client.post(
        f"/api/game/players/{pid}/degrees/cert-cultivation/claim", headers=_hdr(key)
    )
    assert r.status_code == 400
    assert "already earned" in r.get_json()["error"].lower()


def test_claim_degree_requires_auth(client):
    pid, _ = _new_player(client, "noauth_claim")
    assert client.post(
        f"/api/game/players/{pid}/degrees/cert-cultivation/claim"
    ).status_code in (401, 403)


# ----- lecture (mock AI Professor) -------------------------------------------

def test_lecture_returns_mock_professor_output(client):
    pid, key = _new_player(client, "listener")
    r = client.get(f"/api/game/players/{pid}/courses/cult-101/lecture", headers=_hdr(key))
    assert r.status_code == 200
    body = r.get_json()
    # Deterministic offline lecturer is selected with no key configured.
    assert body["provider"] == "mock"
    assert "Fundamentals of Cannabis Cultivation" in body["title"]
    assert body["summary"].startswith("A beginner-level lecture")
    assert isinstance(body["key_takeaways"], list) and body["key_takeaways"]
    assert body["quiz_question"]


def test_lecture_level_query_param_is_ignored_by_produce_once(client):
    """PRODUCE-ONCE (2026-07-02): `level` is accepted for API back-compat but no
    longer varies the delivered lecture — HERMES's "one canonical lesson per
    course" rule (the same rule that removed the web difficulty picker). A
    request with `?level=advanced` gets the SAME saved lecture a beginner
    request would (generated once, always with the canonical "beginner"
    context), not a distinct per-level regeneration."""
    pid, key = _new_player(client, "advanced_listener")
    r = client.get(
        f"/api/game/players/{pid}/courses/cult-101/lecture?level=advanced",
        headers=_hdr(key),
    )
    assert r.status_code == 200
    assert r.get_json()["summary"].startswith("A beginner-level lecture")


def test_lecture_unknown_course_404s(client):
    pid, key = _new_player(client, "ghostlecture")
    r = client.get(
        f"/api/game/players/{pid}/courses/nope-999/lecture", headers=_hdr(key)
    )
    assert r.status_code == 404
    assert "Unknown course" in r.get_json()["error"]


def test_lecture_requires_auth(client):
    pid, _ = _new_player(client, "noauth_lecture")
    assert client.get(
        f"/api/game/players/{pid}/courses/cult-101/lecture"
    ).status_code in (401, 403)
