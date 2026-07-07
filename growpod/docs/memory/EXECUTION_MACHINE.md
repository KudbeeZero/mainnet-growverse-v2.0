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

- **Roadmap adopted:** 2026-07-06 · **90-day owner re-sequencing adopted 2026-07-07:**
  [ROADMAP_90D_2026Q3.md](ROADMAP_90D_2026Q3.md) now sequences the next 12 weeks (owner-priority
  `gv-oNN` branches first, gv phases p02/p03/p05 folded into month 3); evidence in
  [AUDIT_NFT_STORE_LOOP.md](AUDIT_NFT_STORE_LOOP.md). After week 12 the 22-phase order resumes.
- **Phases complete:** p01 (Architecture Truth). Weeks 1–2/3 (PRs #171, #172) merged, both
  audited PASS. Week 4 (`gv-o03-pod-equipment-visuals`) built this session — draft PR open,
  gates green — awaiting the next `/handoff-audit` to confirm and merge. Also fixed an
  owner-reported desktop layout bug on the same page (chamber wasn't top-aligned with the side
  rails) while in there.
- **NEXT BRANCH:** `claude/gv-o04-cure-mint-integrity` (ROADMAP_90D week 5)
- **NEXT PR TITLE:** (not yet named — pick one reflecting the actual seams fixed, e.g.
  `fix(mint): cure/mint state machine can't strand, lie, or pay zero`)
- **Owner action pending before next kickoff — STOP, do not build week 5 without these:**
  week 5 is a **protected-surface week** (touches the mint path + a faucet number:
  `reward_pct`). Two owner decision gates block it, per ROADMAP_90D §3 week 5:
  - **D2** — the owner must approve the staking reward number/formula (appraised value ×
    `reward_pct`) BEFORE code is written; attach an Economy Balancer sim to the PR.
  - **D3** — the owner must confirm the cure clock moves to the player-effective (turbo) clock
    with a wall-clock floor.
  Also required: a Security-Reviewer checklist + owner sign-off in the PR body (BUILD_RULES.md
  protected-surface gate). Record both decisions in `docs/memory/DECISIONS.md` once given.
- **Carried risk into next branch:** none.

> **`docs/HANDOFF.md` stays the single source of truth for what the next chat does first** (per its
> own header). This block is the roadmap-phase-level detail behind that pointer — the mechanics of
> *which branch/PR is next in the 22-phase sequence*. Every `/closeout` updates **both**: this block
> (tick the phase complete, set NEXT BRANCH / NEXT PR TITLE from the
> [First 10 PRs](GROWVERSE_ROADMAP.md) table, then the phase list beyond #10, note any owner action
> or carried risk) **and** HANDOFF.md's header, so the two never disagree. If they ever do disagree,
> HANDOFF.md wins — fix this block to match it.

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
`data/balance.yaml` numbers, Alembic migrations, auth, wallet UI, or lockfiles requires, in the PR
body: the Security-Reviewer checklist, the owner's testnet click-test, and a transaction-watcher
capture. This must always match `docs/BUILD_RULES.md` and `CLAUDE.md`'s "Build safely" list — if
they ever diverge, treat it as a bug in this doc and fix it here.

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

> **Start the 90-day plan: `claude/gv-o01-store-correctness`** (week 1 of
> [ROADMAP_90D_2026Q3.md](ROADMAP_90D_2026Q3.md) — its §2 has the full spec and per-branch prompt;
> evidence in [AUDIT_NFT_STORE_LOOP.md](AUDIT_NFT_STORE_LOOP.md)). Run `/handoff-audit` first, create
> the branch from fresh `main`, deliver exactly the week-1 slice, run the gates, `/closeout` with one
> draft PR, then continue down the ROADMAP_90D schedule (second slots per §1b when a week's primary
> merges early).
>
> **End-of-session contract (owner, 2026-07-07 — binding on every session):** ROADMAP_90D §7b. At
> the end of the day: (1) **`main` is green** — if it's red, fixing it preempts everything; (2) the
> **Session Loop is fully closed** (gates → verify → closeout → pointer/baton/BACKLOG); (3)
> **everything is pushed** — zero unpushed commits (`git status` clean,
> `git log origin/<branch>..<branch>` empty), every PR open on github.com with a current body, so
> the owner sees on the GitHub website the exact same repo state that exists locally; (4) nothing
> silently parked — blocked work is still pushed, with the blocker named in the PR body and baton.
> Report Asked / Done / Needs you.

---

*This machine is the p21 deliverable, seeded early so the build can start the moment the owner says
"go." Keep the Current Position block honest — it is the heartbeat of the loop.*
