# GrowVerse University — UI Component Spec (Figma-ready) (D2)

> **Records/Research only** (UNI-011 freeze-safe). The **token + component spec** for the immersive
> university surfaces — campus, course, lecture player, lab shell, exam, transcript wall, the 3D
> Explorer chrome, and the Master Grower bot chat — built on the extracted design-system rules (D1)
> and the Master Report §11 wireframes. Ready to build in Figma; no code. Track D. Status: **draft.**

## 0. Principles (inherit D1)
Dark-first · token-only (grow/ink/accent/violet) · Inter / mono readouts · `:focus-visible` grow.400
ring · mobile-first ≥44px · reduced-motion · contrast ≥4.5:1 · **compose existing `ui/` primitives
first**. Semantic palette: **grow**=progress/correct, **accent**=readouts/lecture chrome/bot data,
**violet**=genetics, **ink**=all chrome.

## 1. Surfaces → components (reuse vs. new)

### 1.1 Campus Dashboard (`/university`) — Master Report §11.1
- **Reuse:** `PageHeader`, `Card`, `ProgressRing` (degree progress), `Badge`/`Pills` (credentials),
  `Metric` (Academic Level / KXP), `Tabs` (Departments).
- **New:** `CourseCard` (thumbnail, faculty chip, duration band, prereq lock, progress ring),
  `DepartmentRail`, `CredentialWallPreview`.
- **Tokens:** ink surfaces; grow for progress; faculty accent per department (genetics→violet).

### 1.2 Course Landing / Orientation (`/university/courses/[key]`) — §11.2
- **Reuse:** `PageHeader`, `Card`, `CollapsiblePanel` (module outline), `Button` (Enroll/Resume),
  `Badge` (duration band, level_req), `Metric` (honest-hour total + study-clock gate — show **both**
  honestly, Phase-2 §3).
- **New:** `FacultyHeader` (persona portrait + name + voice tag), `CourseRoadmap` (orientation →
  modules → midterm → capstone → final), `PracticalRequirementCard` ("prove it in your grow").

### 1.3 Lesson Player (the core screen) — §11.3
- **Reuse:** `Button`, `Tabs` (Lesson / Transcript / Notes), `ProgressRing`, `Toast`.
- **New (the showcase):**
  - `LecturePlayer` — avatar-video surface (B1) + controls: play/pause, scrubber, speed, **captions
    toggle (default ON)**, transcript panel. Chrome in **accent**; surface ink-900.
  - `SlideStage` — the diagram/slide surface beside the presenter.
  - `InteractiveLessonShell` — hosts the 11 primitives (clickable diagram, before/after slider,
    parameter sim…); each primitive a sub-component.
  - `KnowledgeCheck` — MCQ / drag-sort / numeric-with-tolerance, instant explained feedback (grow =
    correct, never color-only — pair an icon).
  - `OpenExplorerCTA` — deep-links into the 3D Anatomy Explorer at the relevant tier (A2).
- **A11y:** transcript = the narration script (parity); keyboard controls; no audio/video-only info.

### 1.4 Interactive Lab Shell — §11.4
- **Reuse:** `Gauge`/`Bar`/`Metric` (live readouts), `Field` (parameter inputs), `States`.
- **New:** `LabShell` (instructions rail + sim canvas + readout panel + success criteria), `LabHint`
  (faculty-voiced hint, on demand). Houses the 5 canonical labs (A2); readouts in **accent**, success
  in **grow**. Sim values also shown as a **data table** (a11y for charts).

### 1.5 Exam View — §11.5
- **Reuse:** `Card`, `Button`, `ProgressRing` (items left), `Countdown` (timed), `Modal` (submit
  confirm), `Toast`.
- **New:** `ExamRunner` (item-by-item, deterministic grading, ≥70% midterm / ≥80% mastery gates),
  `ExplainedFeedback` (post-submit rationale). Retryable/forgiving framing.

### 1.6 Transcript / Credential Wall (`/university/transcript`) — §11.6
- **Reuse:** `Badge`, `Pills`, `Card`, `Metric`, `PageHeader`.
- **New:** `CredentialCard` (badge → certificate → degree → doctorate), `DiplomaView` (transcript
  entry + certificate render), `AcademicLevelMeter` (KXP). Future hook: on-chain diploma (gated).

### 1.7 League Board (`/university/leagues`) — §11.7
- **Reuse:** existing leaderboard patterns, `Tabs`, `Badge`. **Non-economic** styling (educational,
  never pay-to-win) — keep visually distinct from the GROW market.

## 2. New cross-cutting components

### 2.1 3D Explorer chrome (A1/A2)
- `ExplorerCanvas` (R3F mount; lazy route), `TierRail` (whole→cola→calyx→trichome zoom tiers as LOD
  steps), `PartLabel` (`<Html>` callout: name + 2–3 sentence fact + live alt-text), `ParamSlider`
  (PlantDNA/env sliders), `ReducedMotionToggle`, `Fallback2D` (the Canvas macro-bud + labeled
  diagram). Chrome minimal/translucent over ink; labels in grow/accent.

### 2.2 Master Grower bot chat (C1/C2)
- `BotChatPanel` (conversation surface; dockable), `GroundedAnswer` (answer + **citation chips** to
  source docs/strain entries — accent), `SourceChip`, `PlantContextHeader` ("answering about: your
  Gelato, day 34"), `CareActionButton` (maps a suggestion to a real care action), `UpgradeNudge`
  (paid-tier, **honest, no dark pattern** — C2). Free vs. paid states gated by a simple `pro` flag
  (mock in design). Data/citations in **accent**; never invents numbers (C1 grounding rule shown via
  "from `environment-rules.md`" chips).

## 3. Faculty visual identity (ties B1 personas)
Each faculty gets: portrait, name, department color accent, voice tag. Roster per **code**
(`_DEPT_VOICES`): Flora (cultivation), Vera Lindqvist (genetics→violet), Sage Harlow (nutrients),
Mira Okafor (IPM), Chem Torres (chemistry), Petra Nance (post-harvest). **Reconcile names with
Phase-2 §7 before building** (flagged in B1/B2).

## 4. Figma build path (when owner opens the build phase)
1. Create the GrowVerse University Figma library; define **variables** from §D1 tokens (grow/ink/
   accent/violet ramps, type, radius, shadow).
2. Build base components (`CourseCard`, `FacultyHeader`, `LecturePlayer`, `LabShell`, `BotChatPanel`,
   `CredentialCard`), each mapped to the code component via **Code Connect**.
3. Assemble the seven §11 screens from those components.
> Figma tooling available here: `search_design_system`, `get_design_context`, `use_figma`,
> `create_new_file`, `generate_diagram`, Code Connect, `DesignSync`. (Building in Figma now would
> exceed the docs-only freeze — this spec is the blueprint to execute later.)

## 5. Open questions (owner)
Faculty roster reconciliation (names/voices) · whether the bot chat is a global dock or
university-only · league visual language vs. market · diploma artifact visual (and future on-chain).

## Cross-links
- Design-system rules (tokens): `docs/research/university/figma-design-system-rules.md` (D1)
- Wireframes: `docs/research/UNI-001-v2-Master-Report.md` §11 · classroom surfaces: `08-immersive-classroom.md`
- Lecture pipeline: `2026-06-23-ai-presenter-lecture-pipeline.md` (B1) · bot: `09-master-grower-bot.md` (C2)
- Master plan/ledger: `docs/research/university/IMMERSIVE_UNIVERSITY_MASTER_PLAN.md`
