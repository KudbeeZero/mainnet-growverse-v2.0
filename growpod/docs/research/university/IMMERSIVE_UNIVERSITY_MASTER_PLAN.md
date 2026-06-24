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
- 🔨 **B2** `docs/research/university/courses/bio-101-lecture-scripts.md` — author the canonical
  `bio-101` ("Foundations of Plant Biology", Professor Flora) lecture/narration scripts to Master
  Report §17 (orientation + 4 modules), honest-hour budgeted, transcript-ready.

### Track C — GrowVerse Master Grower AI Bot (knowledge mapping + monetization plan)
- ⬜ **C1** `docs/research/2026-06-23-master-grower-bot-knowledge-graph.md` — map the knowledge corpus
  (`knowledge/*`, encyclopedia, sim rules, genetics) into a retrieval/grounding layer; reuse the
  existing Master Grower advisor stack; guardrails; CI-safe.
- ⬜ **C2** `docs/memory/design/09-master-grower-bot.md` — product design + **monetization PLAN
  (no code)**: free vs. paid boundary respecting "earned, never bought"; tiers; entitlement model to
  build later; trust/safety.

### Track D — Figma Design System (GrowVerse University)
- ⬜ **D1** Design-system rules from the `web/` codebase → `docs/research/university/figma-design-system-rules.md`.
- ⬜ **D2** `docs/research/university/figma-university-design-system.md` — token + component spec for
  the classroom/course/lecture/bot UI, mapped to `web/src/components/ui/`.

### Track E — Synthesis & Competitive Edge
- ⬜ **E1** `docs/research/2026-06-23-edtech-competitive-analysis.md` — what makes the *best*
  immersive/edu experiences (Duolingo, Labster, Foldit, …); tactics to adopt; what "best in category" must beat.
- ⬜ **E2** Final consolidation pass: fold A–E into a phased, owner-gated University Build Phase
  sequence with acceptance criteria.

---

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
  committing for durability. Next: B2.
