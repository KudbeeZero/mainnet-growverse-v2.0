# Audit — PR #<n>: <title>

**Branch:** `<branch>` → `<base>` · **Head SHA:** `<sha>` · **Auditor run:** <date>
**CI on the PR:** <green/red + link> · **Reviewer:** independent auditor (does not trust PR prose)

## Claims vs. evidence
| # | PR claims | Verified? | Evidence (`file:line`) |
|---|-----------|-----------|------------------------|
| 1 |           | ✅/❌/⚠️    |                        |

## Gates re-run by the auditor
- `make test` → <result>
- `make lint` → <result>
- `make check-memory` → <result>
- web (if touched) `typecheck`/`lint`/`build`/`e2e` → <result>

## Scope check
- In-scope diff: <files>
- **Scope creep / out-of-scope changes:** <none / list with file:line>

## Carried-risks ledger check
- Any OPEN RISK silently dropped from `docs/HANDOFF.md`? <yes/no>
- Any risk marked FIXED **without** a test backing it? <yes/no>

## Device-verifiable vs agent-verifiable
- Agent proved: <…>
- Owner must confirm by hand: <…>

## Verdict
**PASS / CONCERNS / FAIL** — <one-line reason>
