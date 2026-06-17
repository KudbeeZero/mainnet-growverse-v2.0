---
name: closeout
description: Run at chat END under the Session Relay Protocol. Commits the work, ensures the gates are green (make test / make lint / make check-memory, plus web checks if touched), asks the handoff questions, opens EXACTLY ONE PR, and rewrites the baton (docs/HANDOFF.md) including the carried-risks ledger and the device-vs-agent verification split. Never uses [skip ci]. Use when finishing a GROWv2 work session, or when the user types /closeout.
---

# /closeout — hand the baton off as a verified artifact

You are at the **end** of a chat under the Session Relay Protocol
(`docs/SESSION_PROTOCOL.md`). The goal: leave exactly one mergeable, audited PR and a baton the
next chat can trust.

## 1. Gates must be green (definition of done)
Run and confirm — do not hand off on red:
- `make test` (suite + coverage gate), `make lint`, `make check-memory`.
- If web changed: `cd web && npm run typecheck && npm run lint && npm run build`
  (+ `npm run test:e2e` if the core loop UI changed).
- If a gate is currently itself broken (e.g. a missing script), say so explicitly and record
  it in the carried-risks ledger rather than papering over it. **Never** `[skip ci]`.

## 2. Memory hygiene (same PR as the code)
- If this work changed an **invariant**, update Layer 0/1 (`CLAUDE.md` /
  `docs/memory/ARCHITECTURE.md`) in **this** PR so memory never lies.
- Record the *why* in `docs/memory/DECISIONS.md` (append-only) if a decision was made.
- Reconcile `docs/memory/BACKLOG.md` (mark items done/doing) — and never leave a false ✅.
- If a working day closed, write a Layer-4 standup `docs/memory/standups/YYYY-MM-DD-lut-report.md`.

## 3. Ask the handoff questions
Use `AskUserQuestion` to settle, at minimum:
- What is the **single NEXT ACTION** for the next chat (scope / risks / off-limits)?
- Which OPEN RISKS are now **VERIFIED FIXED** (test-backed) vs. still carried?
- What must the owner verify **by hand** (device-verifiable) vs. what the agent proved?

## 4. Commit + open EXACTLY ONE PR
- Commit on the active branch with a clear message (no model identifiers in the message).
- Push with `git push -u origin <branch>` (retry with backoff on network errors only).
- Open **one** PR via the GitHub MCP tools (load via ToolSearch: `create_pull_request`). PR
  body states what shipped, the gate results, and the **device-vs-agent verification split**.
- Do not open a second PR. If work splits, it goes in the baton's NEXT ACTION, not a new PR.

## 5. Rewrite the baton
Rewrite `docs/HANDOFF.md` so the next chat starts informed:
- Last rewritten / branch / **open PR number** (awaiting audit) / prev audit status.
- **NEXT ACTION** filled (never empty — an empty NEXT ACTION breaks the relay).
- "What THIS chat did" + the **verification split** (agent-verifiable vs device-verifiable).
- **OPEN RISKS (carried)** re-stated: clear a risk only if VERIFIED FIXED (test-backed);
  add any new findings from this chat.

Reply in the protocol format — **Summary** (does it work? PR # + gate status) → **Next** (what
the owner tests by hand, and the NEXT ACTION for the next chat). Keep it short.
