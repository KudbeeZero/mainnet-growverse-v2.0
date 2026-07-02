"""
UniversityService — GrowPod University: classes, time-gated study, and degrees.

A player ENROLLS in a course (pays tuition, a GROW sink), lets the course's
`duration_hours` of study time elapse, and COMPLETES it by meeting a practical
tied to real gameplay (e.g. harvest a quality-X plant, breed N strains). Courses
build toward DEGREES; earning a degree is a permanent unlock that grants perks
(the same effect keys as the research tree), a permanent title, and XP.

Curriculum is data (`data/curriculum.yaml`). Degree perks are aggregated by
`degree_effects()` exactly like `research_effects()`, so all existing apply-sites
(harvest yield/quality, terpene, care/breeding/seed discounts) pick them up once
the service-layer effect helpers sum research + degree effects.
"""

from typing import Dict, List, Optional

import yaml
from sqlalchemy.orm import Session

from ..config import get_settings
from ..economy.config import get_economy_config, EconomyConfig
from ..economy.ledger import post, to_money
from ..enums import LedgerEntryType
from ..db.models import (
    Player, CourseEnrollment, DegreeProgress, Harvest, BreedingEvent, CupEntry,
    ResearchProgress, AssessmentAttempt,
)
from . import assessment_service
from ..simulation.clock import Clock, SystemClock
from . import leveling_service
from . import engagement_rules
from .engagement_service import UniversityEngagementService
from .knowledge_service import KnowledgeService
from .learner_model_service import LearnerModelService
from .research_service import _EFFECT_KEYS
from .game_service import GameService, GameError

_CURRICULUM_CACHE = None


def load_curriculum() -> dict:
    """Load (and cache) the curriculum (departments/courses/degrees)."""
    global _CURRICULUM_CACHE
    if _CURRICULUM_CACHE is None:
        with open(get_settings().curriculum_file, "r", encoding="utf-8") as fh:
            _CURRICULUM_CACHE = yaml.safe_load(fh) or {}
    return _CURRICULUM_CACHE


def _earned_degree_keys(session: Session, player_id: str) -> set:
    rows = (
        session.query(DegreeProgress)
        .filter(DegreeProgress.player_id == player_id)
        .all()
    )
    return {r.degree_key for r in rows}


def degree_effects(
    session: Session, player_id: str, cfg: Optional[EconomyConfig] = None
) -> Dict[str, float]:
    """Aggregate the perks of every degree a player has earned (additive),
    mirroring research_effects() and using the same effect keys."""
    degrees = load_curriculum().get("degrees", {})
    effects: Dict[str, float] = {k: 0.0 for k in _EFFECT_KEYS}
    for key in _earned_degree_keys(session, player_id):
        degree = degrees.get(key)
        if not degree:
            continue
        for ek, ev in (degree.get("perks") or {}).items():
            if ek in effects:
                effects[ek] += float(ev)
    return effects


def _completed_course_keys(session: Session, player_id: str) -> set:
    rows = (
        session.query(CourseEnrollment)
        .filter(
            CourseEnrollment.player_id == player_id,
            CourseEnrollment.status == "completed",
        )
        .all()
    )
    return {r.course_key for r in rows}


def course_effects(
    session: Session, player_id: str, cfg: Optional[EconomyConfig] = None
) -> Dict[str, float]:
    """Aggregate the perks of every *course* a player has completed (additive).

    Course perks are distinct from degree perks — they fire on individual course
    completion, not when an entire degree is claimed.  Both are summed in
    GameService._research() so every existing apply-site (harvest, care cost,
    breeding) picks them up automatically.
    """
    courses = load_curriculum().get("courses", {})
    effects: Dict[str, float] = {k: 0.0 for k in _EFFECT_KEYS}
    for key in _completed_course_keys(session, player_id):
        course = courses.get(key)
        if not course:
            continue
        for ek, ev in (course.get("perks") or {}).items():
            if ek in effects:
                effects[ek] += float(ev)
    return effects


