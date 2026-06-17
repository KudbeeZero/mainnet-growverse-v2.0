# GROWv2 Memory Layers

A small, deliberate **memory system in Markdown** so any session (human or agent) can pick the
project up cold and not break it. The idea: separate *stable truth* from *volatile work* so the
stable layer can be trusted and the volatile layer can churn.

> **Start at `MAP.md`** — the master index (layer map + code↔doc index + moat build-state dashboard).
> Integrity is enforced by `scripts/check_memory.py` (`make check-memory`, and CI on every push).

## The layers

```
Layer 0  CLAUDE.md (repo root)        identity · invariants · how to work   ← always loaded
Layer 1  ARCHITECTURE.md              system map · module boundaries · the "don't break" list
   ↳     design/                      Design Codex — deep vision/intent (the moat · sim & genetics targets)
Layer 2  DECISIONS.md                 append-only log of *why* (lightweight ADRs)
Layer 3  BACKLOG.md                   prioritized work — immediate / medium / low
Layer 4  standups/YYYY-MM-DD-*.md     dated LUT round-table reports (the daily ritual)
```

**ARCHITECTURE vs the Design Codex.** ARCHITECTURE.md is *where we are* — the invariants that must
not break today. `design/` is *where we're going* — the deep design intent for the simulation,
genetics, and mastery that make GROWv2 different, written vision-forward with every capability tagged
`✅ built · 🔨 partial · ⬜ planned`. The codex only *proposes* the shape of work; it becomes real
through BACKLOG. See `design/README.md`.

Read **top-down**: Layer 0 is short and stable; each layer down is more detailed and more
volatile. Write **bottom-up**: new facts land in a standup or the backlog; when a fact becomes
*permanent truth* it gets promoted up into ARCHITECTURE or CLAUDE.md, and the decision behind it
is recorded in DECISIONS.

## Maintenance rules
1. **Layer 0 stays short.** If `CLAUDE.md` is getting long, push detail down to Layer 1.
2. **ARCHITECTURE describes invariants, not features.** "The chain mirrors the DB" belongs here;
   "added a leaderboard" does not.
3. **DECISIONS is append-only.** Don't rewrite history; supersede an entry with a newer one.
4. **BACKLOG is the single source of priority.** A standup may *propose* items; they aren't real
   until they land in BACKLOG.
5. **One standup per working day**, named `standups/YYYY-MM-DD-lut-report.md`. It is a snapshot in
   time — never edit an old one; write a new one.
6. When you finish a unit of work, ask: *did this change an invariant?* If yes, update Layer 0/1
   in the **same** change so memory never lies.

## What "LUT report" means
The **LUT report** is this project's daily round-table standup: every specialty (backend, sim,
economy, genetics, chain, AI, web, QA, DevOps, security, docs, product) reports what shipped the
day prior, what was missed, and what's next. It's the Layer-4 ritual that keeps the higher layers
honest.
