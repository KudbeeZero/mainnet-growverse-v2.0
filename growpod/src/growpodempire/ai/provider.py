"""
Advisor provider interface + the structured report schema.

`AdvisorReport` is a Pydantic model so the real provider can use the Anthropic
SDK's structured-output parsing (`messages.parse`) to get a validated object
back, and the API layer can serialize it directly. The action vocabulary is
constrained to the game's real care actions so suggestions map onto endpoints
the player (or, later, an agentic auto-care loop) can actually call.
"""

from abc import ABC, abstractmethod
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class AdvisorError(Exception):
    """Any failure producing an advisor report (e.g. the AI backend errored)."""


# The care actions the advisor may recommend. These line up 1:1 with the
# SimulationService care methods / API routes (water, feed, treat-pests,
# treat-disease) plus a few non-action recommendations.
CareAction = Literal[
    "water",
    "feed",
    "treat_pests",
    "treat_disease",
    "adjust_environment",
    "harvest",
    "wait",
]

Severity = Literal["healthy", "minor", "serious", "critical"]


class CareSuggestion(BaseModel):
    action: CareAction = Field(description="The recommended care action.")
    urgency: Literal["now", "soon", "optional"] = Field(
        description="How time-sensitive this action is."
    )
    reason: str = Field(description="Why this action helps, grounded in the plant's state.")


class AdvisorReport(BaseModel):
    """A Master Grower's read on a single plant."""

    summary: str = Field(description="One or two sentences a player can act on.")
    severity: Severity = Field(description="Overall health assessment.")
    diagnosis: str = Field(description="What's going on with the plant and why.")
    suggestions: List[CareSuggestion] = Field(
        default_factory=list, description="Ordered, concrete next actions."
    )


class AdvisorProvider(ABC):
    """Turns a plant's live state into an AdvisorReport."""

    @abstractmethod
    def name(self) -> str:
        """Identifier for the backend (e.g. 'mock', 'claude:claude-opus-4-8')."""

    @abstractmethod
    def diagnose(self, context: dict) -> AdvisorReport:
        """Produce a report from a plant-state context dict.

        `context` is built by AdvisorService and contains the plant's stage,
        height, health, water/nutrient/pest/disease levels, condition_flags,
        a genome summary, the pod environment, and recent events.
        """


class LectureReport(BaseModel):
    """A GrowPod University lecture delivered by the Professor (Master Grower)."""

    title: str = Field(description="Lecture title.")
    summary: str = Field(description="One-paragraph overview for the course outline.")
    content: str = Field(description="The full lecture prose (several paragraphs).")
    key_takeaways: List[str] = Field(
        default_factory=list, description="3-5 actionable takeaways."
    )
    quiz_question: str = Field(
        default="", description="A single comprehension-check question (may be empty)."
    )


class LecturerProvider(ABC):
    """Generates educational lecture content for a course topic."""

    @abstractmethod
    def name(self) -> str:
        """Backend identifier (e.g. 'mock', 'claude:...')."""

    @abstractmethod
    def lecture(self, context: dict) -> LectureReport:
        """Produce a LectureReport from a course/topic context dict.

        `context` (built by LecturerService) carries the course name, lecture
        topic + objectives, requested level, and optional live game-state.
        """


class VideoPresenterError(Exception):
    """Any failure producing a presenter video (e.g. the video backend errored)."""


class CaptionCue(BaseModel):
    """One timed caption line for a presenter video. Times are seconds from start."""

    start_s: float = Field(description="Cue start, seconds from the video start.")
    end_s: float = Field(description="Cue end, seconds from the video start.")
    text: str = Field(description="The spoken text for this cue.")


class PresenterVideo(BaseModel):
    """A lecturer 'talking-head' video for a lecture, plus its caption track.

    Built from the SAME spoken script the ElevenLabs narrator uses, keyed by
    ``(avatar_id, audio_hash)`` so a given lecture's video is generated once and
    cached (mirroring the narration cache). ``video_url`` is None in the
    audio/text-only fallback (no backend key, or the mock), in which case the
    course player falls back to the existing narration audio + these captions.
    """

    avatar_id: str = Field(description="Presenter avatar identity (faculty/department).")
    presenter_name: str = Field(
        default="The Professor", description="Faculty display name shown on the avatar card."
    )
    audio_hash: str = Field(description="Hash of the spoken script — the cache key.")
    backend: str = Field(description="Backend identifier ('mock' / 'heygen').")
    video_url: Optional[str] = Field(
        default=None, description="Playable video URL, or None for audio/text fallback."
    )
    poster_url: Optional[str] = Field(default=None, description="Optional still/poster URL.")
    duration_s: float = Field(default=0.0, description="Clip duration in seconds.")
    captions: List[CaptionCue] = Field(
        default_factory=list, description="Timed caption track (== the narration transcript)."
    )


class VideoPresenterProvider(ABC):
    """Renders a faculty persona delivering a lecture as a talking-head video.

    Swappable behind config (mock in CI / no key; real HeyGen in prod), exactly
    like the advisor/lecturer providers. The mock is deterministic and never
    touches the network, so the whole course-video path runs in CI for free.
    """

    @abstractmethod
    def name(self) -> str:
        """Backend identifier (e.g. 'mock', 'heygen:<avatar>')."""

    @abstractmethod
    def present(self, context: dict) -> PresenterVideo:
        """Produce a PresenterVideo from a lecture context dict.

        `context` carries the spoken script (or the fields to build it), the
        department/faculty (→ avatar), and any precomputed narration timings.
        """
