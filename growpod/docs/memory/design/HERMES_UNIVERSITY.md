# HERMES University — live memory layer

> **Live companion to `10-hermes-university.md`** (the founding wiring-truth doc verified 2026-07-02).
> This file is updated every session; `10-hermes-university.md` is the stable reference.
> Last updated: 2026-07-03.

## Identity

- **Name:** HERMES University for cannabis — a real online school inside GROWv2.
- **Shape:** course catalog grouped into "School of …" departments, degree-progress strip,
  credits on every course card, registrar/transcript, My Path (learner dashboard), Coach, 3D Explorer lab.
- **One canonical lesson per course** (difficulty selector removed 2026-07-02).
- **NON-ECONOMIC**: zero GROW ledger writes from learner, engagement, or agent paths.
- Code identifiers keep their existing names — no renaming churn.

## Lesson production pipeline (HARD RULE — produce-once)

- Text: `build_course_spoken_text(course)` — static curriculum text, level-independent
  (`ai/elevenlabs_narrator.py`).
- Audio: ElevenLabs, produced **once per course**, keyed `{dept_voice}_{content_hash}`,
  saved L1 `/tmp` → L2 GCS → L3 `lecture_audio` DB row. Startup prewarm warms all courses.
- Serving: `GET /api/game/university/courses/<key>/audio` is the single audio endpoint.
  The lecture endpoint advertises `audio_url` pointing there; it never narrates variable text.
- Secrets: `ELEVENLABS_API_KEY` is host-secret-only. No key → text-only; CI never needs a key.

## AI providers (factory: `ai/factory.py`)

| Provider | Mock | Real (with key) | Status |
|---|---|---|---|
| LecturerProvider | `MockLecturerProvider` | `ClaudeLecturerProvider` (opus) | ✅ |
| AdmissionsProvider | `MockAdmissions` | `ClaudeAdmissions` (haiku) | ✅ real shipped 2026-07-03 |
| RoadmapProvider | `MockRoadmap` | `ClaudeRoadmap` (haiku) | ✅ real shipped 2026-07-03 |
| MasterGrowerProvider | `MockMasterGrower` | `ClaudeMasterGrower` (haiku) | ✅ |
| VideoPresenterProvider | `MockVideoPresenter` | (owner-gated spend) | ⚠️ mock only |

- `ClaudeAdmissions`: validates Claude's department choice against the live curriculum;
  course track always built from curriculum (never from Claude output).
- `ClaudeRoadmap`: delegates topological sort to `MockRoadmap` (guarantees valid skill_ids +
  prereq order); asks Claude only for a personalized rationale string.

## Layer map (current state, 2026-07-03)

| Layer | Source of truth | Status |
|---|---|---|
| Curriculum | `data/curriculum.yaml` — 15 courses, 6 depts, 5 degrees | ✅ healthy |
| Skills graph | `data/skills.yaml` — 15 skills, `course_skills` 1:1, acyclic | ✅ healthy |
| Assessments | `data/assessments/` — **only `bio-101.yaml` exists** | ⬜ 14 courses need banks |
| Learner model | `LearnerModelService.apply` = ONLY writer | ✅ single-writer invariant |
| Mastery | `recompute_mastery` — exam scores + completed-course seed at 0.7 | ✅ (fixed 2026-07-02) |
| Admissions agent | `ClaudeAdmissions` (real 2026-07-03) | ⚠️ recommendation display-once — persist+surface open |
| Roadmap agent | `ClaudeRoadmap` (real 2026-07-03) | ✅ read-only; ⚠️ skills-graph prereqs stricter than curriculum (bio-101 edge, deliberate) |
| Master Grower | `ClaudeMasterGrower` — read-only tools, no ledger | ✅ |
| Audio | produce-once pipeline (see above) | ✅ (fixed 2026-07-02) |
| Web API | `web/src/lib/api/university.ts` — 16 backend routes wired (audit 2026-07-03) | ✅; ⚠️ MasteryPanel shows raw skill ids for mastered skills |

## Open work (priority order)

1. **Assessment banks for 14 remaining courses** — mastery floors at 0.7 on completion;
   exams are what raise it and make degrees meaningful.
2. **Persist + surface admissions recommendation** — store dept/track on profile
   (or a preferences JSON), surface on `/university/learner`, highlight in catalog.
3. **Reconcile prerequisite graphs** — bio-101 is in `skills.yaml` edges but not in
   curriculum `prereqs`; enroll() and the roadmap currently disagree.
4. **MasteryPanel metadata** — serve skill name/domain from a skills-catalog endpoint;
   mastered skills render as raw ids under "general" today.
5. **Retire `serve_narration`** — `/narration/<key>/<level>?h=` still exists; confirm
   nothing external links it, then remove route + handler.
6. **Presenter video** — still mock; real HeyGen rendering is owner-gated spend.
7. **Global Learning Memory** (design/11) — P1 `knowledge_events` capture at 4 generative
   call sites; P2 admissions persistence + personal context into lecture/MasterGrower;
   P3 `search_global_knowledge` tool; P4 `global_insights` rollups.

## Must-not-drift invariants

- **Produce-once**: no code path may narrate per-delivery/variable text with a live ElevenLabs key.
- **`LearnerModelService.apply` stays the ONLY learner-profile writer** (audited).
- **University stays NON-ECONOMIC** — no GROW ledger writes from learner/engagement/agents.
- **No overhaul** — existing systems are tightened, not replaced.
- **Admissions/Roadmap validity** — department must exist in live curriculum; course track always
  from curriculum (never invented by AI output); skill_ids always from skills graph.
