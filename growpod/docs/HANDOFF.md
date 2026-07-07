# HANDOFF — the baton

> Single source of truth for **what the next chat does first**. Rewritten by `/closeout` at
> the end of every chat; read by `/handoff-audit` at the start of the next. If this file and
> the code disagree, the code wins — fix the baton. See `docs/SESSION_PROTOCOL.md`.

**Last rewritten:** 2026-07-07 · **By:** the `gv-o01-store-correctness` session (owner: "merge
PR #170 and release Sonnet on `claude/gv-o01-store-correctness`"). PR #170 (the Fable 5 planning
PR) merged first; this session then built ROADMAP_90D week 1 exactly as specced.
**Active branch:** `claude/gv-o01-store-correctness` — draft PR open (title:
`fix(store): featured-strain pricing, balance refresh, honest harvest-panel gating`), gates green,
awaiting `/handoff-audit` + merge next session.
**NEXT CHAT STARTS HERE (Sonnet):** once this PR is audited PASS and merged, start
**`claude/gv-o02-equipment-sim-effects`** (ROADMAP_90D weeks 2–3, the flagship slice — fans/soils/
CO₂ get real, tunable, both-signs simulation effects). Read `docs/memory/ROADMAP_90D_2026Q3.md`
§2 weeks 2–3 (the data-driven `effects` block spec + ready-to-paste Sonnet prompt) and
`docs/memory/EXECUTION_MACHINE.md` (Current Position pointer, updated). D7 (new `balance.yaml`
gear-effect keys) is already owner-approved 2026-07-07 — attach the 4-scenario sim report to
that PR per the roadmap's acceptance criteria.
**Superseded pointer note:** the pre-2026-07-07 next branch was `claude/gv-p02-game-loop-codex`;
p02 now lands in week 9 of the 90-day schedule. Historical context below is unchanged.
**Chamber-mockup decision — RESOLVED (owner, 2026-07-06):** the owner chose to **replace** the
chamber layout with the mockups (not layer on top), and keep the Pod Visual System (moods/rarity)
as roadmap Phase 3. Built in PR #159: a default **GROW hub tab** (Today's Plan + Plant Insights +
Progress + boosts on the chamber), a portrait bottom-sheet **chevron** pop-up/down, and a
**phone-landscape slide-out HUD** system (left = controls, right = insights, auto-compact). This
reverses the earlier "panels only on /dashboard" split — `care-loop-shot.spec.ts` was updated to
assert the GROW hub, and `chamber-landscape-hud-shot.spec.ts` proves the HUD flow.
**`main`:** includes PR #157 (roadmap docs) + PR #158 (e2e testid fix) on top of everything
through #156. **Note:** `main`'s HANDOFF.md was briefly double-base64-encoded by a bad
`create_or_update_file` call; PR #159 restores it to plain markdown (this file).
**Production:** `growverse-api` on Fly is LIVE (verified 2026-07-02: bio-101 + factions flag
present, `/health` OK, lecture audio cache-hit and the Haiku adaptive-thinking fallback live — see
Incident below). Deploys are AUTOMATIC on merge (`.github/workflows/deploy-api.yml` at repo root).
growverse.dev (Vercel) deploys `web/` from `main`.

> **Owner rule in force: ONE active PR at a time.** Queue further units here, don't open them.

---

## What shipped 2026-07-07 (this session — ROADMAP_90D week 1, `gv-o01-store-correctness`)

Owner merged PR #170 (Fable 5's audit + 90-day plan) and released Sonnet on week 1. Fixed audit
defects S1, S2, S6, S7, C2, C3, C4 exactly as specced in `ROADMAP_90D_2026Q3.md` §2 week 1 (no
`balance.yaml`/sim/chain/cure-mint-backend changes — out of scope, reserved for `gv-o04`):
1. **S1 — featured strains are buyable:** `store_featured` (`api/game_api.py`) now prices the
   `strain` branch via `economy.pricing.seed_price(strain.rarity, cfg)`, same catalog formula
   `buy_seed` already uses — the web's `canBuy` gate (`price_gc != null`) now passes. Backend test
   `tests/test_store.py::test_featured_strain_is_priced` pins a strain to the shelf and asserts
   the price matches the catalog formula (not just "non-null").
