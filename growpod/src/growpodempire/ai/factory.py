"""
Selects the advisor provider based on configuration.

Returns the real Claude-backed advisor when an Anthropic API key is configured
(and the mock isn't forced); otherwise an offline MockAdvisorProvider so the app
and tests run with no network or secrets — mirroring chain/factory.py.
"""

from typing import Optional

from ..config import get_settings
from .provider import (
    AdvisorProvider,
    LecturerProvider,
    MasterGrowerProvider,
    VideoPresenterProvider,
)
from .mock import MockAdvisorProvider
from .lecturer_mock import MockLecturerProvider
from .master_grower_mock import MockMasterGrower
from .video_presenter_mock import MockVideoPresenter
from .autocare import AutoCareProvider, MockAutoCareProvider


def get_advisor_provider(settings=None) -> AdvisorProvider:
    settings = settings or get_settings()

    if settings.use_mock_ai or not settings.anthropic_api_key:
        return MockAdvisorProvider()

    # Real advisor configured — import lazily so mock users never need anthropic.
    from .claude import ClaudeAdvisorProvider

    return ClaudeAdvisorProvider(
        api_key=settings.anthropic_api_key,
        model=settings.advisor_model,
    )


# Process-wide singleton (the Claude client is reusable; the mock is stateless).
_advisor: Optional[AdvisorProvider] = None


def shared_advisor(settings=None) -> AdvisorProvider:
    global _advisor
    if _advisor is None:
        _advisor = get_advisor_provider(settings)
    return _advisor


def reset_shared_advisor() -> None:
    global _advisor
    _advisor = None


def get_lecturer_provider(settings=None) -> LecturerProvider:
    settings = settings or get_settings()
    if settings.use_mock_ai or not settings.anthropic_api_key:
        return MockLecturerProvider()
    from .lecturer_claude import ClaudeLecturerProvider
    return ClaudeLecturerProvider(
        api_key=settings.anthropic_api_key, model=settings.advisor_model,
    )


_lecturer: Optional[LecturerProvider] = None


def shared_lecturer(settings=None) -> LecturerProvider:
    global _lecturer
    if _lecturer is None:
        _lecturer = get_lecturer_provider(settings)
    return _lecturer


def reset_shared_lecturer() -> None:
    global _lecturer
    _lecturer = None


def get_auto_care_provider(settings=None) -> AutoCareProvider:
    settings = settings or get_settings()
    if settings.use_mock_ai or not settings.anthropic_api_key:
        return MockAutoCareProvider()
    from .autocare import ClaudeAutoCareProvider
    return ClaudeAutoCareProvider(
        api_key=settings.anthropic_api_key, model=settings.advisor_model
    )


def get_master_grower_provider(settings=None) -> MasterGrowerProvider:
    """The FREE Master Grower bot's provider.

    Returns the deterministic offline mock when the mock is forced or no
    Anthropic key is configured (so CI never needs a key). The real
    `ClaudeMasterGrower` is a later sub-deliverable; until it lands, even a
    key-configured environment returns the mock.
    """
    settings = settings or get_settings()
    if settings.use_mock_ai or not settings.anthropic_api_key:
        return MockMasterGrower()
    # Real Claude-backed Master Grower is a later sub-deliverable; until then the
    # deterministic mock is the only implementation, so always return it.
    return MockMasterGrower()


_master_grower: Optional[MasterGrowerProvider] = None


def shared_master_grower(settings=None) -> MasterGrowerProvider:
    global _master_grower
    if _master_grower is None:
        _master_grower = get_master_grower_provider(settings)
    return _master_grower


def reset_shared_master_grower() -> None:
    global _master_grower
    _master_grower = None


def get_video_presenter_provider(settings=None) -> VideoPresenterProvider:
    """Mock unless a real video backend is configured AND enabled.

    The real HeyGen provider is owner-gated (one-time ~$140 spend) and not yet
    enabled, so even with a key set we return the deterministic mock for now.
    When the owner approves, add HeyGenVideoPresenter and flip this branch.
    """
    settings = settings or get_settings()
    if settings.use_mock_ai or not getattr(settings, "heygen_api_key", None):
        return MockVideoPresenter()
    # Owner-gated: real HeyGen rendering deferred until spend is approved.
    return MockVideoPresenter()


_video_presenter: Optional[VideoPresenterProvider] = None


def shared_video_presenter(settings=None) -> VideoPresenterProvider:
    global _video_presenter
    if _video_presenter is None:
        _video_presenter = get_video_presenter_provider(settings)
    return _video_presenter


def reset_shared_video_presenter() -> None:
    global _video_presenter
    _video_presenter = None