class UniversityService:
    def __init__(
        self,
        session: Session,
        config: Optional[EconomyConfig] = None,
        clock: Optional[Clock] = None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        self.clock = clock or SystemClock()
        self._univ = self.cfg.raw.get("university", {})
        self.curriculum = load_curriculum()
        # NON-ECONOMIC engagement loop (KXP / streaks). Shares this service's
        # session + clock; never posts to the ledger.
        self.engagement = UniversityEngagementService(self.session, clock=self.clock)

    # ----- helpers --------------------------------------------------------
    @property
    def _enabled(self) -> bool:
        return bool(self._univ.get("enabled", True))

    @property
    def courses(self) -> dict:
        return self.curriculum.get("courses", {})

    @property
    def degrees(self) -> dict:
        return self.curriculum.get("degrees", {})

    def _player(self, player_id: str) -> Player:
        GameService(self.session).get_player(player_id)
        return self.session.get(Player, player_id)

    def _enrollments(self, player_id: str) -> Dict[str, CourseEnrollment]:
        rows = (
            self.session.query(CourseEnrollment)
            .filter(CourseEnrollment.player_id == player_id)
            .all()
        )
        return {r.course_key: r for r in rows}

    def _completed_courses(self, enrollments: Dict[str, CourseEnrollment]) -> set:
        return {k for k, e in enrollments.items() if e.status == "completed"}

    # ----- enrollment + study ---------------------------------------------
    def enroll(self, player_id: str, course_key: str) -> CourseEnrollment:
        if not self._enabled:
            raise GameError("GrowPod University is closed")
        player = self._player(player_id)
        course = self.courses.get(course_key)
        if course is None:
            raise GameError(f"Unknown course '{course_key}'")

        enrollments = self._enrollments(player_id)
        existing = enrollments.get(course_key)
        if existing is not None:
            raise GameError(
                "Already completed this course" if existing.status == "completed"
                else "Already enrolled in this course"
            )

        completed = self._completed_courses(enrollments)
        missing = [c for c in (course.get("prereqs") or []) if c not in completed]
        if missing:
            names = ", ".join(self.courses.get(c, {}).get("name", c) for c in missing)
            raise GameError(f"Requires first: {names}")

        level_req = int(course.get("level_req", 1))
        if (player.level or 1) < level_req:
            raise GameError(f"Requires level {level_req}")

        tuition = to_money(course.get("tuition", 0))
        if tuition > 0:
            post(
                self.session, player_id, -tuition, LedgerEntryType.TUITION,
                ref_type="course", ref_id=course_key,
            )
        enrollment = CourseEnrollment(
            player_id=player_id, course_key=course_key,
            status="enrolled", started_at=self.clock.now(),
        )
        self.session.add(enrollment)
        self.session.flush()
        return enrollment

    def complete_course(self, player_id: str, course_key: str) -> dict:
        self._player(player_id)
        course = self.courses.get(course_key)
        if course is None:
            raise GameError(f"Unknown course '{course_key}'")
        enrollment = self._enrollments(player_id).get(course_key)
        if enrollment is None:
            raise GameError("You are not enrolled in this course")
        if enrollment.status == "completed":
            raise GameError("Course already completed")

        now = self.clock.now()
        elapsed_h = (now - enrollment.started_at).total_seconds() / 3600.0
        need_h = float(course.get("duration_hours", 0))
        if elapsed_h < need_h:
            raise GameError(
                f"Study in progress — {int(need_h - elapsed_h)}h of coursework remain"
            )

        met, detail = self._practical_met(player_id, course.get("practical") or {})
        if not met:
            raise GameError(f"Practical not met: {detail}")

        required_exam = course.get("requires_exam")
        if required_exam and not self._exam_passed(player_id, course_key, required_exam):
            raise GameError(f"Pass the {required_exam} exam to complete this course")

        enrollment.status = "completed"
        enrollment.completed_at = now
        xp = int(self._univ.get("course_xp", 50))
        if xp:
            leveling_service.award_xp(self.session, player_id, xp, self.cfg)
        # NON-ECONOMIC: accrue Knowledge-XP + advance the study streak. Additive
        # to the return shape — existing keys are untouched.
        eng = self.engagement.record_study_event(
            player_id, engagement_rules.KXP_COURSE_COMPLETE
        )
        # Phase 6a: refresh the centralized LEARNER MODEL (mastery + risk) and
        # audit the completion. All writes go through LearnerModelService.apply,
        # which appends a matching LearnerEvent. NON-ECONOMIC; additive — the
        # return shape below is unchanged.
        learner = LearnerModelService(self.session, clock=self.clock)
        learner.apply(
            player_id,
            agent="system",
            kind="course_completed",
            detail={"course_key": course_key},
            reason=f"completed course {course_key}",
        )
        learner.recompute_mastery(player_id, reason="course completion")
        learner.recompute_risk(player_id, reason="course completion")
        self.session.flush()
        return {
            "course_key": course_key,
            "name": course.get("name", course_key),
            "status": "completed",
            "xp_awarded": xp,
            "kxp_awarded": eng["awarded_kxp"],
            "streak_count": eng["streak_count"],
        }

    # ----- assessments / exams -------------------------------------------
    def submit_exam(
        self, player_id: str, course_key: str, exam_id: str, responses: dict
    ) -> dict:
        """Grade an exam server-side (pure) and persist the player's BEST attempt.

        Returns ``{result, attempt}`` — the per-item scored result plus the
        accumulated attempt state (attempts/best_score/passed). The full
        item-level ``result`` is ALSO saved as the attempt row's
        ``last_result`` (exam replay — see ``_record_attempt``), and this
        grading is captured as an "exam_result" ``knowledge_events`` row
        (design/11 P1) via the single-writer ``KnowledgeService.append``.
        """
        self._player(player_id)
        if self.courses.get(course_key) is None:
            raise GameError(f"Unknown course '{course_key}'")
        try:
            result = assessment_service.grade_exam(course_key, exam_id, responses)
        except assessment_service.AssessmentError as exc:
            raise GameError(str(exc))
        attempt = self._record_attempt(player_id, course_key, exam_id, result)
        KnowledgeService(self.session, clock=self.clock).append(
            "exam_result",
            {
                "course_key": course_key,
                "exam_id": exam_id,
                "score": result["score"],
                "passed": result["passed"],
            },
            player_id=player_id,
        )
        return {"result": result, "attempt": attempt}

    def _attempt_row(self, player_id, course_key, exam_id):
        return (
            self.session.query(AssessmentAttempt)
            .filter_by(player_id=player_id, course_key=course_key, exam_id=exam_id)
            .one_or_none()
        )

    def _record_attempt(self, player_id, course_key, exam_id, result) -> dict:
        row = self._attempt_row(player_id, course_key, exam_id)
        if row is None:
            row = AssessmentAttempt(
                player_id=player_id, course_key=course_key, exam_id=exam_id,
                attempts=0, best_score=0.0, passed=False,
            )
            self.session.add(row)
        was_passed = bool(row.passed)
        row.attempts += 1
        row.best_score = max(row.best_score, float(result["score"]))
        row.passed = row.passed or bool(result["passed"])  # forgiving: never un-pass
        # Replay (2026-07-02): ALWAYS overwritten by the latest submit — unlike
        # best_score/passed, this is not "best ever" but "most recent", so a
        # player reviewing their last attempt sees what they just did, even if
        # it scored worse than an earlier pass.
        row.last_result = dict(result)
        row.last_attempt_at = self.clock.now()
        self.session.flush()
        out = {
            "attempts": row.attempts,
            "best_score": row.best_score,
            "passed": row.passed,
        }
        # NON-ECONOMIC: award exam-pass KXP exactly ONCE, on the transition from
        # not-passed -> passed. Additive key only.
        if row.passed and not was_passed:
            eng = self.engagement.record_study_event(
                player_id, engagement_rules.KXP_EXAM_PASS
            )
            out["kxp_awarded"] = eng["awarded_kxp"]
            out["streak_count"] = eng["streak_count"]
            # Phase 6a: first pass refreshes the centralized LEARNER MODEL.
            # Through apply(), so the exam_pass + mastery/risk changes are audited.
            learner = LearnerModelService(self.session, clock=self.clock)
            learner.apply(
                player_id,
                agent="system",
                kind="exam_passed",
                detail={"course_key": course_key, "exam_id": exam_id},
                reason=f"first pass of {course_key}:{exam_id}",
            )
            learner.recompute_mastery(player_id, reason="exam passed")
            learner.recompute_risk(player_id, reason="exam passed")
        return out

    def _exam_passed(self, player_id, course_key, exam_id) -> bool:
        row = self._attempt_row(player_id, course_key, exam_id)
        return bool(row and row.passed)

    def last_exam_result(
        self, player_id: str, course_key: str, exam_id: str
    ) -> Optional[dict]:
        """The player's most recently graded, item-level result for
        ``(course_key, exam_id)`` — lets a "review my last attempt" replay flow
        show exactly what they answered without re-grading or exposing answer
        keys (the stored shape is already the answer-stripped
        ``assessment_service.grade_exam`` result). Returns ``None`` if the
        player has never attempted this exam."""
        row = self._attempt_row(player_id, course_key, exam_id)
        if row is None or row.last_result is None:
            return None
        return dict(row.last_result)

    def _exams_for(self, player_id, course_key) -> list:
        """Per-exam state for a course (empty if the course has no bank)."""
        bank = assessment_service.load_bank(course_key)
        exams = bank.get("exams") or {}
        out = []
        for exam_id, spec in exams.items():
            row = self._attempt_row(player_id, course_key, exam_id)
            out.append({
                "exam_id": exam_id,
                "title": spec.get("title", exam_id),
                "pass": float(spec.get("pass", assessment_service.MIDTERM_PASS)),
                "attempts": row.attempts if row else 0,
                "best_score": row.best_score if row else 0.0,
                "passed": bool(row and row.passed),
            })
        return out

    # ----- degrees --------------------------------------------------------
    def claim_degree(self, player_id: str, degree_key: str) -> dict:
        player = self._player(player_id)
        degree = self.degrees.get(degree_key)
        if degree is None:
            raise GameError(f"Unknown degree '{degree_key}'")
        if degree_key in _earned_degree_keys(self.session, player_id):
            raise GameError("Degree already earned")

        completed = self._completed_courses(self._enrollments(player_id))
        missing = [c for c in (degree.get("required_courses") or []) if c not in completed]
        if missing:
            names = ", ".join(self.courses.get(c, {}).get("name", c) for c in missing)
            raise GameError(f"Finish these courses first: {names}")

        self.session.add(DegreeProgress(player_id=player_id, degree_key=degree_key))
        title = degree.get("title")
        if title:
            player.university_title = title
        xp = int(degree.get("xp_reward", 0))
        if xp:
            leveling_service.award_xp(self.session, player_id, xp, self.cfg)
        self.session.flush()
        return {
            "degree_key": degree_key,
            "name": degree.get("name", degree_key),
            "title": title,
            "xp_awarded": xp,
            "perks": degree.get("perks", {}),
        }

    def degree_effects(self, player_id: str) -> Dict[str, float]:
        return degree_effects(self.session, player_id, self.cfg)

    # ----- read-only transcript / catalog ---------------------------------
    def transcript(self, player_id: str) -> dict:
        player = self._player(player_id)
        enrollments = self._enrollments(player_id)
        completed = self._completed_courses(enrollments)
        level = player.level or 1
        now = self.clock.now()

        course_rows: List[dict] = []
        for key, c in self.courses.items():
            e = enrollments.get(key)
            status = e.status if e else "available"
            prereqs = c.get("prereqs") or []
            prereqs_met = all(p in completed for p in prereqs)
            ready = None
            if e and e.status == "enrolled":
                elapsed_h = (now - e.started_at).total_seconds() / 3600.0
                remaining = max(0.0, float(c.get("duration_hours", 0)) - elapsed_h)
                met, detail = self._practical_met(player_id, c.get("practical") or {})
                ready = {"study_hours_remaining": round(remaining, 1),
                         "practical_met": met, "practical": detail}
            if status == "available" and (not prereqs_met or level < int(c.get("level_req", 1))):
                status = "locked"
            course_rows.append({
                "key": key, "name": c.get("name", key), "department": c.get("department"),
                "credits": c.get("credits"), "level_req": int(c.get("level_req", 1)),
                "duration_hours": c.get("duration_hours"), "tuition": float(c.get("tuition", 0)),
                "prereqs": prereqs, "lecture_topic": (c.get("lecture") or {}).get("topic"),
                "practical": c.get("practical"), "perks": c.get("perks", {}),
                "status": status, "progress": ready,
                "requires_exam": c.get("requires_exam"),
                "exams": self._exams_for(player_id, key),
            })

        earned = _earned_degree_keys(self.session, player_id)
        degree_rows: List[dict] = []
        for key, d in self.degrees.items():
            required = d.get("required_courses") or []
            done = [c for c in required if c in completed]
            degree_rows.append({
                "key": key, "name": d.get("name", key), "tier": d.get("tier"),
                "title": d.get("title"), "required_courses": required,
                "completed_required": done, "perks": d.get("perks", {}),
                "xp_reward": d.get("xp_reward", 0),
                "earned": key in earned,
                "claimable": key not in earned and len(done) == len(required) and required != [],
            })

        raw_depts = self.curriculum.get("departments", {})
        flat_depts = {k: (v.get("name", k) if isinstance(v, dict) else str(v)) for k, v in raw_depts.items()}
        return {
            "player_id": player_id,
            "title": player.university_title,
            "departments": flat_depts,
            "courses": course_rows,
            "degrees": degree_rows,
        }

    def catalog(self) -> dict:
        """Public, player-agnostic course/degree catalog."""
        raw_depts = self.curriculum.get("departments", {})
        flat_depts = {k: (v.get("name", k) if isinstance(v, dict) else str(v)) for k, v in raw_depts.items()}
        return {
            "departments": flat_depts,
            "courses": [
                {"key": k, "name": c.get("name", k), "department": c.get("department"),
                 "credits": c.get("credits"), "level_req": int(c.get("level_req", 1)),
                 "duration_hours": c.get("duration_hours"), "tuition": float(c.get("tuition", 0)),
                 "prereqs": c.get("prereqs") or [], "perks": c.get("perks", {}),
                 "lecture_topic": (c.get("lecture") or {}).get("topic")}
                for k, c in self.courses.items()
            ],
            "degrees": [
                {"key": k, "name": d.get("name", k), "tier": d.get("tier"),
                 "title": d.get("title"), "required_courses": d.get("required_courses") or [],
                 "perks": d.get("perks", {}), "xp_reward": d.get("xp_reward", 0)}
                for k, d in self.degrees.items()
            ],
        }

    # ----- practical checks (real game state) -----------------------------
    def _practical_met(self, player_id: str, practical: dict) -> tuple:
        ptype = practical.get("type")
        threshold = float(practical.get("threshold", 1))
        s = self.session

        if ptype is None:
            return True, "none"
        if ptype == "harvest_count":
            n = s.query(Harvest).filter(Harvest.player_id == player_id).count()
            return n >= threshold, f"harvest {int(threshold)} plants ({n} so far)"
        if ptype == "harvest_quality":
            best = (
                s.query(Harvest.quality).filter(Harvest.player_id == player_id)
                .order_by(Harvest.quality.desc()).first()
            )
            top = float(best[0]) if best else 0.0
            return top >= threshold, f"harvest quality >= {int(threshold)} (best {int(top)})"
        if ptype == "breed":
            n = s.query(BreedingEvent).filter(BreedingEvent.player_id == player_id).count()
            return n >= threshold, f"breed {int(threshold)} strains ({n} so far)"
        if ptype == "stabilize":
            n = (
                s.query(BreedingEvent)
                .filter(BreedingEvent.player_id == player_id,
                        BreedingEvent.parent_a_id == BreedingEvent.parent_b_id)
                .count()
            )
            return n >= threshold, f"stabilize {int(threshold)} line(s) ({n} so far)"
        if ptype == "cure":
            n = (
                s.query(Harvest)
                .filter(Harvest.player_id == player_id, Harvest.cure_status == "cured")
                .count()
            )
            return n >= threshold, f"cure {int(threshold)} harvest(s) ({n} so far)"
        if ptype == "cup_entry":
            n = s.query(CupEntry).filter(CupEntry.player_id == player_id).count()
            return n >= threshold, f"enter the Cannabis Cup ({n} entries)"
        if ptype == "research":
            n = s.query(ResearchProgress).filter(ResearchProgress.player_id == player_id).count()
            return n >= threshold, f"unlock {int(threshold)} research node(s) ({n} so far)"
        if ptype == "level":
            player = self.session.get(Player, player_id)
            lvl = player.level or 1
            return lvl >= threshold, f"reach level {int(threshold)} (level {lvl})"
        return True, "none"
