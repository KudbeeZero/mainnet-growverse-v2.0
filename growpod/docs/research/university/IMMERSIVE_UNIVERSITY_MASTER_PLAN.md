# 🎓🌐 GrowVerse Immersive University — Master Plan & Autonomous Build-Loop Ledger

> **Classification: Records / Research / Design ONLY.** This document and every artifact it
> produces are **documentation and design deliverables** — no code, no renderer changes, no
> `curriculum.yaml` edits, no economy/payment code, **no PRs**. This keeps the work **inside the
> UNI-011 Canonical Freeze** (`GROWPOD_UNIVERSITY_MASTER_BIBLE.md`), which permits "Records/
> documentation only" until the owner opens the **University Build Phase**.
> **Owner explicitly authorized this research/design pass on 2026-06-23–24.**
>
> **⚠️ Durability note (2026-06-24):** the autonomous loop's scheduled wakes ran against a
> re-checked-out tree (reflog shows a `claude/dev-tester-time-controls → main` checkout), which
> **discarded untracked artifacts** between turns. Fix: this pass now runs in **auto mode on the
> `claude/immersive-university-research` branch and commits each batch** so output is durable. No PR
> is opened (freeze-safe); the branch is left for owner review.

## North star (owner's words)
Make GrowVerse's university the **best in its category**: players should "feel as if they are
really in class" — from **videos of a professor giving a lecture**, to **THREE.js models that let
people learn every detail of growing the cannabis plant**, all mapped into a **GrowVerse Master
Grower AI Bot** that helps each user grow (a **paid** assistant, gated to post-launch).

## How this plan relates to what already exists (reuse, don't rebuild)
- **Shipped (Phase 1):** enroll→study-clock→degrees+perks, AI Professor (`lecturer_service.py`,
  CI-safe mock + Claude provider), 6 depts / 14 courses / 5 degrees, web catalog + lecture reader
  (`web/src/app/university/`). See `docs/memory/design/06-university.md`.
- **Spec'd (Phase 2):** Coursera-depth courses, named faculty, 11 interactivity primitives, 5
  canonical labs, ElevenLabs narration pipeline, the `bio-101` exemplar. See
  `docs/memory/design/07-university-phase-2.md` + `UNI-001-v2-Master-Report.md`.
- **Already in the web stack:** `three`, `@react-three/fiber`, `@react-three/drei` — the 3D
  classroom builds on R3F that's *already a dependency*, plus the dependency-free `<Constellation>`
  Canvas engine. Existing knowledge corpus to map: `growpod/knowledge/*.md` +
  `docs/encyclopedia/strains/*` (29-strain scientist-grade encyclopedia).
- **Already shipped beyond Phase-2's assumptions:** the **ElevenLabs narration pipeline is built**
  (`src/growpodempire/ai/elevenlabs_narrator.py`, 3-layer cache, faculty→voice roster, `lecture_audio`
  table, `audio_prewarm`). See B1.

## Owner decisions locked (2026-06-23)
1. **Loop scope:** Research + design + content only (reviewable docs/assets; cannot break build/economy).
2. **3D classroom:** Research + architecture decision doc first; owner approves stack before any 3D code.
3. **Lectures:** AI-presenter pipeline (HeyGen-style avatar + the shipped ElevenLabs narration), tied to faculty personas; no filming required.
4. **Master Grower bot:** Design + monetization *plan* now; **no payment/billing code**; payment gated to launch.

---

## The build-loop work queue (the ledger)
Each iteration completes **one** deliverable, writes the artifact, ticks the box, commits. Status:
⬜ queued · 🔨 in progress · ✅ done. All paths under `growpod/`.

### Track A — Immersive 3D Classroom & Plant Explorer
- ✅ **A1** `docs/research/2026-06-23-3d-classroom-architecture.md` — R3F vs Canvas; procedural vs
  GLTF; LOD/perf budget; mobile constraints; a11y fallback; recommended stack. *(hybrid renderer;
  procedural-first; 4 owner questions.)*
- ✅ **A2** `docs/memory/design/08-immersive-classroom.md` — Lecture Hall + 4-tier Plant Anatomy
  Explorer (whole→cola→calyx→trichome) as the shared LOD engine for all 5 canonical labs.

