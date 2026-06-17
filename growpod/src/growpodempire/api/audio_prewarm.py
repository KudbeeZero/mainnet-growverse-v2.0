"""
Background audio pre-warm: generates ElevenLabs MP3 for every curriculum
course at server startup so the first player request always hits the cache.

Cache layers touched during prewarm
-------------------------------------
  L1  /tmp on-disk — fast in-process serving; wiped on each deploy.
  L2  App Storage (GCS) — durable across deploys; keyed per (voice, hash).
  L3  DB `lecture_audio` table — durable BLOB and object_path pointer.

Design
------
* `start_prewarm_thread()` spawns a daemon thread so startup is never blocked.
* A module-level `threading.Event` (`PREWARM_DONE`) lets callers wait for
  completion with a short timeout before falling through to live generation.
* Each course is checked in the three-layer order above:
    1. GCS object_path present in DB row → download to /tmp (if missing).
    2. DB BLOB present without object_path → upload to GCS, restore /tmp.
    3. /tmp only → backfill DB and upload to GCS.
    4. Nothing → call ElevenLabs, write all three layers.
* Any individual course failure is logged and skipped; the rest continue.
"""

import logging
import threading
from typing import Optional

logger = logging.getLogger(__name__)

# Set when all courses have been processed (success or graceful skip).
# Initialized as SET so that environments without ELEVENLABS_API_KEY never
# block on wait_for_prewarm().  start_prewarm_thread() clears it first and
# the thread sets it again when done.
PREWARM_DONE: threading.Event = threading.Event()
PREWARM_DONE.set()  # default: no prewarm running → return immediately


def prewarm_course_audio() -> None:
    """
    Iterate every course in the curriculum and ensure MP3 bytes exist in the
    DB (`lecture_audio` table), GCS (App Storage), and the /tmp on-disk cache.

    Guarantees
    ----------
    * GCS object is always written so the cache survives deploys without hitting
      ElevenLabs again.
    * DB row always has object_path set (once GCS upload succeeds) so the audio
      endpoint can redirect to GCS rather than stream from the DB BLOB.
    * /tmp file is always written so in-process requests are served off disk.
    * `PREWARM_DONE` is set whether all courses succeeded or not so callers
      don't block indefinitely on partial failures.
    """
    import os

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        logger.info("audio_prewarm: ELEVENLABS_API_KEY not set — skipping")
        PREWARM_DONE.set()
        return

    try:
        from ..services.university_service import load_curriculum
        from ..ai.elevenlabs_narrator import (
            build_course_spoken_text,
            generate_narration_for_course,
            _voice_for,
            _text_hash,
            _cache_path,
            _db_get_row,
            _db_put,
            _db_set_object_path,
            _write_tmp_cache,
        )
        from ..ai.object_storage import gcs_get, gcs_put, gcs_exists
        from ..db.session import session_scope
    except Exception as exc:
        logger.warning("audio_prewarm: failed to import dependencies: %s", exc)
        PREWARM_DONE.set()
        return

    try:
        curriculum = load_curriculum()
    except Exception as exc:
        logger.warning("audio_prewarm: failed to load curriculum: %s", exc)
        PREWARM_DONE.set()
        return

    courses = curriculum.get("courses") or {}
    total = len(courses)
    if total == 0:
        logger.info("audio_prewarm: no courses found in curriculum")
        PREWARM_DONE.set()
        return

    logger.info("audio_prewarm: pre-warming audio for %d courses", total)
    already_ok = backfilled = generated = errors = 0

    for course_key, course in courses.items():
        try:
            with session_scope() as s:
                text = build_course_spoken_text(course)
                voice_id = _voice_for(course.get("department"))
                digest = _text_hash(text)
                path = _cache_path(voice_id, text)

                row = _db_get_row(s, voice_id, text)
                tmp_exists: bool = path.exists()

                # ── Case 1: GCS object_path recorded in DB ──────────────────
                if row and row.object_path:
                    if tmp_exists:
                        already_ok += 1
                        logger.debug("audio_prewarm: fully cached — %s", course_key)
                        continue
                    # Restore /tmp from GCS
                    mp3 = gcs_get(row.object_path)
                    if mp3:
                        _write_tmp_cache(path, mp3)
                        backfilled += 1
                        logger.info(
                            "audio_prewarm: restored /tmp from GCS for %s", course_key
                        )
                        continue
                    # GCS object missing despite object_path — fall through to
                    # re-generate or re-upload below.
                    logger.warning(
                        "audio_prewarm: GCS object missing for %s (object_path=%s) — "
                        "will re-upload",
                        course_key, row.object_path,
                    )

                # ── Case 2: DB BLOB present, no GCS path yet ────────────────
                if row and row.mp3_data:
                    mp3_bytes = row.mp3_data
                    obj_path = gcs_put(voice_id, digest, mp3_bytes)
                    if obj_path:
                        _db_set_object_path(s, row, obj_path)
                    if not tmp_exists:
                        _write_tmp_cache(path, mp3_bytes)
                    backfilled += 1
                    logger.info(
                        "audio_prewarm: uploaded DB BLOB to GCS for %s (path=%s)",
                        course_key, obj_path,
                    )
                    continue

                # ── Case 3: /tmp only, DB and GCS missing ───────────────────
                if tmp_exists:
                    mp3_bytes = path.read_bytes()
                    obj_path = gcs_put(voice_id, digest, mp3_bytes)
                    _db_put(s, voice_id, text, mp3_bytes, object_path=obj_path)
                    backfilled += 1
                    logger.info(
                        "audio_prewarm: backfilled DB+GCS from /tmp for %s", course_key
                    )
                    continue

                # ── Case 4: All caches cold — call ElevenLabs ───────────────
                mp3 = generate_narration_for_course(course, api_key=api_key, session=s)
                if mp3:
                    generated += 1
                    logger.info(
                        "audio_prewarm: generated %s (%d bytes)", course_key, len(mp3)
                    )
                else:
                    errors += 1
                    logger.warning(
                        "audio_prewarm: no audio returned for %s", course_key
                    )
        except Exception as exc:
            errors += 1
            logger.warning("audio_prewarm: error for %s: %s", course_key, exc)

    logger.info(
        "audio_prewarm: done — %d fully cached, %d backfilled, %d generated, "
        "%d errors (total %d)",
        already_ok, backfilled, generated, errors, total,
    )
    PREWARM_DONE.set()


def start_prewarm_thread() -> threading.Thread:
    """
    Spawn a daemon thread to run `prewarm_course_audio`.

    Returns the thread so callers can join() it in tests if desired.
    The thread is a daemon so it never prevents a clean server shutdown.
    """
    PREWARM_DONE.clear()
    t = threading.Thread(target=prewarm_course_audio, name="audio-prewarm", daemon=True)
    t.start()
    logger.info("audio_prewarm: background thread started")
    return t


def wait_for_prewarm(timeout: float = 8.0) -> bool:
    """
    Block until prewarm completes or *timeout* seconds elapse.

    Returns True if prewarm finished within the timeout, False otherwise.
    Safe to call when no prewarm thread was started (returns True immediately
    because the event starts in its set state until `start_prewarm_thread`
    clears and re-sets it).
    """
    return PREWARM_DONE.wait(timeout=timeout)
