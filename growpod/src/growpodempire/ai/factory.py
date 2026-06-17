"""
Selects the advisor provider based on configuration.

Returns the real Claude-backed advisor when an Anthropic API key is configured
(and the mock isn't forced); otherwise an offline MockAdvisorProvider so the app
and tests run with no network or secrets — mirroring chain/factory.py.
"""

from typing import Optional

from ..config import get_settings
from .provider import AdvisorProvider, LecturerProvider
from .mock import MockAdvisorProvider
from .lecturer_mock import MockLecturerProvider
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
