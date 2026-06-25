# 🎓 GrowPod University — Phase 2: the long-form academy (content layer)

> The authoritative **standards spec** for turning the shipped university (`06-university.md`) into a
> Coursera-depth academy: long-form interactive courses, a Professor delivery system, real labs & exams,
> narrated audio, and one canonical authored course every future course is cloned from. This is the
> low-volatility *standards* layer; the full blueprint + the fully-authored exemplar course live in the
> Master Report `docs/research/UNI-001-v2-Master-Report.md` (UNI-001 v2). Where v1
> (`docs/research/2026-06-14-growpod-university-curriculum-architecture.md`) designed the **engagement
> engine**, this designs the **curriculum that engine serves**. Tags: ✅ built · 🔨 partial · ⬜ planned.

## Why Phase 2
Phase 1 built the *retention loop*; `06-university.md` shipped the *credential machinery* (degrees,
practicals, an AI Professor). What's missing is the **content body** — the modules, narrated interactive
lessons, virtual labs, staged exams, and audio that make a "4-hour course" actually four hours of real,
*interactive* learning. Phase 2 is content depth, **not** power creep and **not** monetization: the
earned-mastery moat is unchanged — knowledge is earned over real time and proven in the live grow, never
bought (`CLAUDE.md` → moat #6).

## Scope line (hard)
Research/architecture only in the directive that produced this. **No monetization, no tokenomics, no
on-chain diploma** here. Engagement currencies (KXP, streaks, league points) stay **non-economic** — they
never post to the ledger (faucet/sink invariant). Diploma-NFTs are a *future* hook, not a Phase-2 build.

## What already ships (reused, not rebuilt) ✅
- Curriculum data (6 depts · 14 courses · 5 degrees · practical types): `data/curriculum.yaml`.
- Enroll→study-clock→complete · claim-degree (idempotent) · transcript · catalog · degree perks reuse the
  research effect-keys: `services/university_service.py`.
- The AI **Professor**: `LecturerProvider` ABC + `LectureReport` in `ai/provider.py`; deterministic mock
  `ai/lecturer_mock.py`; real `ai/lecturer_claude.py`; factory `ai/factory.py`; service `teach()` in
  `services/lecturer_service.py`. CI-safe (mock, no key).
- Models `CourseEnrollment` / `DegreeProgress`: `db/models.py`. API `/university/*`: `api/game_api.py`.
- Web UI (catalog · transcript · course detail + lecture reader): `web/src/app/university/`; component
  library: `web/src/components/ui/`. Leveling curve: `services/leveling_service.py`.

## The standards (what future courses must conform to)

### 1. The course skeleton ⬜
Every course clones one flow: **Orientation** (Professor intro · roadmap · pre-assessment) → **Modules**
(each: video · narrated interactive lesson · interactive diagram/sim · knowledge checks · scenario) →
**Midterm** → remaining modules → **Capstone** (applied, proven in the live sim) → **Mastery Exam** →
**Certification**. Full diagram: Master Report §3.1.

### 2. Active participation, not slides ⬜
Each lesson uses ≥ 2 of the eleven interactivity primitives (clickable diagram · parameter sim · diagnosis
lab · environment-tuning · decision tree · drag-drop · virtual lab · before/after · guided experiment ·
reflection checkpoint · knowledge check). Master Report §3.2.

### 3. The honest-hour rule ⬜
Advertised active-content duration = **Σ(authored component durations)** — no padding, no idle timers
(Master Report §3.3, §9). Distinct from the catalog's existing `duration_hours`, which is the **study-clock
gate** (real elapsed time before "complete" is allowed): the UI must show both honestly. The exemplar's
component budget sums to exactly **240 min = 4.0 h** (the acceptance test).

### 4. Five duration bands ⬜
Micro 15–30m · Workshop 45–90m · Core 2–4h · Advanced Certificate 4–8h · Master 10h+. Master Report §9.

### 5. Deterministic, data-authored assessment ⬜
Knowledge checks · scenarios (rubric, retryable) · midterm (≥ 70% gate) · capstone (the live-grow
practical) · mastery final (≥ 80% → Badge; retryable, forgiving). All objective items + answer keys
authored in curriculum data so grading is **pure and CI-safe** — never requires a live AI to grade (same
discipline as the existing practical checks in `services/university_service.py`). Master Report §7.

### 6. Interactive labs ⬜
A lab = a stateful interactive where the student manipulates a simulation, never a video. Five canonical
labs (Cell ID · Photosynthesis Sim · Environmental Variables · Stress Diagnosis · Virtual Grow Room).
Where physics is needed, labs **call the pure engine** (`simulation/engine.py`) in a read-only teaching
sandbox — **no new logic in the pure engine** (CLAUDE.md invariant). Master Report §8.

### 7. Professor persona extension 🔨 (CEO-approved 2026-06-14 · roster RECONCILED 2026-06-24)
Extend the shipped Professor (`ai/provider.py`, `services/lecturer_service.py`) with **named faculty
personas** — distinct personalities, teaching styles, visual identities, and a persistent narration voice
(lessons, labs, exams, office hours).
> **⚠️ Roster reconciled (2026-06-24, owner-proxy decision).** The earlier proposed names
> (Verdant/Mycelia/Atlas/Nova) are **superseded by the shipped code**, which is authoritative
> (`ai/elevenlabs_narrator.py` `_DEPT_VOICES`). The **canonical roster**:
> **Professor Flora** (Cultivation & Horticulture — also teaches the `bio-101` foundations course) ·
> **Vera Lindqvist** (Plant Genetics) · **Dr. Sage Harlow** (Soil & Nutrient Science) ·
> **Dr. Mira Okafor** (Integrated Pest Management) · **Dr. Chem Torres** (Cannabis Chemistry) ·
> **Dr. Petra Nance** (Post-Harvest & Processing). **Resolved (2026-06-25, Phase 0 build):**
> Dr. Sage Harlow now has a *distinct* voice (Charlotte, `XB0fDUnXU5powFXDhCwa`) in
> `ai/elevenlabs_narrator.py` `_DEPT_VOICES["nutrients"]` — no longer shares Rachel with Professor
> Flora. See `docs/research/university/IMMERSIVE_UNIVERSITY_MASTER_PLAN.md` §Owner-decisions and the B1/B2 docs.

All generation
(lab-instruction / quiz-feedback / certification-message) flows through the existing `LectureReport` shape
and CI-safe mock; no ABC change for the lecture path; persona lives in `curriculum.yaml`. Master Report §4.

### 8. Unified progression ⬜ (settled defaults)
One **Academic Level** driven by non-economic **KXP** (reuses the `services/leveling_service.py` curve
shape, separate track). **Forgiving streak** (1 missed day/week freeze). **Leagues default-on, purely
educational** (lessons · mastery · consistency · projects — never pay-to-win, never economy-linked).
**Very light decay** = review nudges only; records (courses, badges, degrees) are permanent. Two clocks
(knowledge vs. cultivation) stay decoupled, meeting only at the practical. Master Report §12.

### 9. Credential ladder ⬜
Badge → Certificate ✅ → Specialization → Degree ✅ → Doctorate. Issued deterministically the instant
criteria are provably met (mirrors `claim_degree`). Diploma artifact = transcript entry + certificate
view; on-chain minting is a future hook only. Master Report §6, §13.

### 10. Accessibility (ship gate) ⬜
Captions + full transcripts (the narration script *is* the transcript) · keyboard-navigable · screen-reader
semantics · contrast ≥ 4.5:1 · reduced-motion · dyslexia-friendly type · **no audio-only information**.
Master Report §10.

### 11. ElevenLabs audio pipeline ⬜ (greenfield — CEO-approved 2026-06-14 as its own slice)
Generate→review→save→cache→reuse. Audio is generated **once**, only when a lesson's script changes
(per-lesson `script_hash` trigger), and **only the changed lesson** regenerates; the runtime path is a pure
cache lookup. CI-safe via a `NarrationProvider` ABC with a mock backend (no key in CI), mirroring
`ai/factory.py`. **Manifest record required fields:** `Course ID · Lesson ID · Voice ID · Language ·
Version Number · File Path` (companions: `script_hash`, `duration_sec`, `checksum`, `status`). Approved
phase order: **A** generation · **B** persistent storage · **C** caching & versioning · **D** voice
assignments · **E** playback integration · **F** accessibility/transcript-sync. Locked requirements:
generate once · cache permanently · regenerate only on content change · versioned · transcript parity ·
reusable across courses. Master Report §15.

### 12. Capstones & the dissertation ⬜
Per-degree capstones proven in the live sim (extend the existing practical hooks). The **Doctorate
dissertation** ties the apex credential to generative genetics — stabilize an original line / win a Cup
(`services/cup_service.py`, `02-genetics.md`): the highest honor is earned, never bought. Master Report §13.

## The canonical exemplar (the template) ⬜ (CEO-approved 2026-06-14)
**"Foundations of Plant Biology"** (key **`bio-101`**, Core, 4.0 h, faculty **Professor Flora**) is the
**required no-prerequisite introductory course** (path `bio-101 → cult-101 → Intermediate → Advanced →
Capstone`), authored end-to-end in Master Report §17 — orientation, 4 modules, 5 labs, midterm, capstone,
mastery exam, certification, full narration scripts, rubrics, and a 240-min component budget. Every future
course is cloned from it. Build the framework + this one course first, prove the honest-hour rule, then
scale. **CEO-approved implementation order:** Framework → `bio-101` → Professor System → ElevenLabs →
Labs → Assessments → Certifications → Transcripts → Advanced Courses → Degree Programs.

## Invariants honored
- **Earned, never bought** — KXP/streaks/leagues are non-economic; the credential gate stays time + live-
  grow practical (+ deterministic exams).
- **CI-safe AI/audio** — mock backends, no live key in CI (Professor today; narration by design).
- **Pure server-authoritative sim** — labs *call* `simulation/engine.py` in teaching mode; no player-economy
  logic in the engine.
- **DB authoritative · deterministic grading · degree perks reuse the research effect-keys** (no parallel
  apply path).

## Where it's going (future hooks) ⬜
3 planned departments (Lab/QA · Business/Compliance · Pharmacology) · localization via the manifest
`Language` field · faculty roster + Professor reputation (`03-grower-skills.md`) · on-chain Diploma NFTs
(Sprint 4) · adaptive knowledge-graph routing. Master Report §14.

## Cross-links
- Master Report (full blueprint + authored exemplar): `docs/research/UNI-001-v2-Master-Report.md`
- Phase 1 engagement architecture: `docs/research/2026-06-14-growpod-university-curriculum-architecture.md`
- Shipped university: `docs/memory/design/06-university.md` · curriculum grounding:
  `docs/research/2026-06-08-cannabis-education-curriculum.md`
- Code: `services/university_service.py` · `services/lecturer_service.py` · `data/curriculum.yaml` ·
  `ai/provider.py` · `simulation/engine.py` · `web/src/app/university/`
