# HANDOFF — the baton

> Single source of truth for **what the next chat does first**. Rewritten by `/closeout` at
> the end of every chat; read by `/handoff-audit` at the start of the next. If this file and
> the code disagree, the code wins — fix the baton. See `docs/SESSION_PROTOCOL.md`.

**Last rewritten:** 2026-06-18 · **By:** audit/baton-repair chat — retro-audit of the latest merged PR.
**Active branch:** `claude/growverse-audit-baton-yqd63o` (this chat; **one draft PR**, doc-only).
**`main` is at `231c00b`** (= the PR #22 merge) and **CI-green** (push run `231c00b` ✅).

> **Owner rule now in force: ONE active PR at a time.** No stacked PRs, no parallel feature PRs,
> no multi-PR chains unless the owner explicitly approves an exception. If another unit is
> discovered, **queue it below — do not open it.**

---

## This chat (2026-06-18) — retro-audit + baton repair (doc-only)

A read-only audit of the **most recently merged PR** plus a repair of this stale baton. No product,
engine, economy, token, wallet, minting, db, simulation, strain, morphology, chamber, CI, or
player-facing behavior changed — **three markdown files only**.

**Audited: PR #22 — "docs: Database Systems + Process Coach audit (read-only)"** — `merged:true`,
merged 2026-06-18T22:39:06Z, merge commit `231c00b` = current HEAD of `main`.

| Claim (PR/handoff) | Repo evidence | Label |
|---|---|---|
| #22 changed exactly one additive markdown file, no behavior | `git show 231c00b --stat` → 1 file, **+290** (`docs/DATABASE_SYSTEMS_AUDIT.md`) | **Verified** |
| Branch `claude/website-content-audit-*` is a pre-pivot rename, not a website task | PR #22 body documents the pivot to a DB audit | **Verified** |
| #22 was gated by CI before merge | `get_check_runs #22` → **0 checks**; only validated *after* merge by the `main` push run | **Not verified → merged blind** |
| #22's headline "top process risk": *`ci.yml` is nested under `growpod/`, Actions never runs* | **False on current main** — root `.github/workflows/ci.yml` exists (no `growpod/.github/`), and CI is green on `main` pushes + PR #14. Cause of #22's 0 checks was a **stale, un-rebased branch**, not nesting. | **Scope mismatch (doc vs evidence)** → erratum added to the doc |
| Prior baton: PR #14 is an "open PR" / active branch | PR #14 `merged:true` 22:22Z (`2ed4c9b`) | **Memory conflict (stale)** |
| Prior baton: RISK #8 web safety net "pending the first CI run" | PR #14 PR run + `main` pushes ran the web `typecheck·lint·build·test·e2e` job **green** | **Verified → closeable** |
| Prior baton "prior baton" block cites PRs **#42/#47/#59/#63** | This repo's PRs only reach **#23**; those numbers do not exist here | **No evidence (phantom) → removed** |

**Tests/checks this pass:** read-only git + GitHub Actions API evidence (above) and `make check-memory`
to keep doc-link integrity green. No source touched, so lint/test are behavior-unaffected.

---

## Merged on `main` (real, verified) — recent PR ledger

| PR | Title | Merged | Note |
|----|-------|--------|------|
| **#22** | docs: Database Systems + Process Coach audit | 22:39Z (`231c00b`, HEAD) | doc-only; **0 pre-merge CI** (see audit) |
| #23 | docs: Global Evidence + Memory Layer charter | 22:31Z (`56f0033`) | doc-only; 0 pre-merge CI (stale branch) |
| #14 | Testing-prep: green build + test-env + skip-login | 22:22Z (`2ed4c9b`) | big (54 files); **CI green** on its PR run (`f3d1d99` ✅) |
| #17 | backup/local-changes merge | — (`cc32548`) | — |
| #16 | "Ask Grok" GitHub Action | — (`5ea3307`) | adds repo-root `.github/workflows/grok.yml` |

**CI reality:** the backend + web gates live at the **repo root** `.github/workflows/ci.yml` and **do
run** — `main` push runs `231c00b` / `56f0033` / `2ed4c9b` are all ✅, and PR #14's PR run was ✅.
**Process gap:** #22 and #23 merged with **zero pre-merge checks** because their branches predated
#14's root-CI landing and were not rebased, so the `pull_request` trigger never fired. **Rebase every
PR onto post-#14 `main` before merge** so CI gates it pre-merge, not just after.

---

## NEXT ACTION (single-lane)

**Owner reviews this doc-only audit/baton PR.** Nothing else is started this lane. After it is
reviewed/merged, the owner picks the **one** next PR. Per the new rule, any newly discovered unit is
**queued here, not opened.**

**Queued (not started — owner picks one next):**
- **Process P0 (from #22's audit, still valid):** make the repo-root backend CI job a **required**
  status check on branch protection, and add a PR-template/checklist reminder to **rebase onto `main`
  before merge** (prevents future 0-check merges). CI-config/process only.
- **DB follow-ups (from #22, owner-gated):** model↔migration drift guard (tests bypass migrations via
  `create_all`); FK single-column indexes on hot `player_id`/`strain_id`/`pod_id` lookups (touches a
  protected migration surface — needs owner OK); concurrency test-matrix expansion (test-only).
- **RISK #4/7 hardening** (real on-chain value) — owner-gated, pre-launch only (see ledger below).

**Off-limits this lane:** no economy / chain / breeding / minting / simulation / strain / morphology /
chamber / player-facing change; no new feature unit; no second PR; no merge.

---

## OPEN RISKS (carried ledger) — re-verify against current code before acting

> Only **RISK #8 (web CI)** was independently re-verified this pass. The rest are **carried from prior
> batons and NOT re-audited here** — treat their status as unproven until checked with `file:line` +
> a gate run. Phantom PR-number citations from the old baton (#47/#59/#63 — not in this repo) were removed.

| # | Sev | Risk | Evidence anchor | Status (this pass) |
|---|-----|------|-----------------|--------------------|
| 8 | HIGH | **Safety net.** Backend HTTP boundary + web vitest/Playwright wired into CI. | `.github/workflows/ci.yml`, `web/package.json` | ✅ **Web CI verified green** (PR #14 run + `main` pushes ran the web `typecheck·lint·build·test·e2e` job). Treasury-cap + chain-failure-rollback UI tests still absent → keep open at lower sev. |
| 4/7 | HIGH | **Chain settlement not real** — deposit trusts no on-chain proof; no txid-replay/reconciliation/address validation. Real value stays gated OFF. | `services/settlement_service.py`, `db/models.py` | **Carried, not re-verified.** Pre-launch gate. |
| 3 | HIGH | Idempotency on mutations — no general `Idempotency-Key` header (duplicate → 409). | `api/game_api.py` | **Carried, not re-verified.** |
| 9 | MED | **Sim dormancy semantics** — large catch-up gaps can delay an earned harvest / skip lethal decay; needs a knob guard. | `simulation/engine.py` | **Carried, not re-verified.** |
| 11 | LOW | Rate-limiter `memory://` per-worker (set Redis for multi-worker); `get_level` public oracle. | fleet-sweep audit | **Carried, not re-verified.** |

---

## Verification split (this chat)

**Agent-verifiable (proven this pass):** the audit table above — diff stat, PR merge state, CI check
counts, and `main`/PR Actions run conclusions, all from git + the GitHub API. `make check-memory` kept
green for the doc edits.

**Owner / not-this-pass:** the full DB-audit content in `DATABASE_SYSTEMS_AUDIT.md` (money-path
constraints, single-head migrations, FK-index list, RISK #4/7) is preserved as historical evidence and
was **not** independently re-audited here — only its stale CI headline was corrected via an erratum.

---

> History note: earlier batons described a large multi-PR program (testing-prep, simulation test clock,
> feature-flag reconciliation) under PR numbers that **do not exist in this repository** (it tops out at
> #23). Those references were removed as unverifiable. The durable facts are the merged-PR ledger and the
> carried-risks ledger above; trust the code over any prose.
