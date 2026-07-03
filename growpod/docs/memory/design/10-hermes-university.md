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

- **Text:** course narration text is `build_course_spoken_text(course)` — static curriculum text,
  level-independent (`ai/elevenlabs_narrator.py`).
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
| Assessments | `data/assessments/` (**only `bio-101.yaml` exists**) | `assessment_service` (pure grading) → `AssessmentAttempt` → gates `complete_course` | ✅ for bio-101; ⬜ banks for the other 14 courses |
| Learner model | `LearnerModelService.apply` = the ONLY writer; every mutation audited via `LearnerEvent` | enroll/complete/exam/admissions write; Roadmap reads | ✅ single-writer invariant holds |
| Mastery | `recompute_mastery`: exam best_scores **+ (2026-07-02 fix) completed courses seed their skills at the 0.7 threshold** | MasteryPanel, Roadmap | ✅ fixed — was dead for 14/15 courses (exam-only) |
| Admissions agent | `admissions_mock` / `ClaudeAdmissions` (real 2026-07-03) + `admissions_service` | writes `experience_level`+`goals` to profile | ⚠️ recommendation display-once — persist+surface still open (see Open work) |
| Roadmap agent | `roadmap_mock` / `ClaudeRoadmap` (real 2026-07-03) + `roadmap_service` — read-only | My Path | ✅ real provider shipped; ⚠️ skills-graph prereqs stricter than curriculum prereqs (bio-101, deliberate) |
| Master Grower bot | `master_grower_service` — read-only tools, no ledger | Coach page | ✅ by design; asking it feeds no engagement/learner events (note) |
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

- Produce-once: no code path may narrate per-delivery/variable text with a live key.
- `LearnerModelService.apply` stays the only learner-profile writer (audited).
- University stays NON-ECONOMIC (no GROW ledger writes from learner/engagement/agents).
- No overhaul: the systems above are kept and tightened, not replaced.
