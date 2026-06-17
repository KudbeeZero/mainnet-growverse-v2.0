# GrowPod University — Phase 2 Master Report (UNI-001 v2)

> **Directive UNI-001 v2 · "The Long-Form Academy"** · Lead Agent **UNI-A00** · Records **UNI-A10**
> **Research & architecture only — NO code, NO PR, NO implementation, NO monetization, NO tokenomics.**
> This is the **Master Bible**: the executive blueprint that turns GrowPod University from a catalog of
> degrees into a genuine, Coursera-depth **academy** — where a "4-hour course" contains ~4 hours of
> real, *interactive* educational content, narrated audio, virtual labs, real assessments, and one
> fully-authored canonical course that every future course is cloned from.
>
> **What came before.** Phase 1 (`docs/research/2026-06-14-growpod-university-curriculum-architecture.md`,
> UNI-001 v1) designed the **engagement layer** — the lesson loop, XP/streak/league systems, the
> certification ladder, daily habits. Phase 2 goes one level deeper: the **content layer** — the actual
> long-form coursework, the Professor delivery system, the audio pipeline, the labs, the exams, and the
> wireframes that present them. v1 is the *retention engine*; v2 is the *curriculum that engine serves*.
>
> **Grounding.** Real cannabis higher-ed (`docs/research/2026-06-08-cannabis-education-curriculum.md`),
> the scientist-grade strain KB (`data/strain_knowledge.yaml`, `docs/research/2026-06-08-cannabis-strain-genetics-and-cultivation.md`),
> and the already-shipped university (`docs/memory/design/06-university.md`). Capability tags
> throughout: ✅ built · 🔨 partial · ⬜ planned.

---

## 0. The thesis, the scope line, and what already exists

### 0.1 The one-sentence thesis
**A GrowPod course should be indistinguishable in depth and craft from a paid online university course —
real lectures, real labs, real exams, real narration — while every hour of it is *earned over real time*
and *proven in the player's actual grow*, never bought.**

