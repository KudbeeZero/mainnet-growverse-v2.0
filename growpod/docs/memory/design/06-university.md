# 🎓 GrowPod University — degrees, classes, and the AI Professor

> The deep design for the learning environment: players take classes, study over **real time**,
> complete **practicals tied to real gameplay**, and earn **degrees** that grant permanent perks + a
> prestige title. An AI "Professor" delivers real-looking lectures. This is the **earned-mastery**
> half of the moat (`00-game-vision.md` §The Moat #6; the use-based companion to the GROW-spend
> research tree in `03-grower-skills.md`). Tags: ✅ built · 🔨 partial · ⬜ planned. Curriculum is
> grounded in real cannabis higher-ed (`docs/research/2026-06-08-cannabis-education-curriculum.md`).

## Why a university
The research tree buys upgrades with money; the university makes you **earn knowledge over time**.
Courses take real study hours and demand you *prove it in your grow* (a practical), so a degree is a
genuine investment — exactly the "serious players, growing doesn't happen overnight" ethos. It also
turns the strain knowledge base + agronomy research into *teachable* content.

## How it works today ✅
Shipped backend (`services/university_service.py`, `data/curriculum.yaml`, `api/game_api.py`):
- **Curriculum data** — 6 departments, ~14 courses (real names + prereq chains from NMU, CSU-Pueblo,
  Cornell, Penn State PLANT 240, Oaksterdam), and 5 degree tiers (Certificate → Associate → Bachelor
  → Master). Each course: credits, `duration_hours`, `tuition`, `prereqs`, `level_req`, a `lecture`,
  a `practical`, and `perks`.
- **Enroll → study → complete.** Enroll pays **tuition** (a GROW *sink*, `LedgerEntryType.TUITION`)
  and starts the study clock. Completion requires **both** (a) `duration_hours` of study time
  elapsed (injected `Clock`, testable with `FrozenClock`) **and** (b) the **practical met** — checked
  against live game state: `harvest_count` · `harvest_quality` · `breed` · `stabilize` · `cure` ·
  `cup_entry` · `research` · `level`.
- **Degrees → lifetime unlocks.** `claim_degree` (idempotent via the `degree_progress` unique
  constraint) grants **permanent perks** + a permanent `Player.university_title` + XP.
- **Perks are real.** `degree_effects()` aggregates earned-degree perks over the **same effect keys**
  as `research_effects()`; the service-layer `_research()` helpers now **sum research + degree
  effects**, so every apply-site (harvest yield/quality, terpene, care/breeding/seed discounts) picks
  up degrees automatically — no parallel apply path.
- **Economy:** tuition is a sink; degrees pay perks/XP, **not GROW** → the university is
  **net-deflationary** (honors the faucet/sink invariant).

## The AI Professor ✅
A lecturer mirrors the advisor stack (CI-safe): `LecturerProvider` ABC + `LectureReport`
(`ai/provider.py`), a deterministic `MockLecturerProvider` (CI/no-key, `ai/lecturer_mock.py`), a real
`ClaudeLecturerProvider` (`ai/lecturer_claude.py`, structured outputs, professor system prompt
grounded in real horticultural science), the factory (`get_lecturer_provider`/`shared_lecturer`),
and `services/lecturer_service.py` (`teach(player, course, level, plant_id?)`). `GET
.../courses/<key>/lecture` returns a real-looking lecture — deterministic under the mock, free-form
Claude in prod. No live key ever needed in CI.

## API ✅
Public: `GET /university/catalog`. Authed: `GET /players/<id>/university` (transcript), `POST
.../courses/<key>/enroll`, `POST .../courses/<key>/complete`, `POST /players/<id>/degrees/<key>/claim`,
`GET .../courses/<key>/lecture?level=`.

## Where it's going ⬜
- **More departments** (Lab Analytics & QA, Business/Law/Compliance, Pharmacology/Medical) and a
  **Doctorate** capstone tier.
- **Knowledge quizzes** (authored in curriculum data, deterministically graded) on top of the practical.
- **Diploma NFTs** — mint a degree as an on-chain credential (Proof-of-Cultivation kin; Sprint 4).
- **Professor persona depth** — named faculty, course-specific voices; lectures that cite the
  strain KB + the research reference.
- **Reputation tie-in** — degrees + Cup standing feed a grower-reputation/knowledge economy
  (`03-grower-skills.md`).

## Invariants honored
- **CI-safe AI** (mock when no key); **DB authoritative**; **deterministic** practical checks +
  time gate; degree perks reuse the research `_EFFECT_KEYS`; tuition is a sink with **no GROW faucet**.

## Cross-links
- The spend-based companion: `03-grower-skills.md` (research tree) · the genetics/agronomy taught:
  `01-simulation-horticulture.md`, `02-genetics.md` · curriculum grounding (academic/theory):
  `docs/research/2026-06-08-cannabis-education-curriculum.md` · practical master-grower pedagogy
  (habits/drills/diagnosis): `docs/research/2026-06-14-master-grower-methods.md` · canonical
  consolidation of both tracks: `docs/research/university/GROWPOD_UNIVERSITY_MASTER_BIBLE.md`.
