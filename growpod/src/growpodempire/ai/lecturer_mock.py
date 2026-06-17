"""
Deterministic offline lecturer — the CI/no-key default.

Builds a real-looking lecture from the course context (name, topic, objectives)
with no network or randomness, so the app and tests run with no secrets. The
real, free-form professor is `ClaudeLecturerProvider`.
"""

from .provider import LecturerProvider, LectureReport


class MockLecturerProvider(LecturerProvider):
    def name(self) -> str:
        return "mock"

    def lecture(self, context: dict) -> LectureReport:
        course = context.get("course", "GrowPod University")
        topic = context.get("topic") or f"Foundations of {course}"
        objectives = list(context.get("objectives") or [])
        level = context.get("level", "beginner")

        title = f"{course}: {topic.split(':')[0][:60].rstrip('.')}"
        summary = (
            f"A {level}-level lecture for {course}. {topic}"
        )
        obj_block = "".join(f"\n  - {o}" for o in objectives) or "\n  - Build practical fluency."
        content = (
            f"Welcome to {course}. Today's lecture: {topic}\n\n"
            f"Learning objectives:{obj_block}\n\n"
            "We approach this from first principles — the underlying science and "
            "the practical systems you will manage in your own grow. Grounding the "
            "theory in your plants' real behavior is how the material sticks: as you "
            "study, run the practical alongside the reading.\n\n"
            "By the end you should be able to act on this material in your next grow "
            "cycle, and the course's practical requirement is your proof of mastery."
        )
        takeaways = [o for o in objectives[:4]] or [
            "Ground theory in your real plants.",
            "Complete the practical to prove mastery.",
        ]
        quiz = (
            f"In your own words, why does '{objectives[0]}' matter in practice?"
            if objectives else f"What is the core idea behind {topic.split(':')[0]}?"
        )
        return LectureReport(
            title=title, summary=summary, content=content,
            key_takeaways=takeaways, quiz_question=quiz,
        )
