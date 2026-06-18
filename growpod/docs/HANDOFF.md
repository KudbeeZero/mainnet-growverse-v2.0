# HANDOFF — the baton

> Single source of truth for **what the next chat does first**. Rewritten by `/closeout` at
> the end of every chat; read by `/handoff-audit` at the start of the next. If this file and
> the code disagree, the code wins — fix the baton. See `docs/SESSION_PROTOCOL.md`.

**Last rewritten:** 2026-06-18 · **By:** testing-prep chat — green-build + test-env tunnel + skip-login bypass
**Active branch:** `claude/paul-testing-prep-xk78mz` (open PR; was identical to `main` at start).

> **This chat (2026-06-18) — testing-prep pass.** Pre-flight check-in caught that `main` had gone
> **RED** (the baton below was stale: it claimed "287 passed, 84.55%" but merges #4–#7 left
> **6 failures + coverage 73.45% < 79%**). Fixed both: (1) economy is in deliberate **free testing
> mode** (commit `573b78a`: free seeds, 5000 stipend) — kept the testing values live and guarded the
> **launch** values via `tests/fixtures/launch_balance.yaml` + a `test_launch_balance_values`
> tripwire (**restore the launch values in `balance.yaml` before launch**); (2) added launch-critical
> tests (seasonal sink, ledger summary, badges, branded store) → coverage back to **79.37% ≥ 79%, no
> floor change**. Then: **web safety net** wired into CI (vitest + Playwright un-stubbed; RISK #8
> web-side closed pending the first CI run), a one-command **`make testenv`** full-stack cloudflared
> tunnel (debug off, dev clock on), a dev/test-only **skip-login** button
> (`NEXT_PUBLIC_ENABLE_DEV_BYPASS`, default OFF), `docs/TESTER_RUNBOOK.md`, and a bug-report template.
> Gates: `make test` **349 passed, 79.37%** · `make lint` ✅ · `make check-memory` ✅.
> **Note for the owner:** `.github/` lives under `growpod/.github` while the git root is the repo
> parent — GitHub reads workflows/templates from the **repo root**, so confirm CI actually runs (the
> issue template was placed at the repo-root `.github/ISSUE_TEMPLATE/` to be picked up).

---

