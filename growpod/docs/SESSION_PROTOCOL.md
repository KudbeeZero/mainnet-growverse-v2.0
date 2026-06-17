# Session Relay Protocol (GROWv2)

> **One chat = one audited, mergeable unit of work.** The handoff between chats is a
> *verified artifact*, not trust. This protocol sits on top of the Layer 0–4 memory
> system (see `docs/memory/README.md`); it does not replace it. The baton
> (`docs/HANDOFF.md`) is the live tip of that stack — what the *next* chat does first.

## The loop

```
chat start ──▶ /handoff-audit ──▶ PASS ─▶ merge prev PR, cut new branch ─▶ work
                   │                CONCERNS ─▶ ask the owner
                   │                FAIL ─▶ do not merge; fix or hand back
                   ▼
                work the ONE scoped item (from the baton's NEXT ACTION)
                   ▼
chat end ────▶ /closeout ──▶ tests green + memory check + ONE PR + rewrite baton
```

- **Start every chat with `/handoff-audit`.** It reads the baton + memory, confirms the
  previous PR's CI is green, then spawns an **independent auditor** that does **not** trust
  the PR's prose: it checks the diff against every claim with `file:line` evidence, runs the
  suite, and flags scope creep. It emits **PASS / CONCERNS / FAIL**.
- **End every chat with `/closeout`.** It commits, ensures the gates are green, asks the
  handoff questions, opens **exactly one** PR, and rewrites the baton. It **never** uses
  `[skip ci]`.
- **One chat = one PR.** If the work splits, the baton's NEXT ACTION names the next chat's
  single item; it does not get done in this one.

## Definition of done (improvement 1 — enforced, not verbal)

A step is **not done** until **all three** hold. A verbal "looks good" does not advance it.

1. **Tests green** — `make test` passes (coverage gate included), `make lint` clean, and
   `make check-memory` clean. Web changes also pass `cd web && npm run typecheck && npm run
   lint && npm run build` (and `test:e2e` if the loop UI changed).
2. **Auditor passed** — `/handoff-audit` returned **PASS** for the PR that delivered the step
   (CONCERNS that the owner explicitly waived counts; FAIL never does).
3. **Baton's NEXT ACTION is filled** — `docs/HANDOFF.md` names the next single scoped item,
   with its scope / risks / off-limits. An empty NEXT ACTION means the relay is broken.

## Carried-risks ledger (improvement 2)

`docs/HANDOFF.md` carries a standing **OPEN RISKS (carried)** section that **persists across
chats**. A risk only clears when it is **VERIFIED FIXED — test-backed**, never because it was
merely "mentioned" or "looks handled." Every closeout re-states the ledger; every audit checks
that nothing silently dropped off it.

## Device-verifiable vs agent-verifiable (improvement 3)

Every handoff **separates** what the owner must test by hand from what the agent proved with
tests, because GROWv2 has real seams the test suite cannot cross:

| Agent-verifiable (proven by CI/tests this session) | Device/human-verifiable (owner must confirm) |
|---|---|
| `pytest` suite + coverage gate; `make lint`; `make check-memory` | Live Replit deploy onboarding (build-time `NEXT_PUBLIC_*` baking) |
| Web `typecheck`/`lint`/`build`; Playwright e2e on the **mocked** API | Real Algorand **TestNet** mint + on-chain confirm (chain is mocked in CI) |
| Chain/economy logic against the **Mock** provider | Real **Pera/WalletConnect** signature on a live device |
| AI advisor/auto-care against the **mock** loop | Real **Claude** advisor outputs with a prod key |

The baton must fill **both** columns for the work it hands off. "Green in CI" is not "works on
the device."

## Reply format (improvement 4)

In-chat replies use: **Summary** (does it work?) → **Next** (do I test it by hand, or what's
next?). Keep explanations short unless the owner asks for depth.

## How this maps onto the memory layers

| Protocol artifact | Memory layer it feeds |
|---|---|
| `docs/HANDOFF.md` (baton) | the live tip of Layer 4 (standups) — what the next chat does first |
| `/closeout` | writes the baton + (when a day's work closes) a Layer-4 standup; promotes invariant changes up to Layer 0/1 in the **same** PR |
| `/handoff-audit` | reads Layers 0–4 + the baton; verifies the prior PR against them |
| `docs/audits/` | per-PR evidence; the receipts behind a PASS/CONCERNS/FAIL |
| OPEN RISKS ledger | sourced from `docs/memory/BACKLOG.md`; a risk that becomes durable truth is promoted to ARCHITECTURE/DECISIONS |

Memory integrity is still enforced by `make check-memory` (when `scripts/check_memory.py` is
present — see the carried-risks ledger for the current gap).
