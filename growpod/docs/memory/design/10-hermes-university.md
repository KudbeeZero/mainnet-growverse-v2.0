# 10 — HERMES University for Cannabis (identity + wiring truth)

> Owner directive (2026-07-02): the university keeps everything that's built — **no overhaul** —
> but its identity is **HERMES University for cannabis**: a real online school. Lessons are
> **produced once and saved** (never re-billed per delivery), the difficulty picker is gone, and
> this doc is the university's dedicated memory layer: what's wired, what was mis-wired and fixed,
> and what remains. It extends `06`/`07`/`08`/`09`; where they describe vision, this describes
> **wiring truth** (verified 2026-07-02 by an end-to-end audit with file:line evidence).

## Identity

- **Name:** HERMES University for cannabis. Web eyebrows/branding say "HERMES UNIVERSITY";
  package/route/code identifiers deliberately keep their existing names (no churn).
- **Shape:** an online school — course catalog grouped into "School of …" departments, credits on
  every course card, a degree-progress strip, registrar/transcript, My Path (learner dashboard),
  Coach, and the 3D Explorer lab.
- **One canonical lesson per course.** The Beginner/Intermediate/Advanced selector was removed
  (web `university/courses/[key]/page.tsx`, 2026-07-02); the backend `level` param remains
  tolerant for compat but the product has a single delivery per course.

## Lesson production pipeline (produce-once — the HARD RULE)

- **Lecture text (2026-07-02 fix):** `LecturerService.teach()` was calling the AI provider (or
  mock) fresh on EVERY request — a live bug against this doc's own hard rule, and it meant
  nothing was ever saved to replay. Fixed: a new `LectureContent` row, keyed on `course_key`
  ONLY (unique index), caches the lecture text exactly like `lecture_audio` caches the MP3.
  `teach()` is now cache-first: a hit returns the saved lecture with NO provider call; a miss
  generates once, persists, and appends a `knowledge_events` "lecture_delivered" row (design/11
  P1). `plant_id`/`level` stay accepted params (API compat) but are no longer read into the AI
  prompt — see `services/lecturer_service.py`'s module docstring for the "why" (one canonical
  lesson per course, same rule that removed the web difficulty picker; personalizing the *cached
  artifact* would silently reintroduce per-delivery regeneration through the back door).
- **Narration text:** course narration text is `build_course_spoken_text(course)` — static
  curriculum text, level-independent (`ai/elevenlabs_narrator.py`).
- **Audio:** produced by ElevenLabs **once per course**, keyed `{dept_voice}_{content_hash}`, and
  saved through three layers: `/tmp` (L1) → GCS (L2) → `lecture_audio` DB row (L3). The startup
  prewarm thread (`api/audio_prewarm.py`) warms every course when a key is set, so players always
  hit cache.
- **Serving:** `GET /api/game/university/courses/<key>/audio` is THE audio endpoint. The lecture
  endpoint advertises exactly that URL as `audio_url` (2026-07-02 fix) — it no longer narrates
  per-delivery AI lecture text, which had (a) bypassed the durable cache (`session=None`) and
  re-billed after every deploy, and (b) minted a distinct MP3 per level/variant/plant-context.
  `serve_narration` (`/narration/<key>/<level>?h=`) still exists, hash-gated, but nothing links
  to it anymore; it can be retired once nothing external depends on it.
- **Secrets:** `ELEVENLABS_API_KEY` lives in the host secret store ONLY (Fly/Render/Vercel env).
  Never in the repo, never pasted in chat. No key → text-only lectures (audio omitted); CI never
  needs a key.

## Layer map (verified wiring, 2026-07-02)