### Track B — Professor Lecture / AI-Presenter Video Pipeline
- ✅ **B1** `docs/research/2026-06-23-ai-presenter-lecture-pipeline.md` — KEY FINDING: narration +
  cache + faculty→voice roster ALREADY SHIPPED; designed the avatar-video layer as a
  `VideoPresenterProvider` ABC+mock reusing the narration MP3 + `(avatar_id, audio_hash)` cache;
  ~$140 one-time HeyGen cost. Flagged: faculty roster code ≠ Phase-2 §7 docs.
- ✅ **B2** `docs/research/university/courses/bio-101-lecture-scripts.md` — authored the canonical
  `bio-101` ("Foundations of Plant Biology", Professor Flora) lecture/narration scripts to Master
  Report §17 (orientation + 4 modules + certification), honest-hour budgeted, transcript-ready.
  *(Done 2026-06-24: full word-for-word professor lectures, grower-practical voice; flagged the
  Flora-vs-Vera-Lindqvist voice discrepancy. Track B complete.)*

### Track C — GrowVerse Master Grower AI Bot (knowledge mapping + monetization plan)
- ✅ **C1** `docs/research/2026-06-23-master-grower-bot-knowledge-graph.md` — three grounding sources
  (live game state · structured strain YAML · RAG-over-corpus); hybrid retrieval; cite-or-don't-answer;
  reuses the shipped advisor stack as a tool-using orchestration layer; optional knowledge-graph v2;
  CI-safe; safety/scope lock. *(Done 2026-06-24.)*
- ✅ **C2** `docs/memory/design/09-master-grower-bot.md` — product design + **monetization PLAN
  (no code)**: principle "sell guidance/convenience, never power/progress"; free game stays complete;
  paid tier = depth/monitoring/office-hours; real-money entitlement strictly decoupled from the GROW
  ledger; owner-/launch-gated. *(Done 2026-06-24. Track C complete.)*

### Track D — Figma Design System (GrowVerse University)
- ✅ **D1** `docs/research/university/figma-design-system-rules.md` — design-system rules extracted
  from `web/` (grow/ink/accent/violet token ramps, Inter type, focus-ring a11y rule, 18-component
  `ui/` inventory, rules for new components). *(Figma `create_design_system_rules` tool not exposed;
  authored from `tailwind.config.ts`/`globals.css`/`components/ui/` instead. Done 2026-06-24.)*
- ✅ **D2** `docs/research/university/figma-university-design-system.md` — Figma-ready UI spec mapping
  the 7 Master Report §11 screens + 3D Explorer chrome + bot chat onto D1 tokens & existing
  components; faculty visual identity; Figma build path. *(Done 2026-06-24. Track D complete.)*

### Track E — Synthesis & Competitive Edge
- ✅ **E1** `docs/research/2026-06-23-edtech-competitive-analysis.md` — Duolingo (streaks/instant
  feedback/leagues) · Labster (labs beat reading, +19%) · Kerbal (legible failure) · Foldit (meaning);
  6-item adopt-list; the "best in category" bar; differentiation thesis. *(Done 2026-06-24.)*
- ✅ **E2** Synthesis below (§Synthesis) — phased owner-gated Build Phase + acceptance criteria +
  consolidated owner-decision list. *(Done 2026-06-24. Base queue A1–E2 complete.)*

### Track F — Build-readiness depth pass (turn the A–E designs into *buildable* specs)
> Added 2026-06-24 after the base queue completed, to deepen toward "best in category." Still
> docs-only / freeze-safe. Each makes a Build-Phase phase concretely buildable.
- ✅ **F1** `docs/research/2026-06-24-3d-anatomy-explorer-technical-spec.md` — KEY FINDING: the
  `bud3d/` generators already emit 3D instance arrays (`buildCola`/`buildFrost`/`buildPistils`) and
  ripeness is server-authoritative (`budParamsFromTrichomes`). Spec'd the Explorer as a `chamber3d/`
  R3F **renderer over the existing pure modules** (4 LOD tiers, instanced, deterministic, zero edits
  to the pure core). *(Done 2026-06-24.)*
- ✅ **F2** `docs/research/university/courses/cult-101-lecture-scripts.md` — authored the shipped
  `cult-101` "Fundamentals of Cannabis Cultivation" full scripts (orientation + 3 modules + cert) by
  cloning the bio-101 template; grounded in real `curriculum.yaml` (practical = 1 harvest, perk
  quality_bonus +1). Proves the framework scales. *(Done 2026-06-24.)*
