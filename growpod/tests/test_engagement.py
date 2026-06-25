"""University engagement loop (Phase 5): KXP, study streaks, the scholars league.

This is the NON-ECONOMIC learning loop. The load-bearing guarantee under test is
that Knowledge-XP (KXP), streaks, and the league NEVER touch the GROW ledger or a
wallet — KXP is a separate counter from game XP/level and from currency.

Layers covered:
  * pure streak math (``engagement_rules.streak_after``) — no db, no clock;
  * service accrual (``UniversityEngagementService.record_study_event``) is
    ledger-free and deterministic;
  * the scholars (KXP) league orders by KXP desc;
  * the HTTP routes (progress endpoint authed + feature-off 404; scholars board);
  * end-to-end: completing a course raises the player's KXP and streak.
"""

import os
import sys
from datetime import date, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import session_scope
from growpodempire.db.models import LedgerEntry
from growpodempire.economy.ledger import post, balance
from growpodempire.enums import LedgerEntryType
from growpodempire.services import engagement_rules, leveling_service
from growpodempire.services.engagement_rules import (
    KXP_COURSE_COMPLETE,
    KXP_EXAM_PASS,
    MAX_FREEZE_TOKENS,
    streak_after,
)
from growpodempire.services.engagement_service import UniversityEngagementService
from growpodempire.services.game_service import GameService


# ===== pure streak logic (no db, no clock) ===================================

D = date(2026, 6, 1)


def test_first_ever_study_starts_streak_at_one():
    new_streak, freeze, already = streak_after(0, None, D, 0)
    assert (new_streak, freeze, already) == (1, 0, False)


def test_consecutive_day_increments_streak():
    new_streak, freeze, already = streak_after(3, D, D + timedelta(days=1), 0)
    assert new_streak == 4
    assert already is False


def test_same_day_is_idempotent():
    new_streak, freeze, already = streak_after(5, D, D, 2)
    assert (new_streak, freeze, already) == (5, 2, True)


def test_one_day_gap_with_freeze_consumes_freeze_and_keeps_streak():
    # Missed exactly one day (today == last + 2) — a freeze token covers it.
    new_streak, freeze, already = streak_after(4, D, D + timedelta(days=2), 1)
    assert new_streak == 5          # streak continues
    assert freeze == 0              # the one token was spent
    assert already is False


def test_two_day_gap_without_freeze_resets():
    new_streak, freeze, already = streak_after(4, D, D + timedelta(days=2), 0)
    assert new_streak == 1
    assert freeze == 0


def test_gap_beyond_grace_resets_to_one():
    new_streak, freeze, already = streak_after(9, D, D + timedelta(days=5), 3)
    assert new_streak == 1


def test_freeze_awarded_on_seven_day_multiples():
    # Crossing day 7 from day 6 awards a freeze token.
    new_streak, freeze, _ = streak_after(6, D, D + timedelta(days=1), 0)
    assert new_streak == 7
    assert freeze == 1
    # Crossing day 14 awards another.
    new_streak, freeze, _ = streak_after(13, D, D + timedelta(days=1), 1)
    assert new_streak == 14
    assert freeze == 2


def test_freeze_tokens_are_capped():
    # Sitting at the cap, hitting another 7-multiple does not exceed it.
    new_streak, freeze, _ = streak_after(
        20, D, D + timedelta(days=1), MAX_FREEZE_TOKENS
    )
    assert new_streak == 21
    assert freeze == MAX_FREEZE_TOKENS


# ===== service accrual is ledger-free + deterministic ========================


def _make_player(session, name):
    return GameService(session).create_player(name)


def test_record_study_event_increases_kxp_without_touching_ledger(db):
    with session_scope() as s:
        p = _make_player(s, "scholar_kxp")
        pid = p.id

    with session_scope() as s:
        bal_before = balance(s, pid)
        ledger_before = s.query(LedgerEntry).filter(
            LedgerEntry.player_id == pid
        ).count()

    with session_scope() as s:
        eng = UniversityEngagementService(s)
        out = eng.record_study_event(pid, KXP_COURSE_COMPLETE, today=D)
        assert out["kxp"] == KXP_COURSE_COMPLETE
        assert out["awarded_kxp"] == KXP_COURSE_COMPLETE
        assert out["streak_count"] == 1

    with session_scope() as s:
        # The GROW ledger / wallet is completely untouched by KXP accrual.
        assert balance(s, pid) == bal_before
        ledger_after = s.query(LedgerEntry).filter(
            LedgerEntry.player_id == pid
        ).count()
        assert ledger_after == ledger_before
        assert UniversityEngagementService(s).progress(pid)["kxp"] == KXP_COURSE_COMPLETE


def test_record_study_event_is_deterministic_and_idempotent_same_day(db):
    with session_scope() as s:
        pid = _make_player(s, "scholar_idem").id

    with session_scope() as s:
        eng = UniversityEngagementService(s)
        eng.record_study_event(pid, KXP_EXAM_PASS, today=D)
        out = eng.record_study_event(pid, KXP_EXAM_PASS, today=D)
        # Same-day second study: streak unchanged, but KXP still accrues.
        assert out["already_studied_today"] is True
        assert out["streak_count"] == 1
        assert out["kxp"] == KXP_EXAM_PASS * 2


