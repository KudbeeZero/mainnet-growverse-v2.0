# Global Evidence + Memory Layer (GROWv2)

> **The decision framework that sits above the other charters.** Before an agent
> recommends, builds, or merges anything, it reconciles three things — **project memory**,
> **current repo evidence**, and **decision confidence** — and reports findings with fixed
> risk/confidence labels. This file governs *how to reason*; [`BUILD_RULES.md`](BUILD_RULES.md)
> governs *what is safe to change*; [`SESSION_PROTOCOL.md`](SESSION_PROTOCOL.md) governs *the
> handoff between chats*; `CLAUDE.md` + `docs/memory/` hold the *truth being reasoned over*.
> Where they overlap they agree by design — this file is the loop that ties them together.

## Prime directive

```
Align memory and evidence before you recommend.
Never rely on memory alone.    (the baton can be stale — the code wins)
Never act on evidence alone.   (a green diff can still violate a prior decision)
The right answer is where both agree — proven, labeled, and owner-gated.
```

The goal is not just to finish the task. The goal is to make the owner confident the agents
are making the **right choice for the right reason**.

## The three alignments (do all three, in order, before recommending)

1. **Project memory / prior handoffs — what was already decided?**
   Read the baton ([`HANDOFF.md`](HANDOFF.md)) and its **OPEN RISKS (carried)** ledger,
   [`DECISIONS.md`](memory/DECISIONS.md), and [`CANONICAL_STATE.md`](memory/CANONICAL_STATE.md).
   Establish: what was **approved / rejected / blocked /
   deferred**, which **owner preferences and invariants** already exist, and the **closeout
   format / workflow rules** that must be respected.
2. **Current repo evidence — what do the files actually show now?**
   The active branch; the diff vs `origin/main`; which tests, scripts, migrations, docs, and
   workflows actually exist; what is **verified by command output**. Cite `file:line`. Do not
   trust prose — re-derive from the code (this is the `/handoff-audit` discipline applied to
   *every* finding, not just the prior PR).
3. **Decision confidence — how sure are we, really?**
   For each finding separate **proven** from **inferred** from **unknown** from **unsafe to
   assume** from **needs owner approval**. Assign a label (below). Memory alone and evidence
   alone are both insufficient; the answer comes from **matching both**.

## The label set

Risk is `LOW / MED / HIGH` (as in the carried-risks ledger). Every finding also carries one
**state label**:

| Label | Meaning |
|---|---|
| **Verified** | Proven by command output / a test / `file:line` *and* consistent with memory. |
| **Partially verified** | Some evidence exists, but a claim or path is still unchecked. |
| **Memory-aligned** | Matches a prior decision/handoff note (cite it) — and evidence agrees. |
| **Memory conflict** | Evidence contradicts the baton / DECISIONS / an invariant. **Stop and surface it** — the code wins, but the conflict is the finding. |
| **Not enough evidence** | Can't confirm from current repo state; say what command/file would settle it. |
| **Needs owner decision** | Resolution requires a human call (see the gates below). |
| **Unsafe to proceed** | Acting now risks data, money, an invariant, or irreversible state. Halt. |

## Per-finding template

Every major finding reports, in this order:

- **Evidence** — `path:line` or the exact command run + its output.
- **Memory alignment** — confirms / conflicts with which handoff note or decision (name the doc).
- **Risk** — `LOW / MED / HIGH`.
- **Confidence** — one label from the set above.
- **Next action** — the single recommended step.

**Worked example:**

> **Finding — feature flags are single-source.**
> *Evidence:* `src/growpodempire/feature_flags.py:1`; `grep feature_required api/*.py` → 25 hits;
> `make test` → 287 passed. *Memory alignment:* confirms HANDOFF.md NEXT ACTION + DECISIONS
> 2026-06-14 (PR #63, CEO-ratified). *Risk:* LOW. *Confidence:* **Verified**. *Next action:* none —
> do **not** reopen the flag architecture (owner gate).

## The loop

```
memory ──▶ evidence ──▶ risk ──▶ verification ──▶ owner decision ──▶ next goal
  │           │                       │                                  │
HANDOFF +   file:line +          agent-vs-device              the baton's NEXT ACTION
DECISIONS   command output        split (below)               (the bigger/better goal)
```

## Owner-decision gates

`Needs owner decision` and `Unsafe to proceed` map to the **exact** stop-list in
`CLAUDE.md` ("Owner delegation charter") — do not redefine it here. In short, **stop and ask
only for:** real money / chain settlement / treasury actions; deleting data or rewriting git
history; player-facing economy changes (faucets / sinks / prices); anything that contradicts
an invariant in `CLAUDE.md`; or a genuine fork where rework is large and owner taste decides.
Everything else: decide the small tradeoff, note it in one line, and proceed.

## How this maps onto the existing stack (it unifies — it does not duplicate)

| Loop step | Where it already lives (use it; don't re-implement) |
|---|---|
| **memory** | [`HANDOFF.md`](HANDOFF.md) baton + carried-risks ledger; `docs/memory/` Layers 0–4; `DECISIONS.md`; `CANONICAL_STATE.md`. |
| **evidence** | `/handoff-audit`'s "don't trust prose; check the diff at `file:line`"; per-PR receipts in `docs/audits/`. |
| **risk** | the **OPEN RISKS (carried)** ledger in [`HANDOFF.md`](HANDOFF.md) — a risk clears only when VERIFIED FIXED (test-backed). |
| **verification** | the **device-vs-agent split** in [`SESSION_PROTOCOL.md`](SESSION_PROTOCOL.md) — "green in CI" is not "works on the device." |
| **owner decision** | the stop-list in `CLAUDE.md` (Owner delegation charter) + the Director/owner decisions logged in [`HANDOFF.md`](HANDOFF.md). |
| **next goal** | the baton's single **NEXT ACTION** — the bigger/better next goal the next chat does first. |

## Closeout

End every chat with the **exact Asked / Done / Needs you** format defined in `CLAUDE.md`
(do not redefine it here). Under this layer, **Done** carries only Verified / Partially
verified findings, and any Memory conflict / Needs owner decision / Unsafe-to-proceed item
goes under **Needs you**. The repo-facing closeout (baton rewrite, audit receipt) is the
`/closeout` skill per [`SESSION_PROTOCOL.md`](SESSION_PROTOCOL.md).
