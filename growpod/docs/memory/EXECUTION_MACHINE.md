# 🔁 GrowVerse Execution Machine — the dynamic build loop

> **What this is.** The followable, self-sustaining loop that drives GrowVerse from where we are today
> to a shipped beta, **one branch at a time**. When you're ready to build, you (or Sonnet 5) start
> here: read the **Current Position** pointer, run the **Session Loop**, close out, advance the
> pointer. No guessing about "what's next" — this doc always says.
>
> Companion docs: [GROWVERSE_ROADMAP.md](GROWVERSE_ROADMAP.md) (the 22 phases + First 10 PRs) and
> [ARCHITECTURE_TRUTH.md](ARCHITECTURE_TRUTH.md) (verified baseline). The session ritual it plugs into
> is the Session Relay Protocol in `docs/SESSION_PROTOCOL.md` (handoff-audit → work → closeout).

---

## ▶️ Current Position (the live pointer — update every closeout)

- **Roadmap adopted:** 2026-07-06
- **Phases complete:** p01 (Architecture Truth) — *this documentation PR lands the audit, roadmap,
  and this machine.*
- **NEXT BRANCH:** `claude/gv-p02-game-loop-codex`
- **NEXT PR TITLE:** `feat(telemetry): codify game loops + in-txn event taxonomy`
- **Owner action pending before next kickoff:** none — cleared to start p02 on the owner's "go".
- **Carried risk into next branch:** none.

> **This block is the single source of "what's next."** Every `/closeout` updates it: tick the phase
> complete, set NEXT BRANCH / NEXT PR TITLE from the [First 10 PRs](GROWVERSE_ROADMAP.md) table (then
> the phase list beyond #10), and note any owner action or carried risk.

---

## The Session Loop (run this every build session)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 0. START     /handoff-audit  → independent auditor checks the last   │
│              PR's diff vs its claims, re-runs gates, reads this       │
│              pointer. Emits PASS / CONCERNS / FAIL + the NEXT ACTION. │
│ 1. CLAIM     Read Current Position → the NEXT BRANCH. Create it from  │
│              fresh main:  git fetch origin main &&                    │
│              git checkout -B claude/gv-pNN-slug origin/main           │
│ 2. SCOUT     (optional) launch depth-1 Explore agents to read ahead   │
│              read-only and de-risk. They may NOT edit any file.       │
│ 3. BUILD     Do exactly the one phase. Respect its "Do NOT touch".    │
│              Product code only within the active branch's scope.      │
│ 4. PROVE     Run the phase's gates (below). Green or don't merge.     │
│ 5. VERIFY    Exercise the change end-to-end (the `verify` skill /     │
│              capture-shots for visuals) — behavior, not just tests.   │
│ 6. CLOSEOUT  /closeout → gates green, reconcile BACKLOG, update THIS  │
│              pointer, rewrite the baton (docs/HANDOFF.md), open       │
│              EXACTLY ONE draft PR. Never [skip ci].                   │
│ 7. ADVANCE   On merge + green main, the pointer already names the     │
│              next branch. Loop back to 0.                             │
└─────────────────────────────────────────────────────────────────────┘
```

**One active branch at a time.** Never stack the next phase on an unmerged branch. Scouts read
ahead; they never edit ahead.

---

## Gates (the merge bar)

Every PR must be green on the gates its phase touches:

| Gate | Command | When |
|---|---|---|
| Memory integrity | `make check-memory` | every PR (docs always) |
| Lint | `make lint` | every backend PR |
| Backend tests + coverage | `make test` | any `src/` change |
| Alembic single-head + drift | (CI job) | any DB/model/migration change |
| Web checks | `typecheck · lint · build · vitest · e2e` | any `web/` change |
| Visual goldens | capture-shots promote | any chamber/visual change |

**Protected-surface gate** (adds to the above) — any diff touching `chain/`, settlement, withdrawal,
`data/balance.yaml` numbers, auth, or wallet UI requires, in the PR body: the Security-Reviewer
checklist, the owner's testnet click-test, and a transaction-watcher capture. See `docs/BUILD_RULES.md`.

---

## Standing rules (the rulebook the loop enforces)

1. **Branch naming:** `claude/gv-pNN-slug` (clusters `pNNa/pNNb`). Push only to `claude/*`.
2. **Depth policy:** depth-1 sub-agents by default; depth-2 only with a recorded owner approval in the
   PR; depth-3 forbidden. No recursive agent chaos.
3. **CI stays keyless:** always mock chain + mock AI in CI; never require a live key.
4. **Economy is owner-gated:** adding feature-flag *keys* is fine; changing `balance.yaml` *numbers*
   needs owner approval + an Economy Balancer sim report attached to the PR.
5. **Chain safety:** testnet only until the security pass (p13) + owner approval; every txn previewed;
   never rewrite funds-path math; never enable mainnet in a normal phase.
6. **Memory never lies:** if a phase changes a load-bearing fact, update
   [ARCHITECTURE_TRUTH.md](ARCHITECTURE_TRUTH.md) / ARCHITECTURE.md in the *same* PR; reconcile
   BACKLOG.md every shipping session; append the *why* to DECISIONS.md.
7. **Stop-and-ask** on protected surfaces or a real fork where owner taste decides (per the
   delegation charter in `CLAUDE.md`).
8. **Report format:** end every status update with Asked / Done / Needs you.

---

## Kick-off procedure (when the owner says "go")

1. Confirm main is green (last merged PR's CI).
2. `/handoff-audit` to validate the baton + this pointer.
3. Read **Current Position → NEXT BRANCH** and create it from fresh `main`.
4. Run the **Session Loop** for that one phase.
5. `/closeout`, advance the pointer, open one draft PR.
6. Repeat. The machine keeps itself pointed at the next move.

> First real build branch after this documentation PR: **`claude/gv-p02-game-loop-codex`**.

---

## Ready-to-paste next prompt (for Sonnet 5)

> **Start GrowVerse `claude/gv-p02-game-loop-codex`.** Run `/handoff-audit` first. Then create the
> branch from fresh `main`. Deliver Phase 2 from [GROWVERSE_ROADMAP.md](GROWVERSE_ROADMAP.md): write
> `docs/memory/design/GAME_LOOPS.md` (the 30-sec/5-min/daily/weekly/seasonal beats against existing
> systems + mercy mechanics), add a lightweight `telemetry` table + Alembic migration + service hooks
> in the existing GameService action handlers (server-side, events post inside the same transaction as
> the action), and tests proving ≥12 events fire. Do NOT touch `balance.yaml` values or the sim engine
> internals. Run `make test`, `make lint`, `make check-memory` and the alembic checks. Then `/closeout`:
> reconcile BACKLOG, update the Current Position pointer in this file, rewrite the baton, open exactly
> one draft PR titled `feat(telemetry): codify game loops + in-txn event taxonomy`, and report Asked /
> Done / Needs you.

---

*This machine is the p21 deliverable, seeded early so the build can start the moment the owner says
"go." Keep the Current Position block honest — it is the heartbeat of the loop.*
