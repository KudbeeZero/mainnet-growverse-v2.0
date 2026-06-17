# 🛰️ LUT Report — 2026-06-10

**Covers:** the Session Relay Protocol install + a memory-integrity audit · **Repo:**
KudbeeZero/growVerseRepelitv1 · **Branch:** `claude/session-relay-protocol-ybubw7` (off `main`)
**Health at a glance:** ✅ **182/182 tests green** · coverage **79.1% ≥ 78 gate** · ✅ lint clean ·
✅ `make check-memory` + `make check-migrations` now real and green.

---

## 0) One-paragraph summary
This session installed the **Session Relay Protocol** (one chat = one audited PR; a verified baton
in `docs/HANDOFF.md`) on top of the existing Layer 0–4 memory system — and in doing so caught a
real **truth-drift** the memory layers were supposed to prevent: four things claimed ✅ shipped
**did not exist on disk**. `scripts/check_memory.py`, `scripts/check_single_head.py`, the
`.claude/hooks/session-start.sh` SessionStart hook, and the entire CI workflow
(`.github/workflows/ci.yml`) were all referenced by `Makefile` / `CLAUDE.md` / `MAP.md` /
`BACKLOG.md` but were phantom. So `make check-memory` and `make check-migrations` were *failing*,
and "integrity is enforced in CI" was false — there was no CI. We built all four for real, verified
them locally, gave the checkers a teeth-test, and reconciled the false ✅ claims. The memory system
now actually defends itself instead of just claiming to.

---

## 1) What shipped this session
- **Session Relay Protocol** — `docs/SESSION_PROTOCOL.md` (the loop + four improvements:
  definition-of-done, carried-risks ledger, device-vs-agent split, reply format),
  `docs/HANDOFF.md` (the baton, seeded with the real OPEN RISKS), `docs/audits/` (README +
  template), and the `/handoff-audit` + `/closeout` skills under `.claude/skills/`.
- **`scripts/check_memory.py`** — fails on broken markdown links, ✅ claims that cite a missing
  path, and codex docs that fall out of `MAP.md`. Resolves cited paths against the repo root,
  `src/growpodempire/`, and `docs/memory/`; ignores non-paths (API routes, branch names, globs).
  Teeth-tested. Result on the current tree: *17 files, links + ✅ citations resolve.*
- **`scripts/check_single_head.py`** — fails on an Alembic fork, prints the `alembic merge` fix.
  Current head: `e7a9c1b3f2d8`.
- **`.claude/hooks/session-start.sh`** — real now; best-effort `make setup` + prints the baton. It
  **fired this session** (the baton printed on resume).
- **`.github/workflows/ci.yml`** — the missing CI: a backend job (lint → memory → single-head →
  `alembic upgrade head` → pytest+coverage) mirroring the Makefile, plus a web job
  (typecheck/lint/build).

## 2) ⚠️ What was wrong — the drift this caught
The 2026-06-08 backlog marked the "make truth automatic" trio (lint + memory-integrity + coverage,
all "wired into CI") and the single-head check and the SessionStart hook as ✅ **done**. On disk:
the Python checker scripts, the hook, and `.github/` itself were absent. Lesson baked into the
protocol: a step is **not done** until its tests are green AND an independent check passed — a
backlog ✅ is not evidence. The four stale entries in `BACKLOG.md` are now annotated with the
correction.

## 3) Verification split
- **Agent-verifiable (proven this session):** `make check-memory`, `make check-migrations`,
  `make lint`, `make test` (182 passed, 79.1%), `alembic upgrade head` on fresh sqlite, the
  checker teeth-test.
- **Device/human-verifiable (owner):** that `.github/workflows/ci.yml` goes green on the first
  push (the workflow YAML is agent-written; the *commands* in it are locally verified, the GitHub
  Actions run is not); that the web job's `npm ci && build` passes on a runner.

