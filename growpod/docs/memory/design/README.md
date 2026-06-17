# 🧭 Design Codex — the vision layer

The **Design Codex** is the "where we're going" companion to ARCHITECTURE's "where we are." It holds
the deep design intent for the systems that make GROWv2 different — a scientist-grade grow
simulation, generative genetics with endless possibility, grower-skill mastery, and time as the
real axis of play — written so a future session can build toward the vision without re-inventing it.

It is **not** a status report and **not** an invariant list. ARCHITECTURE.md says what must not
break *today*; the codex says what we are *building toward*. When a planned capability ships, its
tag flips here and — if it moved an invariant — ARCHITECTURE/CLAUDE update in the **same** change.

## Where it sits in the memory map
```
Layer 0  CLAUDE.md            identity · invariants · how to work        ← always loaded
Layer 1  ARCHITECTURE.md      system map · the "don't break" list        (where we are)
   ↳     design/  (this)      deep design intent · the moat · the target (where we're going)
Layer 2  DECISIONS.md         append-only "why" log (ADRs)
Layer 3  BACKLOG.md           prioritized work — now / medium / low
Layer 4  standups/            dated LUT round-table reports
```
The codex is **low-volatility, vision-forward**. It sits beside Layer 1: read ARCHITECTURE to learn
the rules, read the codex to learn the ambition. Build work still flows through BACKLOG; the codex
only *proposes* the shape of that work.

## Current-state tags — read these honestly
Every capability in this codex is tagged so the docs never oversell what exists:

| Tag | Meaning |
|----|---------|
| ✅ built | Implemented and tested in the codebase today (a real path is cited). |
| 🔨 partial | Partly there — a thin version exists; the deep version is the target. |
| ⬜ planned | Design intent only. Not built. Do not describe it as if it works. |

A `✅ built` claim must cite a real file. A `⬜ planned` claim must never be quoted elsewhere as a
shipped feature (especially anything on-chain — the chain layer is mocked; see `DECISIONS.md`).

## The docs
| # | File | What it covers |
|---|------|----------------|
| — | `00-game-vision.md` | The global design + **the moat** (why this is proprietary) + the signature visual language. Start here. |
| 1 | `01-simulation-horticulture.md` | The scientist-grade agronomy model — every variable a grower wants — phased over the current lean engine. |
| 2 | `02-genetics.md` | Endless, generative, ownable genetics: from today's 14-trait model toward an unbounded genome + provenance. |
| 3 | `03-grower-skills.md` | Mastery + time as the design axis: grower skill trees, the knowledge economy, the equipment bridge. |
| 4 | `04-honesty-and-trust.md` | The trust layer: provable fairness, a transparent economy, an honest AI advisor, co-evolution with the model line. |
| 5 | `05-events-and-competition.md` | The seasonal Cannabis Cup: deterministic judging + lifetime champion rewards (trophy strain, permanent title, Hall of Fame). |
| 6 | `06-university.md` | GrowPod University: classes, time + practical study, degrees (permanent perks + title), and the AI Professor's lectures. |
| — | `assets/` | Visual-influence references (e.g. the genetic-constellation aesthetic). |

## Maintenance
1. **Tag everything.** No untagged capability claims. Cite a path for every ✅.
2. **Don't let it drift into status.** Day-to-day progress lives in standups/BACKLOG, not here.
3. **Flip tags in the same change that ships the work**, and update ARCHITECTURE/CLAUDE if an
   invariant moved — same discipline as the rest of the memory system.
4. **Keep the moat honest.** The proprietary thesis in `00` leans on planned (⬜) systems; label
   them as such so nobody markets vapor.
