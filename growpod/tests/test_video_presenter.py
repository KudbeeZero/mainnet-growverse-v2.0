"""Phase 2 — presenter-video layer: pure captions, the mock presenter, factory."""

from growpodempire.ai.provider import CaptionCue, PresenterVideo, VideoPresenterProvider
from growpodempire.ai.video_captions import (
    build_captions,
    split_sentences,
    captions_duration,
    WORDS_PER_SECOND,
)
from growpodempire.ai.video_presenter_mock import MockVideoPresenter, avatar_for
from growpodempire.ai.factory import (
    get_video_presenter_provider,
    reset_shared_video_presenter,
    shared_video_presenter,
)
from growpodempire.ai.elevenlabs_narrator import _text_hash, _build_spoken_text


LECTURE = {
    "title": "Trichomes",
    "summary": "Resin glands signal ripeness.",
    "content": "Clear heads are immature. Cloudy heads mean peak THC! Amber heads tip toward couch-lock.",
    "department": "cultivation",
}


# --- pure caption builder ---------------------------------------------------

def test_split_sentences_deterministic_and_trimmed():
    s = split_sentences("One. Two!  Three?\n\nFour")
    assert s == ["One.", "Two!", "Three?", "Four"]
    assert split_sentences("") == []


def test_build_captions_contiguous_non_overlapping_and_ordered():
    cues = build_captions(LECTURE["content"])
    assert cues and all(isinstance(c, CaptionCue) for c in cues)
    assert cues[0].start_s == 0.0
    for a, b in zip(cues, cues[1:]):
        assert a.end_s <= b.start_s  # no overlap, monotonic
        assert a.end_s >= a.start_s


def test_build_captions_is_deterministic():
    assert build_captions(LECTURE["content"]) == build_captions(LECTURE["content"])


def test_build_captions_scales_to_real_audio_duration():
    target = 30.0
    cues = build_captions(LECTURE["content"], total_duration_s=target)
    assert captions_duration(cues) == round(target, 2) or abs(captions_duration(cues) - target) < 0.05
    # longer audio → later cues than the unscaled estimate
    base = build_captions(LECTURE["content"])
    assert captions_duration(cues) > captions_duration(base)


def test_words_per_second_estimate_is_sane():
    # a 13-word single sentence ≈ 13 / 2.6 ≈ 5s
    cues = build_captions("one two three four five six seven eight nine ten eleven twelve thirteen")
    assert len(cues) == 1
    assert abs(cues[0].end_s - 13 / WORDS_PER_SECOND) < 0.05


# --- mock presenter ---------------------------------------------------------

def test_mock_presenter_is_well_formed_and_audio_fallback():
    video = MockVideoPresenter().present(LECTURE)
    assert isinstance(video, PresenterVideo)
    assert video.backend == "mock"
    assert video.video_url is None  # audio/text fallback, no rendered video
    assert video.captions  # transcript present
    assert video.duration_s > 0


def test_mock_presenter_cache_key_matches_narration_hash():
    # The audio_hash must equal the narrator's hash of the SAME script, so the
    # video reuses the already-cached MP3 rather than regenerating audio.
    video = MockVideoPresenter().present(LECTURE)
    assert video.audio_hash == _text_hash(_build_spoken_text(LECTURE))


def test_mock_presenter_avatar_is_per_department():
    assert avatar_for("cultivation") != avatar_for("genetics")
    assert avatar_for(None) == avatar_for("unknown-dept")  # both → default


def test_mock_presenter_prefers_precomputed_spoken_text():
    ctx = {"spoken_text": "Custom script line one. Line two.", "department": "ipm"}
    video = MockVideoPresenter().present(ctx)
    assert video.audio_hash == _text_hash("Custom script line one. Line two.")


# --- factory ----------------------------------------------------------------

class _Settings:
    def __init__(self, use_mock_ai=False, heygen_api_key=None):
        self.use_mock_ai = use_mock_ai
        self.heygen_api_key = heygen_api_key


def test_factory_returns_mock_without_key():
    p = get_video_presenter_provider(_Settings(use_mock_ai=False, heygen_api_key=None))
    assert isinstance(p, VideoPresenterProvider)
    assert p.name() == "mock"


def test_factory_returns_mock_when_mock_forced_even_with_key():
    p = get_video_presenter_provider(_Settings(use_mock_ai=True, heygen_api_key="sk-test"))
    assert p.name() == "mock"


def test_factory_owner_gated_real_still_mock_for_now():
    # A key set but spend not yet approved → still the mock (no accidental spend).
    p = get_video_presenter_provider(_Settings(use_mock_ai=False, heygen_api_key="sk-test"))
    assert p.name() == "mock"


def test_shared_video_presenter_singleton_and_reset():
    reset_shared_video_presenter()
    a = shared_video_presenter(_Settings(use_mock_ai=True))
    b = shared_video_presenter(_Settings(use_mock_ai=True))
    assert a is b
    reset_shared_video_presenter()
    assert shared_video_presenter(_Settings(use_mock_ai=True)) is not a
