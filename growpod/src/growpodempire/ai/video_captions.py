"""
Pure, deterministic caption-track builder for presenter videos.

Splits a spoken script into timed CaptionCues. No network, no AI — same text
always yields the same cues, so it is unit-testable and CI-safe. The mock video
presenter uses it to estimate timings; the real (HeyGen) provider will instead
pass the exact ElevenLabs word timestamps in as `total_duration_s` so the cue
spans scale to the actual audio length while the split stays identical.
"""

from __future__ import annotations

import re

from .provider import CaptionCue

# Narration pace used to estimate cue durations when no real audio length is
# known. ~156 wpm ≈ 2.6 words/sec is a natural lecture cadence.
WORDS_PER_SECOND = 2.6

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def split_sentences(text: str) -> list[str]:
    """Deterministically split a script into non-empty, trimmed sentences."""
    if not text:
        return []
    return [s.strip() for s in _SENTENCE_SPLIT.split(text) if s and s.strip()]


def build_captions(text: str, total_duration_s: float | None = None) -> list[CaptionCue]:
    """Build a contiguous, non-overlapping caption track from a spoken script.

    Cue durations are proportional to each sentence's word count. When
    ``total_duration_s`` is given (the real audio length), the whole track is
    scaled to fit it exactly; otherwise durations come from ``WORDS_PER_SECOND``.
    """
    sentences = split_sentences(text)
    if not sentences:
        return []

    word_counts = [max(1, len(s.split())) for s in sentences]
    durations = [w / WORDS_PER_SECOND for w in word_counts]

    total_base = sum(durations)
    if total_duration_s is not None and total_duration_s > 0 and total_base > 0:
        scale = total_duration_s / total_base
        durations = [d * scale for d in durations]

    cues: list[CaptionCue] = []
    t = 0.0
    for sentence, dur in zip(sentences, durations):
        start = round(t, 2)
        t += dur
        cues.append(CaptionCue(start_s=start, end_s=round(t, 2), text=sentence))
    return cues


def captions_duration(cues: list[CaptionCue]) -> float:
    """Total track length — the end of the last cue (0.0 if empty)."""
    return cues[-1].end_s if cues else 0.0