## 4) Next
Per the baton's NEXT ACTION: ratchet the coverage floor as it climbs, then resume the real
backlog — sim cost cap (OPEN RISK #2), idempotency keys (#3), and Sprint 4 TestNet (#4). One
chat, one PR, starting with `/handoff-audit`.

---
*Compiled on branch `claude/session-relay-protocol-ybubw7`.*

---

## Addendum (same day, second unit of work) — sim cost cap shipped
The baton's NEXT ACTION landed: **compute-on-read is now bounded** (OPEN RISK #2 closed,
test-backed). The pre-existing clamp bounded one loop but not convergence — a derelict plant
repaid the full cap window (measured **310 ms**) on *every* read. Now an absence beyond
`max_catchup_hours` becomes recorded **dormancy** (stage clock pauses, plant lands at `now`,
auditable `dormancy` event): **311 ms once ever, 0.1 ms after**; near-term reads bit-identical
(parity-tested). +3 tests → **185 passed**, coverage **79.26%**, floor ratcheted **78 → 79**.
ADR in `DECISIONS.md`; ARCHITECTURE risk list updated (residual: first-read bursts at scale →
background materialization). Next per the baton: idempotency keys (risk #3).

---

## Addendum (third unit) — 10-agent fleet sweep + dev/prod parity fix
Ran 10 independent read-only auditors across auth, economy, sim, chain, API-sec, DB, web, AI,
tests/CI, and concurrency. Full notes in `docs/audits/2026-06-10-fleet-sweep.md`. **Narrowed root
cause:** no concurrency control on any state-mutating path (check-then-act, no row lock;
`Wallet.version` is dead code) → double-spend / double-harvest / double-stipend / treasury-cap
overrun / duplicate PlantEvents on `/state`. Second blocker: chain deposit trusts no on-chain proof
(treasury drain once ASA has value). Third: the web safety net is phantom (e2e/vitest stubbed to
`echo`, not in CI). **Fixed this session:** dev/prod parity — SQLite now enforces FKs +
`busy_timeout`/WAL (`db/session.py`), so the test suite can finally catch the FK/orphan class;
suite stayed green (185), proving no latent FK violations. **Reassuring:** no IDOR, AI SpendGuard
unescapable, CI never hits a live key, no model↔migration drift, the old "401 race" doesn't
reproduce. New carried risks #6–#11 logged in the baton; NEXT ACTION re-scoped to full
concurrency+idempotency hardening (was just idempotency keys).

---

## Addendum (fourth unit) — concurrency core hardened (RISK #6)
Acted on the fleet sweep's narrowed root cause. The money paths were check-then-act with no row
lock and `Wallet.version` was dead code. Landed DB-enforced fixes: wallet **optimistic locking**
(`version_id_col`, manual bump removed), **`CHECK(cached_balance >= 0)`** backstop, **harvest-once**
unique index (migration `f1a2b3c4d5e6`, `compare_metadata` clean), and a **409-on-conflict** mapping
(was a 500). Also fixed the F5 flaky rate-limit test (limiter reset per `client` fixture). +4 tests
in `tests/test_concurrency.py` proving double-spend is blocked, harvest is once-only, and the CHECK
floor holds — **189 passed, 79.26%**. Double-spend / double-harvest / negative-balance are now
DB-impossible regardless of worker concurrency. Remaining for the next chat: the general
`Idempotency-Key` header (duplicate → original response, not a 409), one-shot-grant uniqueness
(stipend/achievements), and the `/state` duplicate-PlantEvents race (C1). ADR in `DECISIONS.md`;
ARCHITECTURE invariant #3 updated.

---

## Addendum (fifth unit) — API-validation hardening + money-endpoint tests
Closed the RISK #11 validation-500 gaps and part of RISK #8 (the money-boundary test blind spot).
Added `validation.number()` and wired it so `set_environment` (5 sensor params), `advisor/auto-care`
(`budget`/`max_actions`), `create_player` (blank/over-long username, **duplicate email**) all return
a clean **400** instead of a generic 500 (the env case used to TypeError on the next sim read of
every plant in the pod). Added HTTP-boundary tests on the money endpoints: withdraw/deposit
**auth (401) · wrong-key + cross-player IDOR (403) · bad-amount (400)** — withdraw/deposit were
already guarded but untested. **+8 tests → 197 passed; coverage 79.3% → 80.03%.** lint /
check-memory / check-migrations green. Also landed PR #6's Constellation fixes via PR #10 (resolved
the baton conflict). Remaining on #8: real vitest/Playwright in CI + treasury-cap (F2) and
chain-failure-rollback (F3) tests; on #11: Redis rate-limit storage + `get_level` gating.