| Layer | Source of truth | Consumed by | Status |
|---|---|---|---|
| Curriculum | `data/curriculum.yaml` (15 courses, 6 depts, 5 degrees) | `university_service` (enroll/complete/degrees/transcript) | ✅ healthy |
| Skills graph | `data/skills.yaml` (15 skills, `course_skills` 1:1, acyclic) | `services/skills.py` → learner model + roadmap | ✅ healthy |
| Assessments | `data/assessments/` (**only `bio-101.yaml` exists**) | `assessment_service` (pure grading) → `AssessmentAttempt` → gates `complete_course` | ✅ for bio-101; ⬜ banks for the other 14 courses. **2026-07-02:** `AssessmentAttempt.last_result` now saves the latest graded, item-level result (replay) alongside the forgiving best_score/passed; `UniversityService.last_exam_result()` + `GET .../exams/<id>/last-result` read it back. |
| Lecture text | `LectureContent` (`course_key` unique) | `LecturerService.teach()` cache-first | ✅ produce-once after 2026-07-02 fix (was regenerating every request — see pipeline section above) |
| Learner model | `LearnerModelService.apply` = the ONLY writer; every mutation audited via `LearnerEvent` | enroll/complete/exam/admissions write; Roadmap reads | ✅ single-writer invariant holds |
| Mastery | `recompute_mastery`: exam best_scores **+ (2026-07-02 fix) completed courses seed their skills at the 0.7 threshold** | MasteryPanel, Roadmap | ✅ fixed — was dead for 14/15 courses (exam-only) |
| Admissions agent | `admissions_mock` + `admissions_service` — non-economic, audited | writes `experience_level`+`goals` to profile | ⚠️ recommended department/track land only in the audit row — display-once dead-end (see Open work) |
| Roadmap agent | `roadmap_mock` + `roadmap_service` — read-only, prereq-ordered | My Path | ✅ read-only; ⚠️ skills-graph prereqs are stricter than curriculum prereqs (known, deliberate for bio-101 — decide before launch) |
| Master Grower bot | `master_grower_service` — read-only tools, no ledger | Coach page | ✅ by design; asking it still feeds no engagement/learner-model events, but a non-refused ask now appends one `knowledge_events` "master_grower_qa" row (2026-07-02, design/11 P1) — global capture, not personal state |
| Audio | see pipeline above | course page player + lecture card | ✅ produce-once after 2026-07-02 fix |
| Web | `web/src/lib/api/university.ts` → real endpoints; My Path reads `/university/learner` + `/roadmap` | — | ✅ healthy; ⚠️ MasteryPanel labels mastered skills by raw id (metadata comes only from roadmap steps, which omit mastered skills) |

## Open work (priority order — mirrors BACKLOG "HERMES University + hardening")

1. **Assessment banks for the remaining 14 courses** — mastery currently floors at 0.7 on
   completion; exams are what raise it and make degrees mean something.
2. **Persist + consume the admissions recommendation** — store department/track on the profile
   (columns or a preferences JSON), surface on `/university/learner`, highlight the recommended
   track in the catalog.
3. **Reconcile the two prerequisite graphs** — either make bio-101 a curriculum prereq of the
   foundation courses or drop the `plant-biology` edges in `skills.yaml`; today enroll() and the
   roadmap disagree.
4. **MasteryPanel metadata** — serve skill name/domain from a skills-catalog (or the learner
   endpoint) instead of scraping roadmap steps; mastered skills currently render as raw ids under
   "general".
5. **Retire `serve_narration`** once confirmed nothing external links the `/narration/...` URLs.
6. **Presenter video** — still mock (07/08 codex); real HeyGen render is owner-gated spend.

## What must NOT drift

- Produce-once: no code path may narrate per-delivery/variable text with a live key, and (2026-
  07-02) no code path may call the lecture provider for a `course_key` that already has a saved
  `LectureContent` row.
- `LearnerModelService.apply` stays the only learner-profile writer (audited).
- `KnowledgeService.append` (design/11) stays the only writer of `knowledge_events` — append-
  only, never updated/deleted by app code (2026-07-02).
- University stays NON-ECONOMIC (no GROW ledger writes from learner/engagement/agents/knowledge
  capture).
- No overhaul: the systems above are kept and tightened, not replaced.