2. **S2/S7 — stale balances + stale shelf after purchase:** `web/src/app/store/page.tsx`
   `handleBuy` now invalidates `wallet`/`player` queries on the featured-consumable branch (it
   already did on strain/seasonal) and every branch now invalidates `storeFeatured()` after a
   successful purchase, so owned-count/repeat-state never goes stale.
3. **S6 — phantom test fixture:** `web/src/lib/api/__tests__/store.test.ts` exercised
   `led_240w`, a gear key that doesn't exist in `balance.yaml` (real keys are `led_125w/320w/480w/
   700w/800w`) — swapped to `led_125w`.
4. **C2/C3/C4 — honest HarvestsPanel gating:** new pure gate module
   `web/src/components/harvest/harvestGatesData.ts` (13 unit tests in
   `__tests__/harvestGates.test.ts`) + wiring in `HarvestsPanel.tsx`:
   - **Mint** (C2) is disabled unless rarity ≥ `mint_min_rarity` ("rare", mirroring
     `balance.yaml` — server remains the sole enforcer in `minting_service.py`) **and** the
     harvest isn't curing, with an explanatory `title` tooltip otherwise. Commons (the starter
     path) no longer always error.
   - **Finish cure** (C3) is disabled until `cure_started_at + cure_target_hours` elapses, using
     the existing `Countdown`/`useCountdown` primitives for a live ETA instead of an immediate
     error-toast.
   - **Sell** (C4) is hidden entirely while `cure_status === "curing"` instead of guaranteed-
     erroring.
5. Full gates green this session: backend `make test` 1184 passed/6 skipped/91.90% coverage,
   `make lint`/`make check-memory` clean; web `npm run typecheck`/`lint`/`build` clean, `npm run
   test` 511/511 (was 498 before this session's +13 new harvest-gate tests). Playwright e2e not
   re-run — no route/page structure changed, only button enablement + tooltips (device-verify
   below covers this).

## What shipped 2026-07-06 (this session — status check + CI fix, PR #158)

Owner asked for a GitHub status check + a review pass + a roadmap look. Found:
1. **The baton was 3 days / ~19 PRs stale** (see below) — corrected in this rewrite.
2. **`main`'s web CI was red**: `528c6cd` ("remove arcade tab, consolidate store panels into
   toolbar," part of #156) folded the chamber's ARCADE tab into the default CLIMATE tab — a
   legitimate UX simplification — but dropped `data-testid="growth-boost"` when the button moved
   into the new `ArcadeToolbar.tsx`, and left 3 e2e specs asserting on the removed tab
   (`care-loop-shot`, `dedupe-boost-tray-shot` ×2, `growth-boost-shot`). Root-caused, fixed, and
   merged as **PR #158**: testid restored, stale `/ARCADE/i` tab assertion replaced with a direct
   check of the always-visible toolbar. Full web gate re-verified green (tsc, lint, vitest 487/487,
   build, Playwright 55/55).
3. Reviewed **PR #157** (GrowVerse roadmap docs, still open) and read both roadmaps — see NEXT
   ACTION below.

## What shipped 2026-07-05 (PRs #138–#156, previous session — never logged in the prior baton)

A full day's work that the stale baton skipped entirely:
- **Infra audit (#148)**: migration↔model drift (4 tables only existed via `create_all`) fixed
  with a catch-up migration + a permanent `alembic check` CI gate; implicit treasury ASA
  auto-create now fails closed; 4 more MEDIUM fixes (genesis-ID guard, `pool_pre_ping`, contract-
  expiry persistence, `MAX_WITHDRAWAL_PER_DAY` fail-closed default).
- **Idempotency-Key infrastructure + care-streak/resin-score (#149)**: `Idempotency-Key` header
  dedup on 18 mutation endpoints; `care_streak`/`resin_score` computed server-side, surfaced in
  Plant Insights.
- **Security races (#144)**: closed withdraw double-payout and mint double-mint races.
- **Purchase-flow bugfixes (#145, #146)**: harvest no longer force-sells (cure/mint/Enter-Cup stay
  reachable); store/lab/market bugs found by playtest.
- **Chamber round 10 (#142)**: pod shape variety, size/lightness rebalance, branch/leaf color
  separation.
- **Store→Chamber integration (#153, #154, #155)**: gear/consumables/bundles/partner panels wired
  into the chamber's arcade area; a dev-only blockchain testing console at `/dev/blockchain`.
- **Arcade polish rounds (#150 merged; #151, #152 still open drafts based on a stale `main` commit
  — their content is superseded by what actually shipped; recommend closing both, no unique value
  left unmerged.)**
- **UI professionalization + arcade-tab consolidation (#156)**: button touch-target/focus-ring
  audit fixes; folded the chamber's ARCADE tab into CLIMATE (see the CI regression this caused,
  fixed above in #158).

## What shipped 2026-07-03 (PR #137)

A large hardening + feature batch (all gate-green, CI green each push):
1. **Whole-web crash hardening** — a route-wide client-exception sweep found the
   "unexpected API shape white-screens the page" class in 5 pages (`/university`,
   `/lab/strains/[id]`, `/university/learner`, `/admin/economy`, plus the
   `/plants/:id/events` fixture crash. All fixed with shape guards; locked in by
   a permanent `web/e2e/route-crash-sweep.spec.ts` (29 routes, 0 crashes now).
2. **Mobile** — fixed the chamber HUD CB₂ chip clipping off a 390px screen
   (the "text off the screen" report); verified overflow clean across all routes.
3. **React #418** hydration errors (every page) fixed at the footer build-stamp.
4. **Store** — panelized/tiled look (owner request) + fixed a bogus "undefined —
   Seasonal genetics" card.
5. **Consumables "use item"** wired — owned consumables are finally usable on a
   plant (`POST .../apply`), the missing half of the store loop. No ledger touch.
6. **Pod-recycle + particle fixes** (earlier in the session, see BACKLOG).
7. **Memory/process** — resolved committed git conflict markers in `BACKLOG.md`
   and added `check_memory.py` check #6 (conflict-marker gate); retired 12
   verified-dead web files (Command Center / FTUE supersessions); corrected a
   stale `/contracts` backlog claim; README + this baton refreshed.

## What shipped 2026-07-02 (PRs #104–#110)

1. **Security hardening** — waitlist PII/enumeration/DoS fixes, deposit fail-closed off-mock,
   401-only session death, root fly.toml `APP_ENV=production`, non-root Docker.
2. **Grow room reverted to the procedural plant** — photoreal stills deleted (ADR 2026-07-02).
3. **HERMES University** — mastery now credits completed courses (was dead for 14/15 courses);
   produce-once lecture audio (ElevenLabs billed once per course; verified live: cache-hit);
   difficulty picker removed; online-school catalog; codex doc `design/10-hermes-university.md`.
4. **Prod outage + restore** — the untested rate-limit boot guard 502'd the first auto-deploy
   (no Redis); fixed via acknowledged `RATELIMIT_ALLOW_MEMORY` + 3 guard tests (see
   `docs/memory/INCIDENTS.md`).
5. **Process enforcement** — backlog staleness gate in check-memory; INCIDENTS twice-rule
   ledger; `docs/memory/DOCS_INDEX.md` docs tracking layer + stale-doc corrections
   (DEPLOY_FLY, SECURITY.md backups, MASTER_BIBLE banner, licenses/buds notes).
6. **Real Claude Master Grower** — `ai/master_grower_claude.py` on `MASTER_GROWER_MODEL`
   (default Haiku 4.5, cheap); factory returns it with a key, mock in CI unchanged.
   Advisor/auto-care and the Professor lecturer already had real Claude providers.
7. **AI stack activated live (PR #107)** — owner set `ANTHROPIC_API_KEY` + `ADVISOR_MODEL` in
   Fly secrets; live traffic hit a real bug the mock never exercises: Haiku rejects the
   hardcoded `thinking:{"type":"adaptive"}` param (400), 503-ing every lecture. Fixed with
   `ai/anthropic_compat.parse_preferring_thinking` (retry once without thinking on a capability
   400); both the advisor and lecturer now use it. **The AI-stack rollout is done, not
   pending** — see `docs/memory/INCIDENTS.md` "Provider 400s on model-capability mismatch."
8. **Blue Dream pilot, rounds 1-3 (PRs #108–#110)** — one strain, authored end-to-end against an
   owner reference photo: round 1 identity (new blue-teal palette family, BudDNA, silhouette),
   round 2 renderer realism (de-grape, cola proportion cap, leaf naturalism, connectivity),
   round 3 smoothing (closed midpoint-quadratic spline bud-mass silhouette, node-leaf-driven
   lower-canopy "skirt"). Template intended to roll out to the other 28 strains once approved.
9. **Design Codex 11 (PR #110)** — `docs/memory/design/11-global-learning-memory.md`: spec for
   per-player personalization + a global, append-only, anonymized-on-read knowledge layer so
   the AI teacher gets smarter from every player. 4 additive phases (Capture → Personal →
   Retrieve → Insights). Registered in `MAP.md`; **not built yet** (design only).

## NEXT ACTION (single)

**Audit + merge the `gv-o01-store-correctness` PR, then start `claude/gv-o02-equipment-sim-effects`**
(weeks 2–3 of `docs/memory/ROADMAP_90D_2026Q3.md` — the flagship slice). The chamber-mockup
reconciliation was resolved 2026-07-06 (owner chose replace — shipped in PR #159); the 90-day plan
supersedes the old "(b) proceed to p02" path — p02 is week 9.

**Older owner-directed threads, still open, not gating anything (tracked in BACKLOG.md):**
1. **Onboarding rework (owner, 2026-07-03):** "it's too long, not exciting, doesn't really work —
   set up some sort of onboarding with AI helping along the way." The AI advisor (Master Grower)
   already exists on the dashboard, plant detail, FTUE (per-step coaching) and University — it's
   wired, just not prominent. Current onboarding = a 4-beat cinematic landing (`/onboarding`) + a
   7-step FTUE (`/ftue`). Overlaps GrowVerse Phase 18's onboarding-finish requirement.
2. **Plant render:** owner says it's not 10/10 (honest self-score ~8), under the owner's own
   "don't chase the macro bud" freeze — needs the owner to name the specific gap (or lift the
   freeze).
3. **Cleanup:** close stale draft PRs #151, #152 (arcade polish — superseded, no unique content).

Off-limits unless separately approved: economy values, treasury paths, settlement deposit/withdraw.

## Verification split

- **Agent-verified (test-backed, this session):** all 7 defects (S1 S2 S6 S7 C2 C3 C4) have a
  passing unit/integration test pinned to the exact behavior (see "What shipped 2026-07-07"
  above); full backend suite (1184 passed/6 skipped, 91.90% coverage), backend lint, check-memory,
  web typecheck/lint/build, and full web vitest suite (511/511) all green.
- **Device-verify (owner):** click through `/store` (a pinned featured strain should show a real
  GC price and buy correctly; GC balance in the header should update immediately after any
  purchase) and `/dashboard` harvests (a common harvest's Mint button should be disabled with a
  tooltip; start a cure and confirm Sell disappears and Finish-cure shows a live ETA countdown
  instead of being immediately clickable). Also carried: the chamber-mockup reconciliation
  decision (above); growverse.dev spot-check that the ARCADE-tab-removal UX change (#156) still
  feels right now that its test coverage is restored.

## OPEN RISKS (carried)

- **Rate limits are per-worker in-memory in prod** (`RATELIMIT_ALLOW_MEMORY=true` in
  `fly.toml`) until Redis is attached (`fly redis create` → `RATELIMIT_STORAGE_URI` secret →
  delete the override line). INCIDENTS.md tracks it (🟡).
- **Settlement deposit disabled off-mock** (fail-closed) pending the player-signed,
  indexer-verified redesign; withdraw lacks a general idempotency key (endpoint-specific keys
  landed in #149; a fully general header is still `## 🟠 Medium` in BACKLOG).
- **5 no-op feature flags + web never reads `/flags`** (false kill switches) — BACKLOG REC-005.
- **No automated DB backups** (SECURITY.md corrected; snapshot workflow still to build).
- **Docs hygiene tail** (BUILDLOG, frozen "Live" ledgers, DEV_BUILD_LOG, 00–09 snapshots) —
  `docs/memory/DOCS_INDEX.md` stale ledger + BACKLOG item.
- **Two stale open draft PRs** (#151, #152) — superseded arcade-polish work, safe to close.
