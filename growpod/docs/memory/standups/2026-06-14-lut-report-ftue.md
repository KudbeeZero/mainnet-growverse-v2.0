# 🛰️ LUT Report — 2026-06-14 (FTUE Epic)

**Covers:** the **FTUE epic** — PR #34 (starter-grant rail) · PR #35 (FTUE tutorial backend) ·
PR #39 (web `/ftue` guided route) · **Repo:** KudbeeZero/growVerseRepelitv1 · **Main head:** `15f9699`
**Health at a glance:** ✅ `make test` **231 passed** · ✅ `make lint` · ✅ single Alembic head
`9d669edf48a8` · ✅ `make check-memory` · ✅ web `tsc`/`next lint`/`next build` · ✅ web `vitest`
**119/119**. Directive: **DX-003** (Design & Experience).

---

## 0) One-paragraph summary
Turned a fresh signup into a **completed first grow**. A new player is granted a free Starter Pod +
seed, then walked one guided action at a time — plant → water → climate → grow → harvest → sell —
coached at each step by the AI Master Grower, with the first grow **time-compressed** so the payoff
lands in seconds instead of days. Built entirely on **existing rails**: no new economy, no Phase-2
systems, no changes to the core loop or ledger.

## 1) What shipped
- **PR #34 — starter-grant rail.** `GameService.grant_starter_items` grants a Starter Pod + starter
  seed on signup, one-shot/idempotent via a `grant_claims` unique index. Migration `c7ecd7523cc8`.
- **PR #35 — FTUE tutorial backend.** `services/ftue_service.py` — a guarded deterministic step
  machine on `Player.ftue_step`; each `advance` performs the real game action and refuses
  out-of-sync / post-completion calls (no replay). `ai/ftue_coach.py` — deterministic per-step
  `AdvisorReport`s through the real advisor schema (Mock-safe in CI). Tutorial-only time-compression
  in the `grow` step (backdate `planted_at`, `last_tick_at = now`). Endpoints `GET /ftue/status`,
  `GET /ftue/coaching/<step>`, `POST /ftue/advance`. Migration `9d669edf48a8`
  (`Player.ftue_step`/`ftue_plant_id`/`ftue_completed_at`).
- **PR #39 — web `/ftue` route.** RequireAuth-gated guided UI: per-step coaching + one primary
  action driving `advance`, the live tutorial plant via the existing `PlantVisual`/`StatBars`, a
  "Skip tutorial" escape, and a completion panel → dashboard. Fresh signups route to `/ftue`;
  existing players are not auto-diverted.

## 2) Verification split
- **Agent-verifiable (proven before each merge):** backend 231 tests (5 new FTUE E2E) + lint +
  single-head + check-memory; web tsc/lint/build + 119 vitest; each migration applied cleanly on a
  fresh DB; every merge confirmed `mergeable_state: clean`.
- **Device/human-verifiable (owner):** sign up a fresh account → land on `/ftue` → walk the steps →
  confirm the coaching reads per-step, the plant matures (flowering after "grow"), the harvest
  credits GROW, and completion routes to the dashboard. The pixels/UX are owner-verified (no
  headless browser screenshots the flow in CI).

## 3) Decisions
- See `DECISIONS.md` 2026-06-14: *FTUE is orchestration on existing rails; tutorial time is a
  per-plant fiction* (why time-compression backdates instead of running the sim or enabling
  auto-care; why existing players are not auto-diverted).

## 4) Carried risks (not re-audited this epic)
Chain settlement (#4/7), general `Idempotency-Key` header (#3), Playwright e2e stub (#8), sim
dormancy knob (#9), rate-limiter `memory://` (#11) — all carried; the FTUE work touched none of them.
The web global 401/403 handler (prev RISK #10) is **cleared** (shipped in PR #30).

## 5) Next
Launch-readiness critical path: **Feature Flags → Mobile Polish → Playtesting → Retention Validation
→ MVP Launch Candidate** (see `docs/HANDOFF.md` NEXT ACTION). Mobile Polish is partly underway
(PR #36 responsive nav + chamber).