### Prior baton (pre-2026-06-18, now stale on test counts — see above)
**By:** records chat — CEO ratified PR #63; #61 closed; FF-RECON-001 EXECUTED
**Was active branch:** `main` (PR #63 squash-merged that chat).
**Just merged (this chat): PR #63 — BE-003 feature-flag reconciliation.** `main` had carried **two**
contradictory flag systems (#42's `config.py ENABLE_*` / `feature_gates.py` gating routes OFF while
`GET /api/game/flags` reported ON from #55's `balance.yaml`). #63 collapses to the single
balance.yaml-canonical system: deletes `api/feature_gates.py` + the `config.py ENABLE_*` block + the
`app.config["FEATURE_*"]` mirror; re-points the ~25 route decorators to `feature_required` from
`growpodempire.feature_flags`; adds `chain`/`contracts` to `balance.yaml`; renames `cup` →
`cup_competitions`; adds a regression test asserting each route's gate == its `/flags` value.
Gates: `make test` **287 passed, 84.55%** · `make lint` ✅ · `make check-memory` ✅.
**Prior context (BE-004.5 / playtest chats):** **PR #59** (STEP 4.5 — `GameService` on `active_clock()`
+ cure e2e) merged (`5d44d35`); **RISK #1 CLOSED** (cure/auction dev-clock-drivable). Playtest done
(`docs/playtesting/BE-004.5-playtest-report.md`, zero product defects; device/web matrix
owner-verifiable). **PR #62** (playtesting docs) merged.
**Just merged to main (this chat):** **PR #47 — Simulation Test Clock (BE-002, STEP 3) + e2e Grow Loop
(BE-004, STEP 4).** The dev/test-only `OffsetClock`/`active_clock()` seam, the `/api/dev/clock/*`
endpoints (force-disabled in production), **plus** the full core-loop e2e (seed → plant → flower →
harvest → sell over the HTTP API, fast-forwarded with the dev clock) and HTTP-boundary coverage for
the value-bearing routes (RISK #8, backend side). **Test-only / no production behaviour change.**
**Closed this chat:** **PR #44** (the competing STEP 3 test-clock) — **superseded by PR #47** per the
Director's BE-004A reconciliation decision.
**Recently merged (per `main` / REC-004 sweep):** FTUE epic (**#34/#35/#39**), Dashboard wiring
(**#29/#30**), Launch Strain Pack (**#33** → 29-strain catalog), mobile-first nav (**#36**), OMNI
Charter (**#38**), DX-001 Care Feedback (**#41**), FP-3 Primary CTA (**#45**), REC-003 Studio Agent
Registry (**#46**), REC-004 memory reconciliation (**#50**), University curriculum docs (**#51**).
**Parked (open PRs, green — do NOT modify):** **PR #27** Phenotype Generator Foundation,
**PR #28** Circadian Leaf Motion.
**Other open PRs (owner decision):** **PR #32** E2E grow-loop CI (service-layer + a CI gate step) —
**now overlaps PR #47's HTTP e2e**; the owner should decide *merge for the CI gate* vs *close as
overlapping*. **PR #42** *MVP Feature Flag Layer* (the NEXT ACTION).

> **Launch-Readiness path (Builder Dept):** Feature Flags → STEP 3 Simulation Test Clock ✅ → STEP 4
> e2e Grow Loop ✅ → **Feature Flags (#42, NEXT)** → Playtesting → Retention Validation → MVP Launch
> Candidate. The backend OPEN RISKS below were **not** re-audited beyond RISK #1/#8; re-verify against
> current code before acting. The authoritative consolidated Records ledger is
> `docs/memory/CANONICAL_STATE.md`; live cross-agent coordination is `docs/STUDIO_AGENT_REGISTRY.md`.

---

## NEXT ACTION (the one scoped item the next chat does)

**Playtesting → Retention Validation → MVP Launch Candidate.** **Feature Flags are DONE** — one
canonical `balance.yaml`/`feature_flags.py` system (**PR #63, CEO-ratified 2026-06-14**): gated routes
via `feature_required`, `GET /api/game/flags`, a route-gate==`/flags` regression test; #42's
`feature_gates.py` + config `FEATURE_*` removed. The competing **PR #61** (delete #55) was **closed as
superseded**. **Do NOT reopen the flag architecture** unless a production defect appears (CEO). Next
chat resumes the launch path: the web/device playtest pass, then Retention Validation, then MVP Launch
Candidate.
- **Launch polarity:** gated routes default **ON** (balance.yaml); the launch build turns non-MVP
  surfaces OFF per-env (`FEATURE_MARKETPLACE/CHAIN/CUP_COMPETITIONS/UNIVERSITY/CONTRACTS=false`) —
  deploy config, not code.
- **Deferred (not now, no defect):** the web layer still uses build-time `NEXT_PUBLIC_ENABLE_*`; a
  future runtime `useFlag` over `/api/game/flags` could unify it — **out of scope per CEO** ("no
  additional refactors").
- **Owner-pending (REC-004):** the §3 branch prune still has **not** run (destructive git is
  owner-only). After the owner prunes, refresh `CANONICAL_STATE.md` §3.

> **Also queued (owner/device):** the web playtest pass — run `cd web && npm i && npm run dev` and verify
> the device-only matrix the headless playtest could not (mobile viewport/safe-area, reduced-motion,
> keyboard a11y, refresh-mid-action, stale cache) + stand up the Playwright real-e2e (RISK #8 web side).
- **Off-limits:** no economy / chain / breeding / factions / combat / new crop families. No new
  Phase-2 systems. No per-player flag table (deferred). Do NOT modify the parked PRs (#27, #28).
- **Reuse, don't rebuild:** the chamber renders through `web/src/lib/chamber/chamberCore.ts`
  (single source for the live component + the headless `npm run gen:stages` generator) — keep it
  intact. The flat `GET …/plants/<id>/state` wire is canonical (see DECISIONS 2026-06-14); do not
  build the aspirational `GameState/EnvironmentState/UIState` aggregate.
- **Follow the registry:** claim file surfaces in `docs/STUDIO_AGENT_REGISTRY.md` and rebase onto
  `main` first (this chat's collision — BE-004 built on #47's branch while a separate branch was
  planned — is exactly what the registry exists to prevent).

> **In flight (owner-approved):** **STEP 4.5 — `GameService` on `active_clock()` + cure e2e**
> (directive BE-004.5) is an **open PR** on `claude/be-step45-active-clock`: the one-line
> `GameService` → `active_clock()` change (mirroring `simulation_service.py`) so cure + auction expiry
> fast-forward under the dev clock, plus `test_cure_advances_under_dev_clock`. Production-behaviour
> identical (`active_clock()` → `SystemClock` when the test clock is off). Awaiting review/merge; clears
> RISK #1. After it lands, the path is Playtesting → Retention Validation → MVP Launch Candidate.

</details>

> **✅ Update:** STEP 4.5 **merged as PR #59** (`5d44d35`); **RISK #1 closed**; Playtesting **done**.
> **Feature Flags EXECUTED** — #63 canonical (`balance.yaml`), #61 closed (CEO-ratified). The path is now
> **web/device playtest pass → Retention Validation → MVP Launch Candidate.**

---

## What THIS chat did (BE-004A reconciliation + PR #47 landing)

Reconciled the three overlapping Builder-Dept PRs and landed the canonical one, per the Director's
BE-004A decision:
- **Reviewed PRs #32 / #44 / #47** and recommended #47 as canonical (the only one delivering the
  `/api/dev/clock/*` HTTP endpoints + `APP_ENV` prod-gate that BE-004 requires); confirmed BE-004's
  e2e + HTTP-boundary work was **already built on #47's branch** (commit `e9df323`), test-only and
  green.
- **Resolved #47's merge conflicts against current `main`** — docs-only (`HANDOFF.md`,
  `DECISIONS.md`; `BACKLOG.md` auto-merged); **zero source-code conflicts** — and merged #47.
- **Closed PR #44** as superseded by #47.
- Folded the STEP 3 (BE-002) and STEP 4 (BE-004) ADRs into `DECISIONS.md` alongside main's FTUE /
  mobile-nav / OMNI ADRs; recorded the landing in `BACKLOG.md` (STEP 3 ✅ / STEP 4 ✅).

Shipped by PR #47 (authored across the BE-002 + BE-004 sessions):
- **`tests/test_e2e_grow_loop.py` (3)** — full HTTP-API loop, dev-clock fast-forward; asserts balance
  rises by exactly the `harvest_sale` entry, no double-sell, and **ledger integrity** (advancing the
  clock posts zero ledger entries — BE-A08).
- **`tests/test_http_boundary.py` (13)** — RISK #8 HTTP coverage: withdraw/deposit (happy + validation
  + auth + insufficient), mint (happy/idempotent/not-found), strain non-breeder, ARC-3 metadata +
  unknown-kind 404. Offline `MockChainProvider`.
- **`tests/test_test_clock.py` (15)** — the OffsetClock primitive, config gating (off by default /
  on in dev / **force-off in prod**), the `active_clock()` selector, and the endpoints.
- **Docs:** `docs/SIMULATION_TEST_CLOCK.md`, `docs/STEP4_E2E_GROW_LOOP_VALIDATION.md`,
  `docs/audits/PR-47-simulation-test-clock.md`, standups `2026-06-14-lut-report-be002.md` /
  `-be004.md`.

## Verification split (this chat)

**Agent-verifiable (proven):**
- Post-merge gates on the merge result: `make test` ✅ · `make lint` ✅ · `make check-memory` ✅
  (re-run after conflict resolution — see the closeout report). PR #47's own suite: **262 passed,
  83.63% ≥ 79**; settlement 87% / minting 73% HTTP-boundary coverage.

**Device/human-verifiable (owner):**
- `GROW_TEST_CLOCK=true APP_ENV=development make serve`; `POST /api/dev/clock/advance {"days":40}` →
  plant flowers on next `/state`; harvest + sell succeed; `/api/dev/clock/*` 404 with flags unset.
  (Automated equivalents of all four are in the suite above.)

---

## OPEN RISKS (carried) — re-verify against current code before acting

> A risk clears only when VERIFIED FIXED (test-backed). Risk #1 is new (STEP 4).

| # | Sev | Risk | Evidence | Status |
|---|-----|------|----------|--------|
| 1 | MED | **Cure/auction not dev-clock-drivable.** `GameService` defaulted to `SystemClock`, so the dev clock couldn't fast-forward cure/auction over HTTP. | `services/game_service.py` (now `active_clock()`) | ✅ **CLOSED** — STEP 4.5 merged as **PR #59** (`5d44d35`); verified live in the BE-004.5 playtest + `test_cure_advances_under_dev_clock`. |
| 3 | HIGH | Idempotency on mutations — general `Idempotency-Key` header (duplicate → original response, not a 409). | `api/game_api.py` | PARTIAL — concurrency core + one-shot grants shipped (`grant_claims`, harvest-once index); FTUE `advance` replay-guarded. General header absent (WIP PR #16 closed unmerged). |
| 4/7 | HIGH | **Chain settlement not real** — deposit trusts no on-chain proof; treasury-drain path; no txid replay protection / reconciliation / address validation. | `services/settlement_service.py`, `db/models.py` | OPEN — blocks any real value moving (Sprint 4 gate). |
| 8 | HIGH | **Safety net** — backend HTTP boundary covered (PR #47). **Web vitest + Playwright now un-stubbed and wired into CI (2026-06-18)**; treasury-cap + chain-failure-rollback UI tests still absent. | `web/package.json`, `.github/workflows/ci.yml`, `tests/test_http_boundary.py` | NEAR-CLOSED — web CI wired 2026-06-18, **validation pending the first CI run** (no web npm network locally). |
| 9 | MED | **Sim dormancy semantics** — large `max_catchup_hours` gaps can delay an earned harvest / skip lethal decay; needs a design decision + knob guard. (FTUE sidesteps it for the tutorial plant via `last_tick_at = now`.) | `simulation/engine.py` | OPEN. |
| 11 | LOW | Rate-limiter `memory://` per-worker (set Redis for multi-worker); `get_level` public oracle. | fleet-sweep audit | PARTIAL. |

**Cleared earlier:** *Web global 401/403 handler* (prev RISK #10) — an `AuthErrorListener` tears down
the session on a rejected key, shipped in **PR #29/#30** (see `DECISIONS.md` 2026-06-14).

> Reassuring (verified solid earlier, not re-checked here): no IDOR; auth/authz server-authoritative;
> AI SpendGuard unescapable + CI never hits a live key; ledger correct single-threaded; no
> model↔migration drift (single Alembic head).

---

## DIRECTOR DECISIONS (resolved 2026-06-14)

**BE-004A — PR reconciliation (this chat):**
1. **PR #47** — **CANONICAL** for the Simulation Test Clock; preserve `OffsetClock` / `active_clock()`
   / `/api/dev/clock/{,advance,reset}` / dev-only gating (`GROW_TEST_CLOCK` + `APP_ENV`, prod
   hard-disable). Conflicts resolved + **merged** this chat (owner-approved exception to
   one-PR-one-responsibility, since BE-004 was already built+green on the branch). ✅
2. **PR #44** — **closed** as superseded by #47. ✅
3. **PR #32** — service-layer e2e + a CI gate step; now overlaps #47's HTTP e2e. **Owner decision
   pending:** merge for the CI gate, or close as overlapping. ⬜
4. **BE-004** — **closed/complete** (its deliverables shipped within PR #47). ✅

**REC-004 (prior sweep, still in force):**
- **PR #43** owner-merged (folded into REC-004). **PR #37** closed (superseded by the FTUE epic; WO-1/
  WO-2 logged to BACKLOG). **Branch pruning** approved — recommended list in
  `docs/memory/CANONICAL_STATE.md` §3; owner executes (destructive git is owner-only).
