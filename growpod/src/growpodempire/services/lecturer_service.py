"""
LecturerService — assembles a course context and asks the Professor (the AI
lecturer provider) for a lecture. Mirrors AdvisorService: a deterministic mock in
CI/no-key, real Claude when configured.
"""

from typing import Optional

from sqlalchemy.orm import Session

from ..economy.config import get_economy_config, EconomyConfig
from ..ai.provider import LecturerProvider, LectureReport
from ..ai.factory import shared_lecturer
from ..simulation.clock import Clock, SystemClock
from .game_service import GameService, GameError
from .university_service import load_curriculum


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

    def teach(
        self,
        player_id: str,
        course_key: str,
        level: str = "beginner",
        plant_id: Optional[str] = None,
    ) -> LectureReport:
        GameService(self.session).get_player(player_id)
        course = load_curriculum().get("courses", {}).get(course_key)
        if course is None:
            raise GameError(f"Unknown course '{course_key}'")

        lecture = course.get("lecture") or {}
        context = {
            "course": course.get("name", course_key),
            "department": course.get("department"),
            "topic": lecture.get("topic"),
            "objectives": list(lecture.get("objectives") or []),
            "level": level if level in ("beginner", "intermediate", "advanced") else "beginner",
        }
        if plant_id:
            from .simulation_service import SimulationService
            plant = SimulationService(self.session, config=self.cfg, clock=self.clock).get_state(
                player_id, plant_id
            )
            context["student_plant"] = {
                "growth_stage": plant.growth_stage,
                "health": round(plant.health, 1),
                "height_cm": round(plant.height, 1),
            }
        return self.provider.lecture(context)