This is the **earned-mastery moat** (`CLAUDE.md` → moat #6; `00-game-vision.md` §The Moat). Phase 2
must not weaken it: more content depth, but the same gate — **time studied + a practical proven in the
live sim**. Knowledge is earned, never purchased; that is the line monetization would cross, and it is
**out of scope by directive**.

### 0.2 Scope guardrails (hard, non-negotiable)
- **No code, no schema, no migration, no API, no web components, no PR.** The deliverable is this
  document plus the registered Codex spec (`docs/memory/design/07-university-phase-2.md`).
- **No monetization, no tokenomics, no on-chain diploma build.** Engagement currencies (KXP, streaks,
  league points) stay **non-economic** — they never touch the GROW ledger, honoring the faucet/sink
  invariant (`CLAUDE.md`). The Diploma-NFT idea is acknowledged as a *future* hook only (§14).
- **Reuse, don't rebuild.** Everything below extends existing systems; §0.3 is the inventory it builds on.
- **The 10 agents are organizing lenses, not literal sub-agents.** This report was authored directly;
  the ten roles (Dean, Curriculum, Pedagogy, Professor/Voice, Labs/Sim, Assessment, Audio, Accessibility,
  UX/Wireframe, Records) name the *specialist viewpoints* each section is written through (§16 maps them).

### 0.3 What already ships (the foundation — do not redesign)

| System | State | Anchor in code |
|--------|-------|----------------|
| Curriculum data — 6 depts · **14 courses** · 5 degrees · practical types | ✅ | `data/curriculum.yaml` |
| Enroll → study-clock → complete (time gate + practical) · claim-degree (idempotent) · transcript · catalog | ✅ | `services/university_service.py` |
| Degree perks reuse the research effect-keys (no parallel apply path) | ✅ | `services/university_service.py` (`degree_effects()`) |
| AI **Professor**: `LecturerProvider` ABC + `LectureReport{title,summary,content,key_takeaways,quiz_question}` | ✅ | `ai/provider.py` |
| Professor backends: deterministic mock (CI) + real Claude (prod), factory | ✅ | `ai/lecturer_mock.py` · `ai/lecturer_claude.py` · `ai/factory.py` |
| Lecture service: `teach(player_id, course_key, level, plant_id?)` | ✅ | `services/lecturer_service.py` |
| University API (catalog/transcript/enroll/complete/claim/lecture) | ✅ | `api/game_api.py` (`/university/*`) |
| Models `CourseEnrollment` / `DegreeProgress` | ✅ | `db/models.py` |
| University web UI (catalog · transcript · course detail + lecture reader) | ✅ | `web/src/app/university/` |
| Component library (Card, Button, Badge, ProgressRing, Gauge, Bar, Tabs, Modal, States, …) | ✅ | `web/src/components/ui/` |
| Leveling / XP curve + `Player.xp/level/university_title` | ✅ | `services/leveling_service.py` · `db/models.py` |
| **Audio / ElevenLabs narration pipeline** | ⬜ **none exists** | greenfield — designed in §15 |
| Interactive labs / simulations-as-lessons | ⬜ none exists | designed in §8 |
| Authored long-form lesson content, slides, narration scripts | ⬜ none exists | exemplar in §17 |
| Exams beyond the single practical + optional quiz | ⬜ none exists | designed in §7 |

**The shape of the gap:** GrowPod has the *content half* (real course names, objectives, prereqs,
degrees) and a *Professor that can generate a lecture on demand*. It does **not** have the long-form
*lesson body* — the modules, the narrated interactive walk-throughs, the labs, the staged exams, the
audio. Phase 2 designs exactly that, and authors one course end-to-end as the template.

---

## 1. DELIVERABLE — Curriculum Map (the full academy)

### 1.1 Nine departments (6 shipped + 3 on the roadmap)
The 6 live departments (`data/curriculum.yaml`) plus the 3 the design doc already names as planned
(`06-university.md` §Where it's going):

| # | Department | State | Spine question it answers |
|---|-----------|-------|---------------------------|
| 1 | Cultivation & Horticulture | ✅ `cultivation` | *How do I grow a healthy plant on purpose?* |
| 2 | Plant Genetics & Breeding | ✅ `genetics` | *How is the next generation better than this one?* |
| 3 | Soil & Nutrient Science | ✅ `nutrients` | *What does the plant eat, and how do I not poison it?* |
| 4 | Integrated Pest Management | ✅ `ipm` | *How do I keep it alive against pests & disease?* |
| 5 | Cannabis Chemistry | ✅ `chemistry` | *What is the plant actually making, and how is it measured?* |
| 6 | Post-Harvest & Processing | ✅ `postharvest` | *How do I not ruin it in the last 20%?* |
| 7 | Lab Analytics & Quality Assurance | ⬜ planned | *How do I prove what I made is what I say?* |
| 8 | Business, Law & Compliance | ⬜ planned | *How does this become a real operation?* |
| 9 | Pharmacology & Medical | ⬜ planned | *How does it act on the body, responsibly?* |

> **Foundations note (CEO-approved 2026-06-14).** Phase 2 adds one cross-department **foundational
> course** at the very front of the map — **"Foundations of Plant Biology"**, key **`bio-101`** (the
> exemplar, §17). It has **no prerequisites** and is a **required introductory course** feeding every
> spine; it is the "how a plant works at all" course the current catalog assumes but never teaches.
> Approved path: **`bio-101` → `cult-101` → Intermediate → Advanced → Capstone**.

### 1.2 The three tracks (difficulty bands, already implicit in `level_req`)
The catalog's `level_req` (1→7) already encodes a difficulty gradient; Phase 2 names the bands so the UI
and the recommended-next engine (v1 §4.4) can group them:

- **Beginner / Foundations** (`level_req` 1–2): Foundations of Plant Biology, `cult-101`, `gen-101`,
  `nut-101`, `ipm-101`, `ph-101`. Goal: literacy + first successful grow.
- **Intermediate / Practitioner** (`level_req` 3–5): `cult-201`, `gen-201`, `nut-201`, `ipm-201`,
  `chem-101`, `ph-201`. Goal: control the variables, breed on purpose.
- **Advanced / Specialist** (`level_req` 6–7): `cult-301`, `gen-301`, `chem-201`, + the planned
  doctorate-track seminars. Goal: master a domain; original work.

### 1.3 The fifteen course **types** (the content-shape catalog)
Every course is built from a fixed menu of *course types*, so authoring is a matter of choosing a type
and filling the template (§3). This is what makes the academy scalable — and what the §17 exemplar
proves out.

| Type | Length band (§9) | Primary use |
|------|------------------|-------------|
| 1. Foundational Core | Core (2–4h) | The bedrock course of a department |
| 2. Applied Practicum | Core (2–4h) | Skill drilled against the live sim |
| 3. Diagnostic Clinic | Workshop (45–90m) | "What's wrong with this plant?" labs |
| 4. Technique Workshop | Workshop (45–90m) | One method, hands-on (e.g. topping, low-stress training) |
| 5. Science Seminar | Core (2–4h) | Theory-forward (chemistry, genetics) |
| 6. Lab-Analytics Course | Adv Cert (4–8h) | Reading a COA, GC/LC interpretation |
| 7. Field Studies | Core (2–4h) | Strain-KB-grounded case studies |
| 8. Breeding Studio | Adv Cert (4–8h) | Multi-generation selection projects |
| 9. Master Seminar | Adv Cert (4–8h) | Capstone-track, peer-grade |
| 10. Micro-Lesson | Micro (15–30m) | Single concept / review refresher |
| 11. Compliance Module | Workshop (45–90m) | Rules, safety, documentation |
| 12. Business Case | Core (2–4h) | Operations, planning, economics-of-the-grow (in-game only) |
| 13. Pharmacology Survey | Core (2–4h) | Effects, dosing literacy, harm-reduction |
| 14. Capstone Project | Master (10h+) | The degree-gating original work (§13) |
| 15. Doctoral Dissertation | Master (10h+) | Generative-genetics original line (§13) |

---

## 2. DELIVERABLE — Degree Programs

### 2.1 The credential spine (existing + the Doctorate extension)
The 5 shipped degrees (`data/curriculum.yaml` → `degrees:`) plus the planned Doctorate, with their
title rewards (`Player.university_title`):

| Tier | Degree | Title | State | Required (existing keys) |
|------|--------|-------|-------|--------------------------|
| Certificate | Cannabis Cultivation Certificate | *Certified Grower* | ✅ | `cult-101, nut-101, ipm-101` |
| Associate | Associate of Applied Cannabis Science | *Associate Cannabis Scientist* | ✅ | `cult-201, gen-101, nut-101, ph-101` |
| Bachelor | B.S. Cannabis Horticulture | *Cannabis Horticulturist* | ✅ | `cult-301, nut-201, ipm-201, ph-201` |
| Bachelor | B.S. Plant Genetics & Chemistry | *Cannabis Geneticist* | ✅ | `gen-301, chem-201` |
| Master | M.S. — Master Grower | *Master Grower* | ✅ | `cult-301, gen-301, nut-201, ipm-201, chem-201, ph-201` |
| **Doctorate** | **Ph.D. — Doctor of Cannabis Science** | *Doctor of Cultivation* | ⬜ | Master + a **Doctoral Dissertation** capstone (§13) |

### 2.2 How Phase-2 long-form courses map onto degree gates
The degree machinery does **not change**: a degree still completes when its `required_courses` are all
complete (`services/university_service.py`). Phase 2 only makes *each course* deeper. The mapping rule:

- A **long-form course** is still one `course_key`. Its modules/labs/exam are *internal* to "complete."
- "Complete" tightens (§7): today = time gate + practical; Phase 2 adds **pass the Mastery Exam** as a
  third, deterministic gate — authored in curriculum data, so it stays CI-safe and data-driven.
- **No new degree perks invented here.** Perks remain the shared research effect-keys
  (`degree_effects()` ↔ `research_effects()`). Phase 2 is content depth, not power creep.

---

## 3. DELIVERABLE — The Interactive Course Framework

### 3.1 The canonical course flow (the skeleton every course clones)
This is the gold-standard sequence. Each box is a *component* with an authored body, a duration budget
(§9), and accessibility requirements (§10). The §17 exemplar instantiates every box.

```
COURSE
 ├─ Orientation
 │   ├─ Professor Introduction (narrated welcome, who's teaching, why it matters)
 │   ├─ Course Roadmap / Syllabus (modules, objectives, what you'll prove in the grow)
 │   └─ Pre-Assessment (ungraded: "what do you already know?")
 ├─ MODULE × N   (each module = one mastery unit, Khan-style)
 │   ├─ Video Lesson            (motion explainer; captioned)
 │   ├─ Narrated Interactive Lesson  (Professor audio + on-screen interactive content)
 │   ├─ Interactive Diagram / Sim Activity  (manipulate, don't watch)
 │   ├─ Knowledge Checks         (inline, low-stakes, instant feedback)
 │   └─ Scenario Exercise        (apply the concept to a grow situation)
 ├─ Midterm Exam   (after the content half — gates the back half)
 ├─ MODULE × N  (continued)
 ├─ Capstone Assignment   (applied, in the live sim — the "prove it" project)
 ├─ Mastery Exam (Final)  (comprehensive, deterministic pass criteria)
 └─ Certification         (badge/cert issued; degree progress advances; narrated congratulations)
```

### 3.2 The eleven interactivity primitives ("active participation, not slides")
Every lesson must use **at least two**. This is the rule that prevents "4 hours" from becoming "4 hours
of clicking Next." Each primitive is a reusable UI pattern (built later on `web/src/components/ui/`):

1. **Clickable diagram** — hotspots on an anatomy/process figure reveal explanations.
2. **Parameter sim** — sliders (light, temp, VPD, pH) drive a live readout; learn by steering.
3. **Diagnosis lab** — presented a sick plant; identify cause from symptoms.
4. **Environment-tuning challenge** — hit a target (e.g. ideal VPD) by adjusting inputs.
5. **Decision tree** — branching "what would you do?" with consequence feedback.
6. **Drag-and-drop / sorting** — classify (nutrient → deficiency sign; pest → control).
7. **Virtual lab** — a guided procedure (microscope, titration-style) with steps.
8. **Before/after slider** — reveal an intervention's effect on the plant.
9. **Guided experiment** — change one variable, predict, observe, reflect.
10. **Reflection checkpoint** — short free-text or self-rating; metacognition.
11. **Knowledge check** — MCQ/true-false/numeric with instant, explained feedback.

### 3.3 The "honest hour" rule
A course's advertised `duration_hours` must equal the **summed authored duration of its components**
(§9.2). No padding, no idle timers. The §17 exemplar's component budget sums to exactly 240 minutes =
4.0 h — that summation *is* the acceptance test for "no fake durations."

---

## 4. DELIVERABLE — The Professor System

### 4.1 Extend, don't rebuild
The Professor already exists end-to-end (`ai/provider.py` `LecturerProvider`/`LectureReport`,
`ai/lecturer_mock.py`, `ai/lecturer_claude.py`, `services/lecturer_service.py` `teach()`). Phase 2 adds
**persona, scope, and new generation surfaces** *on top of* this stack — the ABC and the CI-safe
mock/real split stay exactly as they are.

### 4.2 Named faculty (persona layer ⬜)
Today the Professor is anonymous. Phase 2 introduces a small **faculty roster** — each a system-prompt
persona keyed to a department, so lectures have a voice and a point of view. **CEO-approved (2026-06-14):**
memorable, on-brand, named personas with distinct personalities, teaching styles, recognizable visual
identities, and a persistent narration voice (used in lessons, labs, exams, and office hours). The
approved naming scheme (names may evolve during implementation; the *persona system* is locked):

| Faculty | Domain | Voice / stance |
|---------|--------|----------------|
| **Professor Flora** | Plant Biology (Foundations) | Patient first-principles teacher; "let's start with the cell." → **teaches the `bio-101` exemplar.** |
| **Professor Verdant** | Environmental Systems | Calm systems-thinker; VPD/DLI, the canopy as a climate. |
| **Professor Mycelia** | Microbiology & Soil Ecology | Curious, soil-food-web evangelist; life beneath the roots. |
| **Professor Atlas** | Commercial Cultivation | Pragmatic operator; scale, yield, action thresholds, "what survives a real grow." |
| **Professor Nova** | Genetics & Breeding | Rigorous, Punnett-square precise, loves a selection scheme. |

Additional faculty are named per department as content is authored (Chemistry/Lab Analytics,
Post-Harvest, IPM, Business/Compliance, Pharmacology) following the same persona discipline.

Implementation note (design only): a persona is just an extra field in the context dict
`LecturerService` already builds (`services/lecturer_service.py` builds course/topic/objectives/level);
the real provider folds it into the existing professor system prompt. **No schema change required** for
the lecture path — persona can live in `curriculum.yaml` per course/department.

### 4.3 Four generation surfaces (all through the existing `LectureReport` shape where possible)
1. **Lecture** ✅ — `teach()` already returns `LectureReport`. Reused verbatim for the narrated lesson body.
2. **Lab instruction** ⬜ — short procedural narration for a lab step. Fits `LectureReport.content` with a
   `summary` per step; no new model needed.
3. **Quiz/assessment feedback** ⬜ — "here's why that answer was wrong." Deterministic-authored in
   curriculum data for CI; the Professor persona can *optionally* enrich it in prod (mock returns the
   authored string — CI never needs a key).
4. **Certification message** ⬜ — narrated congratulations naming the credential earned. Authored
   template + persona enrichment.

### 4.4 Grounding (unchanged invariant)
All Professor output stays grounded in the **strain KB** (`data/strain_knowledge.yaml`), the curriculum
objectives, and the agronomy research reference — exactly as `ai/lecturer_claude.py` already does. The
mock stays deterministic so the suite is reproducible.

---

## 5. DELIVERABLE — The Student Transcript System

### 5.1 One university, one identity (the unified Academic Level — settled)
Per the Phase-2 directive: **one unified Academic Level**, one transcript, one student identity. There is
no separate per-department level. The transcript (`services/university_service.py` `transcript()` already
exists ✅) is extended to render a full academic record:

| Section | Source | State |
|---------|--------|-------|
| **Academic Level** + KXP progress | new KXP track (§12) overlaid on `leveling_service` curve shape | ⬜ |
| **Title** (prestige) | `Player.university_title` | ✅ |
| **Enrolled / completed courses** + per-course mastery % | `CourseEnrollment` | ✅ (mastery % ⬜) |
| **Degrees earned** | `DegreeProgress` | ✅ |
| **Certifications & badges** (the ladder, §6) | new credential records | ⬜ |
| **Specializations** (department mastery) | derived from completed courses per dept | ⬜ |
| **GPA / mastery record** | derived from exam scores (§7) | ⬜ |
| **Achievements** | v1 §6 reward taxonomy | ⬜ |
| **Professor reputation** | v1 §8.5 open question; light, derived | ⬜ |

### 5.2 Two clocks stay decoupled
Knowledge progress (study minutes, KXP) and cultivation progress (grow-days, harvests) are **separate
timelines** (v1 §4.3). The transcript shows academic time; the grow shows cultivation time. A course's
practical is the bridge — the only place the two clocks touch.

---

## 6. DELIVERABLE — The Certification System

### 6.1 The five-rung credential ladder
Beneath the existing degrees, Phase 2 formalizes a granular ladder so progress is visible *between*
degrees (v1 §5.3 "why a ladder"):

```
Badge  →  Certificate  →  Specialization  →  Degree  →  Doctorate
(1 course  (a dept track   (full dept       (existing   (original
 milestone) of courses)     mastery)         degrees ✅)  work, §13)
```

| Rung | Earned by | Example | State |
|------|-----------|---------|-------|
| **Badge** | finishing one course (pass Mastery Exam) | "Plant Biology Foundations" | ⬜ |
| **Certificate** | a named set of courses | *Certified Grower* (`cert-cultivation`) | ✅ |
| **Specialization** | all courses in a department | "Genetics Specialist" | ⬜ |
| **Degree** | `required_courses` complete (+ exams) | B.S. Cannabis Horticulture | ✅ |
| **Doctorate** | Master + dissertation capstone | *Doctor of Cultivation* | ⬜ |

### 6.2 The diploma artifact
Each credential issues a **diploma artifact** — a transcript entry + a shareable certificate view in the
UI (§11 credential wall). **On-chain Diploma NFTs are explicitly a future hook (§14), not built here** —
no chain, no settlement, no token in Phase 2 (directive).

### 6.3 Issuance is deterministic
A credential is granted the instant its criteria are *provably* met (courses complete + exams passed),
mirroring `claim_degree`'s idempotent grant. No randomness, no time-of-day effects — CI-safe.

---

## 7. DELIVERABLE — Assessments & Exams

### 7.1 The assessment ladder (low-stakes → high-stakes)
| Instrument | Stakes | When | Grading | State |
|------------|--------|------|---------|-------|
| **Knowledge check** | none (formative) | inline in every module | instant, explained | ⬜ |
| **Scenario exercise** | low | end of module | rubric-scored, retryable | ⬜ |
| **Midterm exam** | medium | after content half | deterministic, pass ≥ threshold | ⬜ |
| **Capstone assignment** | high | before final | **proven in the live sim** (the practical, §13) | 🔨 (practical ✅) |
| **Mastery (final) exam** | high | course end | deterministic, comprehensive | ⬜ |

### 7.2 Deterministic, data-authored grading (the CI-safety requirement)
All objective items (MCQ, true/false, numeric-with-tolerance, ordering, matching) are **authored in
curriculum data with their answer keys**, so grading is pure and reproducible — the same invariant the
practical checks already satisfy (`services/university_service.py` checks practicals deterministically).
No live AI is ever required to grade; the Professor persona may *enrich feedback* in prod, but the
**mock returns the authored explanation**, so the test suite stays green with no key.

### 7.3 Passing criteria & mastery thresholds (defaults — tunable in `balance.yaml`)
- **Knowledge checks:** no gate; used for the spaced-repetition queue (v1 §7.3) and mastery signal.
- **Scenario exercises:** ≥ 70% to count toward module mastery; unlimited retries.
- **Midterm:** ≥ 70% to unlock the back half of the course.
- **Mastery (final) exam:** ≥ 80% to earn the course Badge and advance degree progress; retryable after a
  short cooldown (no hard fail — earned-mastery means *eventually you master it*, forgiving by design).
- **Capstone:** binary — the practical is met in the live grow or it isn't (existing mechanic).

### 7.4 Rubrics (authored per scenario/capstone)
Scenario and capstone rubrics are authored as weighted criteria (e.g. "correct diagnosis 40% · correct
intervention 40% · justification 20%"). They live in curriculum data and render in the UI as a checklist;
objective sub-items grade automatically, justification is self-assessed against the model answer
(metacognition, v1 §1.4). The §17 exemplar ships full rubrics for its midterm, capstone, and final.

---

## 8. DELIVERABLE — Interactive Laboratories

### 8.1 The lab framework
A **lab** is a guided, stateful interactive where the student **makes decisions / manipulates a
simulation** and is evaluated on the outcome — never a video. Each lab has: a goal, a starting state, the
controls exposed, a success condition, scaffolded hints (Professor lab-instruction narration, §4.3), and
a rubric. Labs render on `web/src/components/ui/` primitives (Gauge, Bar, Modal, Tabs) + a lab shell
(§11). Where a lab needs plant physics, it should **reuse the real simulation** (`simulation/engine.py`,
`simulation/horticulture.py`) in a sandboxed, read-only "teaching mode" — the engine is pure and
server-authoritative, so a lab can drive it with synthetic inputs without touching player state. **No new
sim logic is invented in the pure engine** (CLAUDE.md invariant) — labs *call* it.

### 8.2 The five canonical labs (specced; built later)
| # | Lab | Primitive(s) | What the student does | Success condition |
|---|-----|-------------|-----------------------|-------------------|
| 1 | **Cell ID — Virtual Microscope** | clickable diagram + drag-drop | Identify cell structures & tissue types on micrographs | ≥ 8/10 structures correctly labeled |
| 2 | **Photosynthesis Simulator** | parameter sim + guided experiment | Adjust light/CO₂/temp; observe assimilation rate; find the light-saturation point | Identify saturation point ± tolerance |
| 3 | **Environmental Variables Lab** | environment-tuning + before/after | Steer VPD/DLI to a target for a growth stage (drives the real engine in teaching mode) | Hold target VPD band for the window |
| 4 | **Stress Diagnosis Clinic** | diagnosis lab + decision tree | Diagnose a sick plant from symptoms; choose the intervention | Correct cause **and** correct first action |
| 5 | **Virtual Grow Room (Capstone)** | full sim sandbox | Run a compressed grow: make care decisions, hit a quality target | Harvest ≥ target quality in the sandbox |

### 8.3 Labs vs. the live grow
Labs are **teaching sandboxes** (synthetic, resettable, zero economy impact). The **capstone practical**
is proven in the *real* grow (the existing mechanic). This keeps the moat intact: you can *practice* in a
lab, but the credential still demands you did it for real.

---

## 9. DELIVERABLE — Course Duration Standards

### 9.1 The five length bands
| Band | Length | Typical type | Modules |
|------|--------|-------------|---------|
| **Micro** | 15–30 min | review / single concept | 1 |
| **Workshop** | 45–90 min | one technique / clinic | 1–2 |
| **Core** | 2–4 h | foundational / applied | 3–5 |
| **Advanced Certificate** | 4–8 h | lab-analytics / breeding studio | 5–8 |
| **Master** | 10 h+ | capstone / dissertation | project-scoped |

### 9.2 The honest time-accounting method
Advertised duration = **Σ(component durations)**. Each component carries an authored, defensible minute
budget. This is enforced conceptually by the §3.3 "honest hour" rule and demonstrated by the §17 exemplar
(component table sums to 240 min). Authoring guidance per component:

| Component | Typical budget |
|-----------|----------------|
| Video lesson | 5–10 min |
| Narrated interactive lesson | 8–14 min |
| Interactive lab | 12–20 min |
| Interactive diagram / sim activity | 5–8 min |
| Knowledge checks (set) | 4–6 min |
| Scenario exercise | 4–8 min |
| Midterm exam | 12–18 min |
| Capstone (applied) | 10–15 min in-app (plus real grow time) |
| Mastery final exam | 8–15 min |

### 9.3 Note on the existing `duration_hours`
The catalog's current `duration_hours` (e.g. `cult-101: 48`) is the **study-clock gate** (real elapsed
time before "complete" is allowed), *not* the active-content length — a different axis. Phase 2 keeps the
study-clock gate **and** adds the active-content budget above; the UI must show both honestly ("~4 h of
content · unlocks after 48 h of study time"). This distinction is a key honesty point for the owner.

---

## 10. DELIVERABLE — Accessibility Standards

Every course must meet these (WCAG 2.1 AA-aligned) before it ships. No audio-only information — ever.

- **Captions + full transcript** for all narration and video (the ElevenLabs script *is* the transcript,
  §15 — generated together, never separately).
- **Keyboard navigable** end-to-end (every interactive primitive operable without a mouse).
- **Screen-reader semantics** — labeled controls, ARIA roles on diagrams/labs, meaningful alt text on
  every figure.
- **Color-contrast ≥ 4.5:1**; never encode meaning in color alone (pair with icon/label).
- **Reduced-motion** mode honored (respect `prefers-reduced-motion`; the Constellation/RAF patterns in
  `web/src/components/viz/` already model this discipline).
- **Dyslexia-friendly typography** option; adjustable text size; generous line height.
- **No audio-only information** — anything spoken is also on screen (transcript/caption); anything shown is
  also described.
- **Adjustable pacing** — pause/replay narration; no forced timers on comprehension.

---

## 11. DELIVERABLE — Desktop Wireframes

Desktop-first (the web client is the primary surface). All built later on the existing component library
(`web/src/components/ui/`). ASCII sketches below; each names the components it composes.

### 11.1 Campus Dashboard (`/university`)
```
┌──────────────────────────────────────────────────────────────────────┐
│ PageHeader: "GrowPod University"      [Academic Lvl 7 ▸ KXP ▰▰▰▱▱]  🔥12│
├───────────────┬──────────────────────────────────────────────────────┤
│  DEPARTMENTS  │  CONTINUE LEARNING                                     │
│  • Foundations│  ┌── Card: Foundations of Plant Biology ───────────┐  │
│  • Cultivation│  │ ProgressRing 62%   Module 3 of 4   ▶ Resume      │  │
│  • Genetics   │  └──────────────────────────────────────────────────┘ │
│  • Nutrients  │  TODAY AT GROWPOD (daily quests · v1 §7.2)             │
│  • IPM        │  [ ] 1 lesson  [ ] 5 reviews  [ ] hit your streak     │
│  • Chemistry  │  RECOMMENDED NEXT (anti-paralysis · v1 §4.4)          │
│  • Post-Harv. │  Card · Card · Card                                    │
│  + 3 planned  │  LEAGUE (this week)   Stat: #4 of 30  ProgressRing    │
└───────────────┴──────────────────────────────────────────────────────┘
```
Components: `PageHeader`, `Card`, `ProgressRing`, `Pills` (departments), `Bar`/`Stat` (KXP, league),
`Badge` (streak), `Tabs`.

### 11.2 Course Landing / Orientation (`/university/courses/[key]`)
```
┌──────────────────────────────────────────────────────────────────────┐
│ PageHeader: "Foundations of Plant Biology"   Badge: Core · ~4 h        │
│ Faculty: Professor Flora          [▶ Start / Resume]                │
├──────────────────────────────────────────────────────────────────────┤
│ Tabs: [Syllabus] [Modules] [Labs] [Exams] [Reviews]                    │
│ SYLLABUS                                                               │
│   "~4 h of content · unlocks completion after 48 h study time"         │
│   Objectives ▸  Competencies ▸  What you'll prove in the grow ▸        │
│ MODULES (mastery rings)                                                │
│   ◉ 1 Cells & Tissues  ◉ 2 Photosynthesis  ◑ 3 Water  ○ 4 Response    │
│   ▸ Midterm (locked until M2)   ▸ Capstone   ▸ Mastery Exam            │
└──────────────────────────────────────────────────────────────────────┘
```
Components: `PageHeader`, `Tabs`, `Card`, `ProgressRing` (per-module mastery), `Badge`, `Button`,
`States` (locked/loading).

### 11.3 Lesson Player (the core screen)
```
┌──────────────────────────────────────────────────────────────────────┐
│ ◀ Module 2 · Lesson 2 of 5            Mastery ▰▰▰▱▱   ✕ Exit           │
├────────────────────────────────────────┬─────────────────────────────┤
│  STAGE (video / interactive / diagram)  │  TRANSCRIPT (scrolls w/ audio)│
│  ┌────────────────────────────────────┐ │  Professor Flora:               │
│  │  [clickable chloroplast diagram]   │ │  "Light hits the thylakoid…"  │
│  │   ● hotspot  ● hotspot             │ │  ▸ highlighted current line   │
│  └────────────────────────────────────┘ │                               │
│  ▶ ❚❚  ▭▭▭▭▭▭▭▭▭▭ 04:12 / 12:00  1.0× ⊂⊃│  [Aa] text size  [CC] captions│
├────────────────────────────────────────┴─────────────────────────────┤
│  ◀ Prev        ● ● ◑ ○ ○ (lesson dots)             Continue ▶          │
└──────────────────────────────────────────────────────────────────────┘
```
Components: audio player (new, narration §15), `Tabs`, transcript pane, `Bar` (scrubber/mastery),
`Button`. Accessibility (§10): transcript always present, captions toggle, speed/size controls.

### 11.4 Interactive Lab Shell
```
┌──────────────────────────────────────────────────────────────────────┐
│ Lab 2 · Photosynthesis Simulator        Goal: find light saturation    │
├──────────────────────────┬───────────────────────────────────────────┤
│  SIM CANVAS               │  CONTROLS                                  │
│   assimilation curve  ┐   │  Light (PPFD)  ▭▭▭▭▭▭▭▱▱  820              │
│   ╭───────────────    │   │  CO₂ (ppm)     ▭▭▭▭▱▱▱▱▱  600              │
│   │       readout: 28 │   │  Temp (°C)     ▭▭▭▭▭▱▱▱▱  26               │
│  Gauge: net A          │   │  [Run] [Reset] [Hint ▸ Prof. narration]   │
├──────────────────────────┴───────────────────────────────────────────┤
│  Steps: ① set baseline ② raise light ③ find plateau ④ submit          │
│  Rubric ▸  Submit ▶                                                    │
└──────────────────────────────────────────────────────────────────────┘
```
Components: `Gauge`, `Bar` (sliders), `Card`, `Modal` (hint/Professor narration), `Button`, step
tracker. Drives `simulation/engine.py` in teaching mode (§8.1).

### 11.5 Exam View
```
┌──────────────────────────────────────────────────────────────────────┐
│ Mastery Exam · Foundations of Plant Biology     Q 7 / 20   ⏱ untimed   │
├──────────────────────────────────────────────────────────────────────┤
│  Q7. A plant shows interveinal chlorosis on lower leaves. Most likely? │
│   ( ) Nitrogen deficiency    ( ) Magnesium deficiency                  │
│   ( ) Light burn             ( ) Overwatering                          │
│  [ ] Flag for review                                                   │
├──────────────────────────────────────────────────────────────────────┤
│  Progress ▰▰▰▰▰▰▰▱▱▱▱▱   Pass ≥ 80%        ◀ Prev   Next ▶   Submit    │
└──────────────────────────────────────────────────────────────────────┘
```
Components: `Card`, radio/checkbox fields (`Field`), `Bar` (progress), `Button`. Deterministic grading
(§7.2); explained feedback on submit.

### 11.6 Transcript / Credential Wall (`/university/transcript`)
```
┌──────────────────────────────────────────────────────────────────────┐
│ PageHeader: "Academic Record — <player>"   Title: Master Grower        │
│ Academic Level 7 · KXP ▰▰▰▰▰▰▱▱   GPA 3.8   🔥 streak 12               │
├──────────────────────────────────────────────────────────────────────┤
│ DEGREES        [B.S. Horticulture] [M.S. Master Grower]                │
│ SPECIALIZ.     [Genetics Specialist] [IPM Specialist]                  │
│ CERTIFICATES   [Certified Grower]                                      │
│ BADGES         ▦ ▦ ▦ ▦ ▦ ▦  (one per course)                          │
│ COURSES (mastery %)   Foundations 100% · cult-101 100% · gen-101 84% … │
│ ACHIEVEMENTS   ★ First Harvest · ★ Perfect Midterm · ★ 30-day streak   │
└──────────────────────────────────────────────────────────────────────┘
```
Components: `PageHeader`, `Badge`/`Pills` (credentials), `Bar`/`ProgressRing` (KXP/mastery), `Card`,
`Metric`/`Stat`.

### 11.7 League Board (`/university/leagues` — default-on, educational)
```
┌──────────────────────────────────────────────────────────────────────┐
│ Emerald League · Week 24      Top 7 promote ▲  ·  Bottom 5 relegate ▼  │
├──────────────────────────────────────────────────────────────────────┤
│  #1  Ava        ▰▰▰▰▰▰▰▰  1,240 KXP                                    │
│  #2  Kenji      ▰▰▰▰▰▰▱▱    980                                        │
│  #4  YOU        ▰▰▰▰▱▱▱▱    620   ← promotion line above #7            │
│  Metric: lessons · mastery · consistency · projects  (NOT pay-to-win)  │
└──────────────────────────────────────────────────────────────────────┘
```
Components: `Card`, `Bar`, `Stat`, `Badge`. Scored on **educational** signals only (§12.3).

---

## 12. DELIVERABLE — Progression & Academic Levels

### 12.1 Unified Academic Level (settled)
One **Academic Level** for the whole university, driven by **Knowledge XP (KXP)** earned from lessons,
labs, exams, and reviews. KXP is **non-economic** — it never touches the GROW ledger (faucet/sink
invariant). The level curve reuses the *shape* of `services/leveling_service.py` (quadratic), kept as a
separate track so cultivation level and academic level stay independent (§5.2 two clocks).

### 12.2 Forgiving streak (settled)
Daily-goal streak with **one missed day per week forgiven** (a built-in "freeze"). Streaks drive habit
and the consistency league metric, never gameplay power. Missing the goal never *removes* learning
progress — it only pauses the streak counter (and the §12.4 review queue nudges you back).

### 12.3 Leagues — default-on, purely educational (settled)
Weekly bracketed leagues (v1 §7.4) are **on by default** and scored **only** on educational signals:
- **Lessons completed** · **mastery gained** · **consistency** (days active) · **projects/labs finished**.
- **Never** pay-to-win, never economy-linked, never grow-output-linked. A player who buys GROW cannot
  climb. This is the moat expressed as a leaderboard. Opt-out available for players who dislike competition
  (relatedness layer stays light, v1 §7.5).

### 12.4 Very light knowledge decay (settled)
Knowledge **never disappears** — completed courses, badges, degrees are permanent. "Decay" is purely a
**review nudge**: the spaced-repetition queue (v1 §7.3) resurfaces concepts you haven't touched, and a
gentle "needs review" tag appears on a course's mastery ring. It affects *recommendations*, not *records*.
This honors earned-mastery (you earned it, you keep it) while keeping the habit loop alive.

### 12.5 The two-clock model (restated, load-bearing)
- **Knowledge clock:** study minutes → KXP → Academic Level (the academy).
- **Cultivation clock:** grow-days → harvests → cultivation Level (the game).
- They meet **only** at the practical/capstone. This decoupling (v1 §4.3) is what lets the academy be
  Coursera-deep without forcing players to grind grows to "level up school," and vice-versa.

---

## 13. DELIVERABLE — Capstone Projects

### 13.1 Per-degree capstones (the "prove it" apex of each credential)
Each degree gains a capstone — an **applied project proven in the live sim** (extends the existing
practical mechanic, which already checks `harvest_quality`, `breed`, `stabilize`, `cure`, `cup_entry`,
etc. in `services/university_service.py`):

| Degree | Capstone project | Proven by (existing practical hooks) |
|--------|------------------|--------------------------------------|
| Certificate | First Successful Harvest | `harvest_count ≥ 1` |
| Associate | Quality Run | `harvest_quality ≥ threshold` + `cure` |
| B.S. Horticulture | Optimized Canopy Grow | `harvest_quality ≥ 85` |
| B.S. Genetics | Designed Cross | `breed ≥ 3` + a named trait target |
| M.S. Master Grower | Cup-Worthy Cultivar | `cup_entry` |
| **Ph.D.** | **Doctoral Dissertation** (§13.2) | **stabilize an original line / win a Cup** |

### 13.2 The Doctorate dissertation (the "think big" apex)
The terminal credential ties the apex of the academy to the **deepest game system** — generative genetics
(`design/02-genetics.md`, moat #2). The dissertation: **stabilize an original, provably-unique line**
(`stabilize` practical) and/or **win a seasonal Cannabis Cup** with it (`services/cup_service.py`). The
diploma names the strain. This is the single strongest expression of the moat: the highest academic honor
in the game is *only* obtainable by doing original cultivation work that no whale can buy — knowledge
*and* genetics, both earned over real time, both verifiable on-chain *later* (§14).

---

## 14. DELIVERABLE — Future Expansion Hooks

- **Clone-the-exemplar pipeline.** The §17 course is the template; every remaining course type (§1.3) is
  authored by cloning it and swapping content. The framework (§3) makes this a content task, not an
  engineering one.
- **The 3 planned departments** (Lab/QA, Business/Compliance, Pharmacology) + their course ladders.
- **Localization / multi-language narration.** The audio data model (§15) carries a `Language` field
  precisely so a lesson can have parallel narration tracks; transcripts translate alongside.
- **Faculty roster growth & Professor reputation** (v1 §8.5) — a mentor/reputation economy feeding
  `03-grower-skills.md` (knowledge as social capital).
- **On-chain Diploma NFTs** — mint a degree as a Proof-of-Cultivation-kin credential (Sprint 4 chain
  work; `services/minting_service.py`/`settlement_service.py`). **Out of scope now**; the credential
  records (§6) are designed to be mint-ready later without rework.
- **Adaptive difficulty / knowledge-graph routing** (Khan-style, v1 §1.3) — recommend the next lesson
  from mastery gaps.

---

## 15. DELIVERABLE — ElevenLabs Audio Architecture (greenfield)

> **There is no audio system anywhere in the codebase today.** This section designs it from scratch. It
> mirrors the discipline of the existing AI stack (`ai/factory.py`): a provider behind an interface, a
> deterministic/no-op path for CI, a real path for prod — **never a live key required in CI**.

### 15.1 The pipeline: generate → review → save → cache → reuse
```
Lesson content authored ──▶ narration script (= the transcript, §10)
        │
        ▼
  [script hash changed?] ── no ──▶ reuse cached audio (File Path)         ◀── the default path
        │ yes
        ▼
  ElevenLabs generate (prod only) ──▶ human/auto review ──▶ save file ──▶ update manifest
        │
        ▼
  CDN / asset store  +  manifest record (the cache index)
```
- **Generate once.** Audio is generated **only** when a lesson's script changes — never on every play, never
  in CI. The default runtime path is a pure cache lookup by `(Course ID, Lesson ID, Voice ID, Language)`.
- **Regenerate only the changed lesson.** Change detection is per-lesson via a **script hash** (the same
  pattern the Constellation render core uses sha256 pins for — `web/src/components/viz/`); editing one
  lesson re-renders one audio file, not the course.
- **CI-safe.** No ElevenLabs key in CI. The narration provider has a **silent/mock backend** (returns the
  transcript text + a null/placeholder audio handle) so tests and the mock Professor run with zero
  external calls — exactly how `ai/lecturer_mock.py` keeps the lecture path CI-safe today.

### 15.2 The narration manifest record (the cache index — the required fields)
Every generated clip is one manifest row. **Required fields (per directive):**

| Field | Purpose |
|-------|---------|
| **Course ID** | which course |
| **Lesson ID** | which lesson/component within the course |
| **Voice ID** | which faculty voice (§4.2 persona → ElevenLabs voice) |
| **Language** | locale (enables localization, §14) |
| **Version Number** | increments when the script changes (audit + cache-busting) |
| **File Path** | location of the rendered audio asset |

**Recommended companion fields** (for correct change-detection & ops): `script_hash` (sha256 of the
narration text — the regenerate trigger), `duration_sec` (feeds §9 honest time-accounting),
`generated_at`, `provider/model`, `checksum` (asset integrity), `status` (`cached`/`stale`/`generating`).

### 15.3 Narration types (what gets voiced)
Professor lectures (§4.3 #1) · lab-step instructions (#2) · sim/diagram cues · quiz/assessment feedback
(#3) · course intros (orientation) · certification congratulations (#4). Each is a manifest row; each
carries its transcript (§10 — caption + transcript are the *input* to generation, so they always exist).

### 15.4 Where it plugs in (design only — not built)
A `NarrationProvider` ABC (mirroring `LecturerProvider`/`AdvisorProvider` in `ai/provider.py`) with
`MockNarrationProvider` (CI) + `ElevenLabsNarrationProvider` (prod), chosen by `ai/factory.py`-style
config. The lesson player (§11.3) resolves audio by manifest lookup; the build/author step (not the
request path) is the only place generation can happen. **No code is written in this phase** — this is the
blueprint for when audio is scheduled.

### 15.5 Approved phased rollout (CEO-approved 2026-06-14 — its own implementation slice)
The audio pipeline is **green-lit as a separate greenfield slice**, isolated from curriculum-
implementation risk (it is the largest technical unknown). Approved phase order:

| Phase | Scope |
|-------|-------|
| **A** | Narration generation (provider + ElevenLabs call, prod-only) |
| **B** | Persistent audio storage (asset store / CDN) |
| **C** | Caching & versioning (the manifest §15.2 + `script_hash` change-detection) |
| **D** | Professor voice assignments (§4.2 persona → Voice ID) |
| **E** | Course playback integration (lesson player §11.3) |
| **F** | Accessibility & transcript-sync (caption/transcript parity §10) |

Locked requirements (directive): **generate once · cache permanently · regenerate only on content change
· versioned assets · transcript parity · reusable across courses.**

---

## 16. The ten contributing lenses (how this report was built)
Authored directly (not by spawning sub-agents); each section is written through these specialist
viewpoints so the Bible is complete and self-consistent:

| Lens | Owns | Sections |
|------|------|----------|
| **UNI-A00 Dean** | scope, thesis, moat-fidelity | 0, 2 |
| **UNI-A01 Curriculum** | map, departments, course types | 1, 2 |
| **UNI-A02 Pedagogy** | course framework, learning science | 3, 12 |
| **UNI-A03 Professor/Voice** | faculty personas, generation surfaces | 4 |
| **UNI-A04 Labs/Sim** | interactive labs, teaching-mode sim | 8 |
| **UNI-A05 Assessment** | exams, rubrics, grading | 7 |
| **UNI-A06 Records** | transcript, credentials, progression | 5, 6 |
| **UNI-A07 Audio** | ElevenLabs pipeline & manifest | 15 |
| **UNI-A08 Accessibility** | a11y standards | 10 |
| **UNI-A09 UX/Wireframe** | desktop wireframes, durations | 9, 11 |
| **UNI-A10 Capstone/Future** | capstones, dissertation, hooks | 13, 14 |

---

## 17. THE CANONICAL EXEMPLAR COURSE (authored end-to-end)

> **"Foundations of Plant Biology"** — key `bio-101` (**CEO-approved 2026-06-14**) · Type: **Foundational
> Core** · Faculty: **Professor Flora** · Band: **Core** · **Active content: 240 min = 4.0 h** ·
> Department: Foundations (feeds all spines; **no prerequisites — required introductory course**) ·
> `level_req: 1`. Approved learning path: **`bio-101` → `cult-101` → Intermediate → Advanced
> specializations → Capstone programs** (plant science before cultivation systems).
>
> This is the **gold-standard template**. Every future course is cloned from it. It instantiates every box
> in §3.1, uses the §3.2 primitives, ships the 5 labs (§8.2), and its component durations **sum to exactly
> 240 minutes** (the §3.3 honest-hour acceptance test). Below: full lesson outlines, slide structure,
> narration scripts, interactive specs, sim requirements, assessment rubrics, durations, accessibility
> notes, objectives, and competencies.

### 17.0 Course-level objectives & competencies
**On completion, the student can:**
1. Describe the plant cell and the major tissue systems and their functions.
2. Explain photosynthesis and respiration as the plant's energy economy, and identify the light-saturation
   point.
3. Trace water and nutrient transport (xylem/phloem, transpiration) and relate it to VPD.
4. Predict how a plant responds to environmental stress and diagnose a simple deficiency.
5. Integrate the above into a whole-plant mental model that the rest of the curriculum builds on.

**Competencies proven (the practical / capstone bridge to the live grow):** run a healthy seedling-to-
vegetative plant in the Virtual Grow Room to a quality target; correctly diagnose one real deficiency in
the live sim (ties to the §13 Certificate capstone).

**Passing criteria:** Midterm ≥ 70% (unlocks back half) · Mastery Exam ≥ 80% (earns the Badge) · Capstone
practical met. Mastery Exam retryable after cooldown (forgiving, §7.3).

### 17.1 Component time budget (sums to 240 min — the acceptance test)
| # | Component | Type | Min |
|---|-----------|------|-----|
| 0 | **Orientation** (Professor intro + roadmap + pre-assessment) | intro | 12 |
| 1 | **Module 1 — Cells & Tissues** | module | 50 |
| 2 | **Module 2 — Photosynthesis & Energy** | module | 50 |
| 3 | **Midterm Exam** | exam | 15 |
| 4 | **Module 3 — Water, Nutrients & Transport** | module | 50 |
| 5 | **Module 4 — Environmental Response & Whole-Plant Integration** | module | 40 |
| 6 | **Capstone — Virtual Grow Room (Lab 5)** | applied | 13 |
| 7 | **Mastery Exam (Final)** | exam | 8 |
| 8 | **Certification** (narrated congratulations + diploma) | cert | 2 |
| | **TOTAL** | | **240** |

Per-module internal budgets (each sums to its row above):
- **M1 (50):** video 8 · narrated lesson 12 · **Lab 1 Cell ID** 14 · clickable cell diagram 6 · knowledge
  checks 6 · scenario 4.
- **M2 (50):** video 8 · narrated lesson 12 · **Lab 2 Photosynthesis Sim** 16 · knowledge checks 6 ·
  scenario 8.
- **M3 (50):** video 8 · narrated lesson 12 · **Lab 3 Environmental Variables** 14 · xylem/phloem diagram
  6 · knowledge checks 6 · scenario 4.
- **M4 (40):** video 7 · narrated lesson 11 · **Lab 4 Stress Diagnosis** 14 · knowledge checks 5 ·
  reflection checkpoint 3.

### 17.2 Orientation (12 min)
- **Slide structure:** (1) Welcome title; (2) "Why a grower starts with biology"; (3) the 5 objectives;
  (4) course map (4 modules → midterm → capstone → final); (5) "what you'll prove in your grow";
  (6) pre-assessment intro.
- **Narration script — Professor Flora (excerpt, = transcript):** *"Welcome. I'm Professor Flora, and
  before you ever touch a nutrient bottle or a pair of scissors, we're going to understand the thing you're
  actually growing. A cannabis plant is not a machine with inputs and outputs — it's a living chemistry set
  that's been solving the problem of turning light into matter for four hundred million years. For the next
  four hours, we start at the cell and build up to the whole plant. By the end, when a leaf yellows in your
  grow, you won't guess — you'll know why."*
- **Interactivity:** ungraded **pre-assessment** (5 MCQs, primitive #11) — sets the spaced-repetition
  baseline; no gate.
- **Accessibility:** transcript visible; narration pausable; pre-assessment keyboard-navigable.

### 17.3 Module 1 — Cells & Tissues (50 min)
**Objectives:** name the organelles relevant to growth; distinguish meristematic / dermal / vascular /
ground tissue; explain why the apical meristem matters to a grower.
- **Video lesson (8 min):** animated tour of a plant cell → tissues → the growing tip. Captioned.
- **Narrated interactive lesson (12 min):** Professor walks the **clickable cell diagram** (primitive #1)
  — each organelle hotspot reveals a 2–3 sentence explanation + its grower-relevance.
  - **Slide structure:** cell overview → cell wall/membrane → chloroplast (teased, deep-dived in M2) →
    vacuole/turgor → nucleus → meristem tissue → vascular bundle preview.
  - **Narration excerpt:** *"See the vacuole — that big water balloon is most of the cell's volume. When
    your plant wilts, this is what's deflating. Turgor pressure is structural; a thirsty plant literally
    loses its skeleton."*
- **Lab 1 — Cell ID Virtual Microscope (14 min):** drag-drop labels onto micrographs; identify 10
  structures across two tissue types. **Success:** ≥ 8/10. Hints via Professor lab-instruction narration.
- **Clickable cell diagram activity (6 min):** free-explore mode, all hotspots, then a 4-item "find the
  structure" check.
- **Knowledge checks (6 min):** 5 items (MCQ + drag-sort tissue→function), instant explained feedback.
- **Scenario (4 min):** *"A clone won't root and shows no new growth at the tip."* → identify the relevant
  tissue (meristem) from a short decision tree.
- **Accessibility:** every micrograph has alt text; drag-drop has keyboard equivalent; color not sole cue.

### 17.4 Module 2 — Photosynthesis & Energy (50 min)
**Objectives:** explain light/dark reactions at a grower's level; define the light-saturation point and
why more light isn't always more growth; relate respiration to night-time energy use.
- **Video lesson (8 min):** light → thylakoid → sugar; the CO₂/light/temperature trio. Captioned.
- **Narrated interactive lesson (12 min):** **before/after slider** (primitive #8) showing a leaf under
  low vs. saturating light; Professor narrates the assimilation curve.
  - **Narration excerpt — Professor Flora:** *"There's a point — we call it light saturation — where
    cramming more photons at the leaf stops buying you sugar and starts buying you problems. Your job as a
    grower isn't 'more light.' It's 'enough light, then fix the next limiting thing.' That's Liebig's
    barrel, and we'll meet it again in nutrients."*
- **Lab 2 — Photosynthesis Simulator (16 min):** **parameter sim** (primitive #2) + guided experiment —
  sliders for PPFD / CO₂ / temp drive a live net-assimilation Gauge. **Task:** find the light-saturation
  point at ambient CO₂, then show how raising CO₂ moves it. **Success:** identify saturation point within
  tolerance. *(Sim requirement: a teaching-mode light-response curve; may reuse the engine's light/PPFD
  handling, `simulation/engine.py`, in read-only sandbox — §8.1.)*
- **Knowledge checks (6 min):** 6 items incl. a numeric "at what PPFD does assimilation plateau?" (numeric-
  with-tolerance grading, §7.2).
- **Scenario (8 min):** *"Grower doubled wattage and growth didn't improve; leaf-tip bleaching appeared."*
  → decision tree to "past saturation / light stress"; rubric: correct cause 50% · correct action 50%.
- **Accessibility:** the assimilation curve is also given as a data table; slider values announced.

### 17.5 Midterm Exam (15 min)
- **Coverage:** Modules 1–2. 12 items: MCQ, true/false, one numeric, one drag-sort.
- **Pass:** ≥ 70% unlocks Modules 3–4 (§7.3). Deterministic grading; explained feedback on submit;
  retryable.
- **Rubric (objective):** auto-graded answer key in curriculum data. **Sample item:** *"Which limits
  growth first when all else is ample but light is at saturation? (a) more light (b) the next limiting
  factor ✓ (c) respiration (d) chlorophyll."*

### 17.6 Module 3 — Water, Nutrients & Transport (50 min)
**Objectives:** trace xylem (up) / phloem (down); explain transpiration as the engine of uptake; connect
VPD to transpiration; map the mobile vs. immobile nutrients to where deficiencies appear.
- **Video lesson (8 min):** the water highway; the transpiration stream; VPD intuition. Captioned.
- **Narrated interactive lesson (12 min):** Professor narrates the **xylem/phloem clickable diagram**
  (primitive #1) and a **before/after** of a high-VPD vs. ideal-VPD leaf.
  - **Narration excerpt:** *"Transpiration isn't waste — it's the pump. Water leaving the leaf pulls the
    whole column up from the roots, nutrients riding along. Push VPD too high and the plant slams its
    stomata shut to survive; now the pump's off and so is feeding. This is why we obsess over VPD."*
- **Lab 3 — Environmental Variables Lab (14 min):** **environment-tuning challenge** (primitive #4) —
  steer humidity/temp to hold a target **VPD** band for a vegetative stage; before/after shows transpiration
  response. *(Sim requirement: reuse the engine's derived leaf-VPD, which it already computes —
  `simulation/engine.py` — in teaching mode.)* **Success:** hold the target band for the window.
- **Xylem/phloem diagram activity (6 min):** label transport directions + classify 4 nutrients as
  mobile/immobile.
- **Knowledge checks (6 min):** 6 items, incl. "where does a *mobile*-nutrient deficiency show first?"
  (lower/older leaves).
- **Scenario (4 min):** *"Interveinal chlorosis on lower leaves."* → Mg vs. N reasoning (sets up Module 4
  + the live-grow capstone).
- **Accessibility:** VPD readouts numeric + announced; diagram fully keyboard-labelable.

### 17.7 Module 4 — Environmental Response & Whole-Plant Integration (40 min)
**Objectives:** predict stress responses (drought, heat, light, nutrient); diagnose one deficiency end-to-
end; assemble the whole-plant model.
- **Video lesson (7 min):** the plant as an integrated system; stress signals. Captioned.
- **Narrated interactive lesson (11 min):** Professor integrates M1–M3 into one whole-plant diagram;
  "every symptom is a story about a process you now understand."
- **Lab 4 — Stress Diagnosis Clinic (14 min):** **diagnosis lab + decision tree** (primitives #3, #5) —
  three sick plants; for each, identify cause from symptoms and choose the first intervention. **Success:**
  correct cause **and** correct first action on ≥ 2/3.
- **Knowledge checks (5 min):** 5 integrative items spanning all four modules.
- **Reflection checkpoint (3 min):** primitive #10 — "Which process do you understand best now, and which
  will you watch in your next grow?" (self-rating; feeds the review queue).
- **Accessibility:** symptom images alt-texted; decision tree keyboard-navigable; no color-only diagnosis.

### 17.8 Capstone — Virtual Grow Room (Lab 5, 13 min in-app + real grow)
- **In-app (13 min):** **full sim sandbox** (primitive #7) — run a compressed seedling→veg grow, making
  watering/feeding/environment decisions, to a quality target. Resettable, zero economy impact (§8.3).
- **Bridge to the live grow (the real capstone):** to *complete* the course, the student must also meet the
  **Certificate-tier practical in their actual grow** — produce one real harvest and/or correctly resolve
  one real deficiency (existing practical mechanic, `services/university_service.py`). This is the moat:
  the lab teaches; the real grow proves.
- **Rubric (weighted):** correct environmental setup 30% · correct response to the injected stress 30% ·
  hit quality target 25% · justification vs. model answer 15%.

### 17.9 Mastery Exam — Final (8 min)
- **Coverage:** all four modules. 20 items, mixed format, comprehensive.
- **Pass:** ≥ 80% → earns the **"Plant Biology Foundations" Badge**, advances any degree that lists
  `bio-101`, and awards KXP. Deterministic grading; retry after cooldown (forgiving).
- **Sample item:** *"A lower leaf shows interveinal chlorosis; upper growth is fine. Most likely cause and
  why?"* (Mg deficiency, mobile-nutrient logic — auto-graded MCQ + an explained-feedback reveal.)

### 17.10 Certification (2 min)
- Narrated **congratulations** in Professor Flora's voice (§4.3 #4); diploma artifact added to the transcript
  / credential wall (§11.6); KXP + Academic-Level update; Badge issued (§6). If `bio-101` is wired into a
  degree's `required_courses`, degree progress advances automatically (existing `claim_degree` path).

### 17.11 Narration manifest for this course (illustrates §15.2)
Every voiced component above is one manifest row, e.g.:

| Course ID | Lesson ID | Voice ID | Language | Version | File Path |
|-----------|-----------|----------|----------|---------|-----------|
| `bio-101` | `orientation-intro` | `vera-lindqvist` | `en-US` | 1 | `audio/bio-101/orientation-intro.v1.mp3` |
| `bio-101` | `m1-narrated-lesson` | `vera-lindqvist` | `en-US` | 1 | `audio/bio-101/m1-narrated-lesson.v1.mp3` |
| `bio-101` | `m2-lab2-hint-1` | `vera-lindqvist` | `en-US` | 1 | `audio/bio-101/m2-lab2-hint-1.v1.mp3` |
| `bio-101` | `cert-congrats` | `vera-lindqvist` | `en-US` | 1 | `audio/bio-101/cert-congrats.v1.mp3` |

Editing only the M2 lesson script bumps `m2-narrated-lesson` to Version 2 and regenerates **only that
file** (§15.1) — every other row is a cache hit.

---

## 18. DIRECTIVE REPORT (UNI-001 v2)

- **Directive ID:** UNI-001 v2 — "The Long-Form Academy" (Phase 2, content/depth layer).
- **Lead:** UNI-A00 (Dean). **Records:** UNI-A10. **Lenses:** the ten roles in §16.
- **Asked:** Design the deep, Coursera-grade *content* architecture for GrowPod University — long-form
  interactive courses, a Professor delivery system, real labs/exams, narrated audio, desktop wireframes,
  progression/credentials, and one fully-authored exemplar course — research/architecture only, no code, no
  monetization.
- **Done:** This Master Bible — all 15 deliverables (§§1–15) plus the fully-authored 4-hour exemplar
  course "Foundations of Plant Biology" (§17), whose component durations sum to exactly 240 min. Companion
  permanent spec registered at `docs/memory/design/07-university-phase-2.md` (in MAP.md).
- **Built on / reused:** the shipped university (`services/university_service.py`, `data/curriculum.yaml`),
  the Professor stack (`ai/provider.py`, `ai/lecturer_*.py`, `services/lecturer_service.py`), the leveling
  curve (`services/leveling_service.py`), the web UI + component library (`web/src/app/university/`,
  `web/src/components/ui/`), and the pure sim engine for lab teaching-mode (`simulation/engine.py`).
- **Risks / honesty notes:** (1) the ElevenLabs pipeline (§15) is **fully greenfield** — no audio code
  exists, so it carries the most implementation unknowns; (2) the catalog's `duration_hours` (study-clock
  gate) and the new active-content budget (§9.3) are different axes and the UI must show both honestly;
  (3) authoring the remaining ~15 course types to this depth is a large *content* effort (the framework
  makes it tractable, but it is the real cost).
- **CEO review (2026-06-14): APPROVED.** All three decisions settled — (1) **`bio-101`** approved as the
  no-prerequisite **required introductory course** before `cult-101` (path `bio-101 → cult-101 →
  Intermediate → Advanced → Capstone`); (2) **faculty persona system approved** (Flora · Verdant ·
  Mycelia · Atlas · Nova; names may evolve, §4.2); (3) **ElevenLabs pipeline green-lit as its own
  greenfield slice**, phases A–F (§15.5).
- **CEO-approved implementation order (future scheduling):** 1) University Framework · 2) `bio-101`
  exemplar · 3) Professor System · 4) ElevenLabs Pipeline · 5) Interactive Labs · 6) Assessments & Exams ·
  7) Certifications · 8) Transcripts · 9) Advanced Courses · 10) Degree Programs.
- **Risks / honesty notes (carried):** (1) the ElevenLabs pipeline (§15) is **fully greenfield** — most
  implementation unknowns (mitigated by isolating it as slice #4); (2) the catalog's `duration_hours`
  (study-clock gate) and the new active-content budget (§9.3) are different axes — the UI must show both
  honestly; (3) authoring the remaining course types to this depth is a large *content* effort.
- **Recommendation:** Build the **framework and the one exemplar first** (player, lab shell, exam,
  manifest, narration mock), prove the honest-hour rule end-to-end on `bio-101`, *then* scale content. Do
  not author 30 shallow courses; author one deep one and clone it.

## 19. Cross-links
- Phase 1 engagement architecture: `docs/research/2026-06-14-growpod-university-curriculum-architecture.md`
- Permanent Phase-2 spec (this report's Codex companion): `docs/memory/design/07-university-phase-2.md`
- Shipped university design: `docs/memory/design/06-university.md`
- Curriculum grounding: `docs/research/2026-06-08-cannabis-education-curriculum.md`
- Strain-science grounding: `docs/research/2026-06-08-cannabis-strain-genetics-and-cultivation.md`
- Code anchors: `services/university_service.py` · `services/lecturer_service.py` · `data/curriculum.yaml`
  · `ai/provider.py` · `ai/lecturer_mock.py` · `ai/lecturer_claude.py` · `simulation/engine.py` ·
  `web/src/app/university/` · `web/src/components/ui/`
