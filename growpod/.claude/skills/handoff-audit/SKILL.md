---
name: handoff-audit
description: Run at chat START under the Session Relay Protocol. Reads the baton (docs/HANDOFF.md) and the Layer 0-4 memory, confirms the previous PR's CI is green, then spawns an INDEPENDENT auditor that does NOT trust the PR's prose - it checks the diff against every claim with file:line evidence, re-runs the gates, flags scope creep, and checks the carried-risks ledger. Emits PASS / CONCERNS / FAIL and the single NEXT ACTION. Use when starting a GROWv2 work session, or when the user types /handoff-audit.
---

# /handoff-audit — verify the baton before doing anything

You are at the **start** of a chat under the Session Relay Protocol
(`docs/SESSION_PROTOCOL.md`). Do **not** merge anything or start new feature work until this
audit reports and the owner approves on CONCERNS/FAIL.

## 1. Load the baton + memory
- Read `docs/HANDOFF.md` (the baton): active branch, open PR awaiting audit, NEXT ACTION,
  the verification split, and the **OPEN RISKS (carried)** ledger.
- Read Layer 0–1: `CLAUDE.md`, `docs/memory/ARCHITECTURE.md`. Skim `docs/memory/BACKLOG.md`
  for the current priority and `docs/memory/MAP.md` for the code↔doc index.
- **Backlog freshness check** (owner directive 2026-07-02): if `BACKLOG.md`'s
  `Last reconciled` date predates work you can see merged on `main` (or is >14 days behind
  HEAD — `make check-memory` enforces this), the previous session skipped its closeout duty:
  report it as a finding and reconcile the backlog as part of this session's work.

## 2. Confirm the previous PR's CI is green
- Identify the open PR from the baton. Using the GitHub MCP tools (load via ToolSearch:
  `pull_request_read`, `actions_list`/`get_job_logs`), confirm its CI is **green**.
- If CI is red or pending, that alone caps the verdict at **CONCERNS** (red) — report it.

## 3. Spawn an INDEPENDENT auditor (does not trust the PR prose)
Use the `Agent` tool (`general-purpose`) with a prompt that:
- Diffs the PR (`git fetch` the branch; `git diff <base>...<head>`).
- For **every** claim in the PR body and the baton's "What THIS chat did", finds `file:line`
  evidence in the diff that it is true. Claims without evidence are flagged.
- Re-runs the gates: `make test` (suite + coverage), `make lint`, `make check-memory`. If web
  was touched: `cd web && npm run typecheck && npm run lint && npm run build` (+ `test:e2e`
  if the core loop UI changed).
- Flags **scope creep**: any file changed outside the baton's declared scope/NEXT ACTION.
- Checks the **carried-risks ledger**: did any OPEN RISK silently disappear? Is any risk
  marked FIXED **without** a test backing it? Either is a finding.
- Verifies the **definition of done** (tests green AND audit clean AND NEXT ACTION filled).
- Writes the report to `docs/audits/PR-<n>-<slug>.md` from `docs/audits/TEMPLATE.md`.

## 4. Emit the verdict + the single NEXT ACTION
Report in the protocol reply format — **Summary** (PASS / CONCERNS / FAIL + one-line reason)
→ **Next** (the single NEXT ACTION from the baton, or the owner question on CONCERNS):
- **PASS** → safe to merge the prev PR and cut a new branch for the NEXT ACTION. Do the merge
  only after stating it; never merge on FAIL.
- **CONCERNS** → ask the owner with `AskUserQuestion`, include enough context to answer
  without scrolling.
- **FAIL** → do **not** merge. State what failed and hand back.

Keep it short. The audit report holds the detail; the chat reply holds the verdict.
