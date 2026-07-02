# 11 — Personalized Experience + the Global Learning Memory

> Owner directive (2026-07-02): *every user gets a different experience based on what they're
> learning at the university — and the teacher gets smarter: anything any user generates flows
> into a global memory layer every player benefits from. Never lose the generative information
> users create.* This doc is HOW. It composes what already exists (design/06–10) — no rewrite.

## The two halves

**A. Personal (each player sees a different school).** The per-player learner model is already
the single audited source of truth (`LearnerProfile` + `LearnerEvent`, mastery fixed
2026-07-02). Personalization = feeding it into every surface:

1. **Persist + consume the admissions recommendation** (HERMES open-work #2 — the entry point
   of personalization; today it's display-once).
2. **A `personal_context` assembler** (read-only service): mastery-by-skill, current track,
   risk level, streak, active plants → one dict.
3. **Feed it everywhere:** the Professor's lecture context (plant context already flows; add
   mastery so the lecture leans on what the student knows), Master Grower grounding, catalog
   ordering ("your recommended track" first), My Path nudges. HARD RULE: personalization
   changes TEXT, ordering, and coaching — never the produced-once course audio (that stays one
   canonical MP3 per course) and never economy values.

**B. Global (the teacher gets smarter — never lose generative data).** A shared, append-only
knowledge layer that captures every generative artifact and feeds it back through retrieval:

1. **Capture — `knowledge_events` table (append-only, never deleted):** one row per artifact —
   Master Grower Q&A (question, answer, citations), lecture deliveries, exam item results
   (per-item correct/incorrect), advisor diagnoses + the care actions taken + the plant's
   measured response, breeding discoveries. Provenance keeps `player_id`, but retrieval strips
   it — shared knowledge is ANONYMOUS by construction (no PII, no wallet linkage).
   Writer: a `KnowledgeService.append()` single writer, mirroring the learner model's audited
   single-writer invariant. Writes hook the existing call sites (master_grower_service.ask,
   lecturer_service.teach, submit_exam, advisor auto-care) — additive, no behavior change.
2. **Retrieve — the flywheel:** `search_global_knowledge(query)` joins `MasterGrowerTools` as
   a read-only grounding source, and a compact "what students struggle with / what worked"
   digest joins the lecture context. This is design/09's RAG-over-corpus, finally fed by live
   player data: every question any player asks makes the next answer better for everyone.
3. **Aggregate — insights:** periodic rollups into `global_insights` (most-missed exam
   objectives per course; care patterns correlated with health gains per strain; FAQ clusters).
   Surfaced to players ("the class struggles with flushing — here's the Professor's tip") and
   to the owner (curriculum gaps → which assessment bank to write next).
4. **Never lose it:** DB-authoritative (Postgres), append-only, covered by the backup work
   (SECURITY.md backups item). The chain stays a mirror; knowledge is NOT on-chain.

## Build order (each phase ships alone, additive)

| Phase | What | Touches | Status |
|---|---|---|---|
| P1 Capture | `knowledge_events` migration + `KnowledgeService.append` + hooks at the generative call sites | db/models, services (additive) | ✅ **built 2026-07-02** — migration `4f2e8ab64721`; hooked at 3 of the 4 listed sites: `MasterGrowerService.ask` (skips `report.refused`), `LecturerService.teach` (cache-MISS only — a cache-hit replay is not a new artifact), `UniversityService.submit_exam` (every grade). Advisor auto-care is the one remaining, unhooked site (deferred — no owner-directed urgency yet; tracked in BACKLOG). |
| P2 Personal | admissions persistence + `personal_context` assembler → lecture + Master Grower contexts | learner model (audited writer), lecturer/master-grower context assembly | ⬜ not started |
| P3 Retrieve | `search_global_knowledge` tool → MasterGrowerTools + lecture digest | ai/provider tools, services | ⬜ not started |
| P4 Insights | `global_insights` rollups + Professor "class stats" surface + owner dashboard card | services, web | ⬜ not started |

## Invariants (must not drift)

- University stays NON-ECONOMIC; knowledge capture posts nothing to the ledger.
- `LearnerModelService.apply` and `KnowledgeService.append` are the only writers of their
  tables (audited, append-only).
- Produce-once audio is untouched by personalization; per-player variation lives in text/UI.
- Retrieval never exposes another player's identity; provenance is internal-only.
- Mock providers in CI: retrieval tools return deterministic fixtures without a key.
