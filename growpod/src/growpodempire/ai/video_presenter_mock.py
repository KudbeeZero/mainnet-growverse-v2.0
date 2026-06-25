"""
Deterministic, offline mock for the presenter-video layer.

Produces a PresenterVideo with NO network call and NO video URL — the course
player falls back to the existing narration audio plus this caption track. It
reuses the ElevenLabs narrator's script builder and text hash so the cache key
``(avatar_id, audio_hash)`` lines up with the audio that's already cached. This
lets the whole Phase-2 video path run in CI for free; the real HeyGen provider
(owner-gated, one-time ~$140 spend) drops in behind the same ABC later.
"""

from __future__ import annotations

from .provider import PresenterVideo, VideoPresenterProvider
from .video_captions import build_captions, captions_duration
from .elevenlabs_narrator import _build_spoken_text, _text_hash

# Department → stylized presenter avatar id. Kept deterministic and distinct so
# each faculty reads as a different presenter. The real provider maps these to
# concrete HeyGen avatar ids; the mock just echoes the stable identity.
_AVATAR_FOR = {
    "cultivation": "avatar-flora",
    "genetics": "avatar-lindqvist",
    "nutrients": "avatar-harlow",
    "ipm": "avatar-okafor",
    "chemistry": "avatar-torres",
    "postharvest": "avatar-nance",
}
_DEFAULT_AVATAR = "avatar-faculty"

# Department → faculty display name (the shipped code-authoritative roster; the
# additive owner decision keeps these and adds new-school faculty later).
_PRESENTER_NAME = {
    "cultivation": "Professor Flora",
    "genetics": "Vera Lindqvist",
    "nutrients": "Dr. Sage Harlow",
    "ipm": "Dr. Mira Okafor",
    "chemistry": "Dr. Chem Torres",
    "postharvest": "Dr. Petra Nance",
}
_DEFAULT_NAME = "The Professor"


def avatar_for(department: str | None) -> str:
    """Stable presenter avatar id for a curriculum department."""
    return _AVATAR_FOR.get(department or "", _DEFAULT_AVATAR)


def presenter_name_for(department: str | None) -> str:
    """Faculty display name for a curriculum department."""
    return _PRESENTER_NAME.get(department or "", _DEFAULT_NAME)


def spoken_text_from_context(context: dict) -> str:
    """The spoken script for a lecture context — precomputed or built from fields.

    Mirrors the narrator so the resulting hash matches the cached MP3.
    """
    text = context.get("spoken_text")
    if isinstance(text, str) and text.strip():
        return text
    return _build_spoken_text(context)


class MockVideoPresenter(VideoPresenterProvider):
    """Offline presenter: real captions + cache key, no video URL (audio fallback)."""

    def name(self) -> str:
        return "mock"

    def present(self, context: dict) -> PresenterVideo:
        department = context.get("department")
        text = spoken_text_from_context(context)
        captions = build_captions(text, context.get("audio_duration_s"))
        return PresenterVideo(
            avatar_id=avatar_for(department),
            presenter_name=presenter_name_for(department),
            audio_hash=_text_hash(text),
            backend="mock",
            video_url=None,  # no rendered video → player uses narration audio + captions
            poster_url=None,
            duration_s=captions_duration(captions),
            captions=captions,
        )
