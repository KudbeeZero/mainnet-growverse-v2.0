"""
LecturerService — assembles a course context and asks the Professor (the AI
lecturer provider) for a lecture. Mirrors AdvisorService: a deterministic mock in
CI/no-key, real Claude when configured.

PRODUCE-ONCE TEXT (HERMES hard rule, design/10 — 2026-07-02 fix): the lecture
audio was already produced once per course and cached (``lecture_audio``); the
lecture TEXT was NOT — every "Attend lecture" / "Re-deliver" click called the
AI provider fresh, which both re-billed the provider on every request and gave
every player a *different* lecture with nothing saved to replay. ``teach()``
now checks the ``LectureContent`` cache (keyed on ``course_key`` ONLY) first;
on a hit it returns the saved lecture with NO provider call. On a miss it
generates exactly once, persists it, and appends a "lecture_delivered"
knowledge event (see ``KnowledgeService`` / design/11 P1).

Design choice — dropped ``plant_id`` (and ``level``) from the AI prompt
context entirely, rather than keeping per-player personalization: HERMES
already states "one canonical lesson per course" (the web difficulty picker
was removed for the same reason), and design/11 §A is explicit that
personalization must never touch "the produced-once course audio (one
canonical MP3 per course)" — treating the lecture TEXT differently from the
lecture AUDIO would be an inconsistent product (the transcript would drift
from the voice-over) and would silently reintroduce per-delivery regeneration
through the back door (a cache keyed on course+plant is really N caches, one
per plant, which is exactly the re-billing bug this fix closes). Personalizing
lectures is real future work — design/11 §A2's ``personal_context`` assembler
— but it belongs in a layer that reads the ONE saved lecture and augments the
UI around it (e.g. a "given your plant's state, focus on..." callout), not in
the cached artifact itself. ``plant_id``/``level`` stay accepted params for
backward API compatibility; they are no longer read into the provider prompt
and are ignored once a course's canonical lecture is generated.
"""

from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..economy.config import get_economy_config, EconomyConfig
from ..ai.provider import LecturerProvider, LectureReport
from ..ai.factory import shared_lecturer
from ..db.models import LectureContent
from ..simulation.clock import Clock, SystemClock
from .game_service import GameService, GameError
from .knowledge_service import KnowledgeService
from .university_service import load_curriculum


def _report_from_row(row: LectureContent) -> LectureReport:
    return LectureReport(
        title=row.title,
        summary=row.summary,
        content=row.content,
        key_takeaways=list(row.key_takeaways or []),
        quiz_question=row.quiz_question or "",
    )


class LecturerService:
    def __init__(
        self,
        session: Session,
        provider: Optional[LecturerProvider] = None,
        config: Optional[EconomyConfig] = None,
        clock: Optional[Clock] = None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        self.clock = clock or SystemClock()
        self.provider = provider or shared_lecturer()

    def _cached(self, course_key: str) -> Optional[LectureContent]:
        return (
            self.session.query(LectureContent)
            .filter(LectureContent.course_key == course_key)
            .one_or_none()
        )

    def teach(
        self,
        player_id: str,
        course_key: str,
        level: str = "beginner",
        plant_id: Optional[str] = None,
    ) -> LectureReport:
        """Return the course's canonical lecture, generating + saving it ONCE.

        ``level``/``plant_id`` are accepted for backward API compatibility but
        no longer vary the delivered content — see the module docstring for
        why. Every call for a given ``course_key`` after the first is a pure
        cache read: no provider call, no knowledge event.
        """
        GameService(self.session).get_player(player_id)
        course = load_curriculum().get("courses", {}).get(course_key)
        if course is None:
            raise GameError(f"Unknown course '{course_key}'")

        cached = self._cached(course_key)
        if cached is not None:
            return _report_from_row(cached)

        lecture = course.get("lecture") or {}
        context = {
            "course": course.get("name", course_key),
            "department": course.get("department"),
            "topic": lecture.get("topic"),
            "objectives": list(lecture.get("objectives") or []),
            # Produce-once: the level/plant-state axes are deliberately NOT
            # threaded in — see the module docstring's design-choice note.
            "level": "beginner",
        }
        report = self.provider.lecture(context)

        try:
            self.session.add(
                LectureContent(
                    course_key=course_key,
                    title=report.title,
                    summary=report.summary,
                    content=report.content,
                    key_takeaways=list(report.key_takeaways or []),
                    quiz_question=report.quiz_question or "",
                    provider=self.provider.name(),
                )
            )
            self.session.flush()
        except IntegrityError:
            # Another concurrent request already generated + saved this
            # course's lecture first (unique course_key). Roll back our
            # duplicate insert and serve the winner's saved copy instead of
            # persisting (and returning) a second, different lecture.
            self.session.rollback()
            existing = self._cached(course_key)
            if existing is not None:
                return _report_from_row(existing)
            raise
        else:
            # Only a genuine cache MISS feeds the global knowledge layer — a
            # cache hit is a replay of already-captured content, not a new
            # generative artifact (design/11 P1).
            KnowledgeService(self.session, clock=self.clock).append(
                "lecture_delivered",
                {"course_key": course_key, "title": report.title},
                player_id=player_id,
            )
        return report