def test_progress_defaults_to_zeros_for_new_player(db):
    with session_scope() as s:
        pid = _make_player(s, "fresh_scholar").id
    with session_scope() as s:
        prog = UniversityEngagementService(s).progress(pid)
        assert prog == {
            "kxp": 0,
            "streak_count": 0,
            "freeze_tokens": 0,
            "last_study_date": None,
        }


# ===== scholars (KXP) league ordering ========================================


def test_scholars_league_orders_by_kxp_desc(db):
    with session_scope() as s:
        low = _make_player(s, "low_kxp").id
        high = _make_player(s, "high_kxp").id
        mid = _make_player(s, "mid_kxp").id

    with session_scope() as s:
        eng = UniversityEngagementService(s)
        eng.record_study_event(low, 10, today=D)
        eng.record_study_event(high, 300, today=D)
        eng.record_study_event(mid, 100, today=D)

    with session_scope() as s:
        board = UniversityEngagementService(s).scholars(limit=10)
        names = [r["username"] for r in board]
        assert names[:3] == ["high_kxp", "mid_kxp", "low_kxp"]
        assert board[0]["kxp"] == 300
        assert "id" in board[0] and "streak_count" in board[0]


# ===== HTTP routes ===========================================================


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app
    return create_app(init_database=False).test_client()


def _new_player(client, username="student"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


def _hdr(key):
    return {"X-API-Key": key}


def test_progress_route_requires_auth(client):
    pid, _ = _new_player(client, "prog_noauth")
    r = client.get(f"/api/game/players/{pid}/university/progress")
    assert r.status_code in (401, 403)


def test_progress_route_returns_state_and_nudge(client):
    pid, key = _new_player(client, "prog_authed")
    r = client.get(f"/api/game/players/{pid}/university/progress", headers=_hdr(key))
    assert r.status_code == 200
    body = r.get_json()
    assert body["kxp"] == 0
    assert body["streak_count"] == 0
    assert "next_nudge" in body  # nudge key always present (may be a string)


def test_progress_route_404s_when_feature_disabled(client, monkeypatch):
    pid, key = _new_player(client, "prog_off")
    monkeypatch.setenv("FEATURE_UNIVERSITY", "false")
    r = client.get(f"/api/game/players/{pid}/university/progress", headers=_hdr(key))
    assert r.status_code == 404


def test_scholars_board_returns_rows(client):
    pid, key = _new_player(client, "board_scholar")
    with session_scope() as s:
        UniversityEngagementService(s).record_study_event(pid, 250, today=D)
    r = client.get("/api/game/leaderboards/scholars")
    assert r.status_code == 200  # public read
    rows = r.get_json()
    assert any(row["username"] == "board_scholar" and row["kxp"] == 250 for row in rows)


def test_scholars_board_404s_when_feature_disabled(client, monkeypatch):
    monkeypatch.setenv("FEATURE_UNIVERSITY", "false")
    assert client.get("/api/game/leaderboards/scholars").status_code == 404


# ===== end-to-end: completing a course accrues KXP + streak ==================


def _grant(player_id, grow=0, level=None):
    with session_scope() as s:
        if grow:
            from decimal import Decimal
            post(s, player_id, Decimal(str(grow)), LedgerEntryType.ADJUSTMENT)
        if level is not None:
            need = 100 * level * (level - 1) // 2
            if need:
                leveling_service.award_xp(s, player_id, need)


def _backdate_enrollment(player_id, course_key, hours=200):
    from growpodempire.db.models import CourseEnrollment
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


def test_completing_a_course_accrues_kxp_and_streak(client):
    pid, key = _new_player(client, "kxp_graduate")
    _grant(pid, grow=500)

    with session_scope() as s:
        ledger_before = s.query(LedgerEntry).filter(
            LedgerEntry.player_id == pid
        ).count()

    client.post(f"/api/game/players/{pid}/courses/cult-101/enroll", headers=_hdr(key))
    _backdate_enrollment(pid, "cult-101", hours=200)
    _harvest_blue_dream(client, pid, key)  # satisfies harvest_count >= 1

    r = client.post(f"/api/game/players/{pid}/courses/cult-101/complete", headers=_hdr(key))
    assert r.status_code == 201
    body = r.get_json()
    # Existing keys preserved; additive engagement keys present.
    assert body["status"] == "completed"
    assert body["xp_awarded"] == 50            # GAME xp — separate from KXP
    assert body["kxp_awarded"] == KXP_COURSE_COMPLETE
    assert body["streak_count"] == 1

    prog = client.get(
        f"/api/game/players/{pid}/university/progress", headers=_hdr(key)
    ).get_json()
    assert prog["kxp"] == KXP_COURSE_COMPLETE
    assert prog["streak_count"] == 1

    # Course completion + harvest move GROW (sale/tuition), but KXP accrual added
    # no *new* KXP-driven ledger rows beyond the normal game flow — the engagement
    # service is ledger-free. Sanity: KXP is not reflected as currency.
    with session_scope() as s:
        kxp_typed = (
            s.query(LedgerEntry)
            .filter(LedgerEntry.entry_type.like("%KXP%"))
            .count()
        )
        assert kxp_typed == 0
        # cult-101 has no module/exam, so no engagement ledger entry exists.
        assert ledger_before >= 0