- ✅ **F3** `docs/research/university/bio-101-assessment-bank.md` — authored a deterministic,
  data-authored seed bank (M1–M4 knowledge checks + midterm/mastery blueprints + answer keys +
  explained feedback), with a CI-safe grading contract (mcq/multi/tf/numeric+tol/drag_sort). Makes
  Build-Phase 1 grading buildable. *(Done 2026-06-24.)*
- ✅ **F4** `docs/research/2026-06-24-master-grower-bot-system-design.md` — draft system prompt,
  4 read-only tool contracts, worked orchestration, and a CI-safe **guardrail/eval suite** (grounding,
  no-invent, refusals, live-state honesty, anti-pay-to-win). Makes Build-Phase 4 buildable. *(Done 2026-06-24.)*
- ✅ **F5** `docs/research/university/accessibility-conformance-checklist.md` — WCAG 2.2 AA ship-gate
  checklist across all 6 surfaces + a verification method. *(Done 2026-06-24. Track F complete.)*

---

## Synthesis (E2) — the phased University Build Phase (owner-gated)

> **Nothing below is built yet.** This is the recommended order for *when the owner lifts the UNI-011
> freeze* (post-MVP). Every claim traces to A–E. Each phase has an exit/acceptance test.

**Phase 0 — Reconcile docs (cheap, do first, still docs-only).** Fix the **faculty roster mismatch**
(code `_DEPT_VOICES` vs. Phase-2 §7 vs. the §17.11 `bio-101` voice) and assign `bio-101` a
department→voice. *Exit:* one authoritative roster; `make check-memory` green.

**Phase 1 — Course framework + the `bio-101` exemplar** (Phase-2's CEO-approved order). Framework →
`bio-101` content (**B2 scripts already authored**) → assessments (deterministic, data-authored) →
certification → transcript wiring. *Exit:* a player completes `bio-101` end-to-end; honest-hour sums
to 240 min; grading is CI-safe (no live AI); degree progress advances via existing `claim_degree`.

**Phase 2 — Professor video layer (B1).** `VideoPresenterProvider` ABC + mock + HeyGen; reuse the
shipped narration MP3 + `(avatar_id, audio_hash)` cache; captions from ElevenLabs timestamps. *Exit:*
mock renders in CI with no key; one real lecture video plays with captions=transcript; cost bounded
(~$140 one-time for the catalog).

**Phase 3 — 3D Anatomy Explorer + Lecture Hall (A1/A2).** First **answer A1 §9** (fidelity, set
dressing, zoom depth, hall realism). Then build a pure `chamber3d/` procedural module (reuse
`seedForPlant`) → instanced calyx/trichome geometry → 4 LOD tiers → the 5 labs as modes → the hall.
*Exit:* < 50 draw calls on mid mobile; deterministic (same id → same plant); 2D fallback + reduced-
motion + keyboard a11y all pass; no logic added to the pure engine.

**Phase 4 — Master Grower bot (C1) + chat UI (D2).** Corpus-RAG v1 (hybrid retrieval, cite-or-don't-
answer) as a tool-using layer over the shipped advisor; `BotChatPanel` with citation chips. *Exit:*
every answer cited; refuses out-of-scope; never invents numbers; mock-backed CI; reads live plant
state. **Monetization/entitlement (C2) is a separate owner-/launch-gated slice — build last, never
touching the GROW ledger.**

**Phase 5 — Engagement loop (E1).** Non-economic KXP + forgiving streak (+ gentle wager/freeze),
instant "small-win" feedback on knowledge checks, educational leagues, proactive bot nudges. *Exit:*
none of it posts to the ledger; retention instrumentation in place.

**Phase 6 — Agent Campus (owner-requested 2026-06-25; staged LAST, after P2/P4/P5).**
Owner asked to expand the university into a multi-agent education system (centralized learner model +
specialised worker agents: admissions, roadmap, professor-delivery, assessment, study-coach,
student-success, compliance, librarian, career, certification, office-hours, analytics). **Finding:
~60–70% already exists** — don't fork a parallel system, fold it onto the existing substrate.
- **Already specced/built → maps to existing phases:** Domain model = `curriculum.yaml` (6 depts / 18
  courses / 3 degrees) + `data/assessments/*`; faculty personas = reconciled roster (Phase 0);
  Assessment agent = shipped `assessment_service.py` (Phase 1); Professor-delivery + Librarian +
  Compliance + grounded retrieval = **Master Grower bot** (Phase 4, `MasterGrowerProvider` ABC + 4
  read-only tool contracts + grounding/citation/refusal evals); Certification = `claim_degree` +
  degree effects; Study-coach + Student-success + nudges = **Phase 5**; Professor video = **Phase 2**.
- **Genuinely net-new (this phase's actual work):** (a) a **centralized Learner Model** as one
  persisted, single-writer state object (mastery_by_skill, misconceptions, engagement_score,
  risk_level, review_schedule, intervention_history) — additive migration; today this is scattered
  across course progress. (b) **Admissions + Roadmap** agents (intake quiz → personalised 7/14-day
  paths, prerequisite enforcement). (c) a **skills graph** distinct from courses (skill_id,
  prerequisites, mastery_scale, career_links). (d) **Orchestration layer** with one authoritative
  learner-state writer + an **audit log** of every recommendation/mastery-update/intervention. (e)
  **Career / Office-Hours / Analytics** agents.
- **Architecture rule:** each worker agent = a `services/` module behind a provider ABC with a
  deterministic **CI mock** (the Phase-4 pattern); rule-based orchestration first (no free-form agent
  debate), exactly matching the owner's stated principles. Cost: nearly every agent is a deterministic
  service (free, CI-mocked); only the professor LLM + HeyGen video carry real spend, both already gated.
- **Cheapest high-value first step:** the centralized Learner Model — it unlocks Roadmap/Coach/Success.
- ⚠️ **Owner decision needed (faculty names):** the new spec lists Professors Lex/Atlas/Verdant/
  Mycelia/Nova, but the **resolved roster is code-authoritative** (Flora/Lindqvist/Harlow/Okafor/
  Torres/Nance — see Owner decision #1 below, which retired the Verdant/Mycelia/Atlas/Nova set).
  Reconcile before building persona-facing surfaces: keep the shipped roster, or owner re-approves
  the new names. *Exit:* learner-state has one writer + audit log; admissions→roadmap path works on
  mocks in CI; no economy/ledger coupling; all behind the `university` flag.

**Cross-cutting — Figma design system (D1/D2).** Stand up the Figma library from the extracted tokens,
Code-Connect the new components, assemble the 7 §11 screens — runs alongside Phases 1–4.

### Owner decisions — RESOLVED (delegated to Claude as owner-proxy, 2026-06-24)
> The owner delegated these six calls. Recorded here as the working decisions; owner may override.
1. **Faculty roster → RESOLVED: code is authoritative.** Adopt the shipped `_DEPT_VOICES` roster
   (Professor Flora · Vera Lindqvist · Dr. Sage Harlow · Dr. Mira Okafor · Dr. Chem Torres · Dr. Petra
   Nance); retire Phase-2 §7's Verdant/Mycelia/Atlas/Nova. **`bio-101` → Professor Flora** (matches the
   §17 narration). **Give Dr. Sage Harlow a distinct voice** (currently shares Rachel with Flora).
   *(Phase 0 — executed docs-side 2026-06-24.)*
2. **3D fidelity → RESOLVED: stylized-botanical**, not photoreal; **stock GLTF set-dressing** to start;
   **zoom to the trichome microscope tier (T4)**; **stylized hall shell**. *(gates Phase 3)*
3. **Avatar sourcing → RESOLVED: HeyGen stock avatars first**, custom-trained faculty avatars later;
   keep `VideoPresenterProvider` swappable (no lock-in).
4. **Bot monetization → RESOLVED: adopt C2 verbatim.** Free game stays complete; **Master Grower+ ≈
   $6.99/mo** (Stripe web + app-store IAP); entitlement = a `pro` flag **fully decoupled from the GROW
   ledger**; payment built **last**, launch-gated.
5. **Explorer scope → RESOLVED: both, phased** — courses-first, then a standalone "study any strain"
   mode over the 29-strain encyclopedia (same engine).
6. **Lift the UNI-011 freeze → RESOLVED: NOT yet.** Hold until MVP ships (active critical-path-to-MVP).
   Pre-authorize the P0–P5 Build-Phase order to execute immediately post-MVP. **Only the docs-only
   Phase 0 (roster reconciliation) proceeds now.**

### Definition of done for *this* research pass
All 10 deliverables (A1–E2) authored, grounded in the real repo, web-sourced where external, committed
to `claude/immersive-university-research`. ✅ **Complete.**

## Loop discipline (self-imposed guardrails)
- **Freeze-safe:** documentation/design/research artifacts only. No code, no `curriculum.yaml`, no
  renderer, no economy/payment, **no PRs**.
- **Durable:** work on the `claude/*` branch and **commit each batch** (untracked files do not survive
  wake/checkout transitions).
- **Grounded:** every claim about the sim/genetics/anatomy cites the real repo file.
- **Honest:** if a tool/search fails, say so rather than fabricate.
- **One purpose per artifact;** cross-link siblings.

## Iteration log
- 2026-06-23 — Plan + ledger created; owner decisions locked; freeze-compatibility confirmed. (init)
- 2026-06-23 — **A1 done**: 3D classroom architecture decision doc.
- 2026-06-24 — **A2 done**: immersive-classroom design codex. Track A complete.
- 2026-06-24 — **B1 done**: AI-presenter pipeline; discovered narration is already shipped.
- 2026-06-24 — **Persistence failure diagnosed** (untracked artifacts lost on branch checkout across
  wakes). Switched to auto mode on `claude/immersive-university-research`, recreated A1/A2/plan,
  committing for durability.
- 2026-06-24 — **B2 · C1 · C2 · D1 · D2 · E1 · E2 done** in auto mode; each batch committed + pushed.
  **All 10 base deliverables (A1–E2) complete.**
- 2026-06-24 — **Track F depth pass (F1–F5) done**: 3D Explorer technical spec, cult-101 scripts,
  bio-101 assessment bank, bot system design, WCAG a11y gate. **15 docs total.** Further progress now
  gated on the 6 owner decisions (esp. lifting the UNI-011 freeze). Branch left for owner review (no PR).
- 2026-06-25 — **University Build Phase OPENED by owner** (full v1 scope; isolated on
  `claude/university-*` behind the `university` flag; MVP stays the protected priority). HeyGen video
  approved (~$140); Master Grower bot built **free** in v1 (no payment code). See DECISIONS.md
  2026-06-25. **Build Phase 0 ✅ done:** faculty roster reconciled — Dr. Sage Harlow given a distinct
  voice (Charlotte), `bio-101 → Professor Flora/cultivation`, stale roster notes resolved;
  `make check-memory` green, 62 narration tests pass. **Next: Build Phase 1** (course framework + bio-101).
- 2026-06-25 — **Build Phase 1 ✅ done & MERGED** (PR #72, squash → main as "Phase 0–1"). Owner
  switched to **merge-per-phase** cadence. Shipped: pure deterministic assessment grader
  (`services/assessment_service.py`), `bio-101` foundations course in `curriculum.yaml`, data-driven
  bank (`data/assessments/bio-101.yaml`), exam API (client-safe fetch + server-side grading, no key
  leakage), exam-attempt persistence (`AssessmentAttempt` + additive single-head migration) with
  mastery-gated completion, and the web quiz UI (all 5 item types + instant feedback). Backend 969
  passed; web 345 passed; all gates green. **Next: Build Phase 3** (3D Anatomy Explorer) on a fresh
  `claude/university-explorer-3d` branch — renderer over the pure `bud3d` modules, behind the flag.
- 2026-06-25 — **Build Phase 3 ✅ done & MERGED** (PR #73, squash → main). The **3D Anatomy
  Explorer** at `/university/explorer`, built as a renderer over the shipped pure `bud3d` generators
  (zero edits to the pure core): pure `chamber3d/explorer/parts.ts` (`buildExplorerInstances`,
  deterministic, draw-call-bounded to 3 InstancedMeshes); `AnatomyExplorer` R3F renderer with drei
  OrbitControls; LOD tiers (`tierForDistance` whole→cola→detail→trichome + live readout); part
  picking (instanced-mesh pointer events → labels); live grow-param sliders; and the five canonical
  lab presets. Behind the `university` flag; 11 explorer tests; web typecheck/lint/build/test green.
  A1 §9 fidelity defaults (stylized-botanical, zoom to T4) applied. **Next: persist the owner-asked
  Agent Campus plan (Phase 6 below), then Build Phase 2** (professor video / HeyGen — owner-gated).
