# Backlog (Layer 3) — single source of priority

Status: `⬜ todo · 🔨 doing · ✅ done · ❄️ parked`. Standups may *propose* items; they're only real
once they appear here. Last reconciled: **2026-06-14** (REC-004 full repository memory sweep).

> **Reconciliation note (REC-004, 2026-06-14):** the Graphics Phase + Dashboard wiring are done and
> signed off; the studio is on the **New-Player / Launch-Readiness** track below. The full ledger of
> PRs / branches / directives + the launch critical path + department status live in
> `docs/memory/CANONICAL_STATE.md`.

## 🚀 New-Player / Launch-Readiness (ACTIVE track — onboarding → MVP launch)
> Player-facing, additive work on existing rails toward a launchable MVP — **no economy / chain /
> breeding / factions / combat / new crop families, no new Phase-2 systems.** Off-chain MVP first.
- 🚀 ✅ **FTUE Epic — guided first grow** (merged 2026-06-14) — **PR #34** starter-grant rail
  (one-shot/idempotent via `grant_claims` unique index, migration `c7ecd7523cc8`), **PR #35** tutorial
  backend (`services/ftue_service.py` — a guarded deterministic step machine on `Player.ftue_step`,
  per-step scripted AI Master Grower coaching `ai/ftue_coach.py`, tutorial-only time-compression,
  `/ftue` endpoints, migration `9d669edf48a8`), **PR #39** web `/ftue` guided route. New signups walk
  plant → water → climate → grow → harvest → "come back tomorrow". ADR in `DECISIONS.md` (2026-06-14);
  5 FTUE tests in `tests/test_ftue.py`.
- 🚀 ✅ **Launch Strain Integration Pack** (PR #33, merged 2026-06-13) — White Rhino, White Fire OG,
  Gelato, Wedding Cake added to `data/strains.yaml` + `data/strain_knowledge.yaml` (catalog now
  **29 strains**, 1:1 KB sync test green) with authored chamber visuals + per-strain physics knobs.
- 🚀 ✅ **Mobile-first navigation** (PR #36, merged 2026-06-14) — native bottom tab bar (primary +
  "More" sheet), `env(safe-area-inset-*)` handling, focus-visible rings, thumb-zone CTA targets
  (≥44px), responsive Grow Chamber. ADR in `DECISIONS.md` (2026-06-14). (PR #40's competing bottom-nav
  was retired — FP-1 superseded by #36; see `docs/STUDIO_AGENT_REGISTRY.md` collision log.)
- 🚀 ✅ **DX-001 Care Feedback & Celebration** (PR #41, merged 2026-06-14) — rewarding care actions +
  a harvest moment (`web/src/components/plant/CareFeedback.tsx`, `web/src/components/plant/careFeedback.ts`,
  `web/src/lib/haptics.ts`, `web/src/hooks/usePrefersReducedMotion.ts`); reduced-motion safe. Addresses
  #37's FP-5/FP-9 friction.
- 🚀 ✅ **FP-3 Primary Plant CTA** (PR #45, "DIR-004", merged 2026-06-14) — the next action is always
  visually primary on the dashboard for a new grower (`web/src/lib/plantAction.ts`,
  `web/src/components/plant/PlantActionCTA.tsx`). The re-cut of #37's FP-3.
- 🚀 ⬜ **Salvaged from PR #37 (Grow Guide, closed)** — backend work orders the closed coach needed,
  not yet built: **WO-1** per-action "last cared at" / care-acknowledged signals (so a tutorial can
  gate discrete Water/Feed/Check steps without guessing from decaying levels); **WO-2** a lightweight
  "session delta / welcome-back" endpoint (what changed since last seen — stage advances, new buds,
  frost) to power a return-moment. Both are backend (WO-gated); design only until approved.
- 🚀 ✅ **Feature Flags** (PR #42, landed 2026-06-14) — data-driven MVP launch gate: non-MVP systems
  (marketplace, on-chain `chain`, Cup, University, contracts) gated **OFF by default**. Backend
  `config.Settings` `ENABLE_*` → `app.config["FEATURE_*"]` enforced by a `require_feature` decorator
  (`api/feature_gates.py`) applied **above** `require_player` (gated route → **404 before auth**). Web
  mirrors via `NEXT_PUBLIC_ENABLE_*` (`web/src/lib/features.ts`): feature-gating lives in the shared
  `web/src/components/layout/navLinks.ts` so **both** the desktop `NavBar` and the mobile `MobileTabBar`
  hide gated entries, plus `RequireFeature` route guards and in-page hides. Tests:
  `tests/test_feature_gates.py`, `web/src/lib/__tests__/features.test.ts`. ADR in `DECISIONS.md`
  (2026-06-14).
- 🚀 ⬜ **Playtesting → Retention Validation → MVP Launch Candidate** — the launch critical-path tail.
- 🚀 ❄️ **OMNI Charter v1.0** (PR #38, merged 2026-06-14) — organizational constitution
  (`docs/OMNI_CHARTER.md`): chain of command, departments, work-order system, canonical principles.
  Governance layer; no further backlog action.

## 🎨 Graphics Phase II/III (COMPLETE — signed off 2026-06-14; no scope expansion)
> The game's emotional core is the whole-plant chamber view. This track is **visual-only** —
> no economy / chain / breeding / factions / combat / new crop families. Canon lives in
> `knowledge/` (botanical-bible, macro-bud-rules, whole-plant-architecture, strain-dna,
> environment-rules, procedural-generation). The macro bud system is launch-ready; the whole-plant
> system foundation is complete. **PR numbering shifted mid-phase** (PRs #27 Phenotype + #28
> Circadian were opened by a parallel session), so Canonical Stage PNG is #29 and Dashboard wiring
> is now #30 — see entries below.
- 🎨 ✅ **PR #25 — De-Grape Whole Plant Buds** (merged 2026-06-14) — chamber flower sites paint a
  continuous bud-mass silhouette behind the calyxes so they read as stacked colas, not loose
  circles. ADR in `DECISIONS.md` (2026-06-13). Owner visual sign-off 2026-06-14 (canonical stills).
- 🎨 ✅ **PR #26 — Bud Weight Physics Polish** (merged 2026-06-14, with #29) —
  `web/src/lib/chamber/budPhysics.ts`
  (`flowerStageMultiplier` / `branchFlex` / `branchDroop` ≤12° / `colaLean` ≤5° / `airflowWeighting`)
  + per-strain `branchStrength`/`budWeightMul` knobs; droop applied as branch rotation, bud mass
  folded into the airflow wave. G13 upright/strong · PDP heavy/sagging · Animal Mints balanced.
  Owner visual sign-off 2026-06-14.
- 🎨 ✅ **PR #29 — Canonical Stage PNG Generation** (landed 2026-06-14, carried on #26's branch) —
  the chamber renderer was extracted verbatim into a framework-agnostic `web/src/lib/chamber/chamberCore.ts`
  (single source for the live component + a headless generator); `web/scripts/gen-stage-pngs.ts`
  (`npm run gen:stages`) renders the curated strains × stage matrix to PNG via `@napi-rs/canvas`
  (output `web/canonical-stages/`, gitignored). De-grape ported into `chamberCore` on merge.
- 🎨 ✅ **Phyllotaxy & Pseudo-3-D Depth — Engines 3 & 4** (branch `claude/cannabis-growth-engine-s114yu`,
  2026-06-14) — the whole-plant skeleton now winds nodes around the stem by a real azimuth (decussate
  base → 137.5° golden spiral apex) instead of flat left/right alternation, projected to pseudo-3-D
  (foreshortening + front/back depth + back→front paint order + atmospheric shade) with per-node leaf
  **yaw** so fans no longer all billboard at the camera, and a per-plant phase so no two plants align.
  New pure module `web/src/lib/chamber/phyllotaxy.ts` (+ tests, maturity-0 ≡ legacy alternation);
  `chamberCore` integration only. Silhouettes preserved (verified across the 7-strain × stage PNG
  matrix). ADR `DECISIONS.md` 2026-06-14. **Device sign-off pending** (owner to view the chamber).
- 🎨 ✅ **Apical Dominance / Multi-Cola — Engines 1 & 2** (PR #58, 2026-06-14) — strains now grow one
  dominant cola (spear: G13, White Fire OG) *or* several competing upright tops (bush: Purple Diddy
  Punch, White Rhino) from a new `Silhouette.apicalDominance` knob. New pure `apicalDominance.ts`
  (`colaTops`, mass-conserving, +tests); `chamberCore` promotes the top nodes into co-colas in flower
  only (single-cola + veg paths unchanged). ADR `DECISIONS.md` 2026-06-14. **Device sign-off pending.**
- 🎨 ⬜ **PR #27 — Phenotype Generator Foundation** — *PARKED* (open PR, green). Do not modify.
- 🎨 ⬜ **PR #28 — Circadian Leaf Motion** — *PARKED* (open PR, green). Do not modify. *Note: the
  per-node branch azimuth now available on `Node` (Engines 3&4, PR #58) is the natural input for
  light-seeking pitch + circadian droop when #28 lands.*
- 🎨 ✅ **PR #29/#30 — Dashboard / GameState Wiring Polish** (merged 2026-06-14) — consumption polish
  on the flat `GET …/plants/<id>/state` wire (it stays canonical; no aggregate `GameState` object —
  see `DECISIONS.md` 2026-06-14). Added a global `AuthErrorListener` (401/403 → session teardown,
  clears prior RISK #10) and `usePods` refresh-on-interval/focus.
- MVP Launch Candidate now lives on the 🚀 New-Player / Launch-Readiness track above (after Feature
  Flags → Mobile Polish → Playtesting → Retention Validation).
- 🎨 ⬜ **Macro Bud Polish II** (future; *not launch-blocking*) — sharper calyx ridges, denser calyx
  nesting, reduce the smooth-oval appearance on the Purple Diddy Punch *macro* bud, improve chunky
  calyx definition. Macro ("Detailed Bud View") only — the whole-plant chamber is signed off.

## 🚀 Launch-Readiness path (Builder Dept — STEP sequence)
> Feature Flags → **STEP 3 Simulation Test Clock** → STEP 4 e2e Grow Loop → Launch Readiness.
- 🚀 ✅ **STEP 3 — Simulation Test Clock** (BE-002, 2026-06-14) — dev/test-only `OffsetClock` on the
  existing compute-on-read seam: `/api/dev/clock/{,advance,reset}`, registered only when
  `GROW_TEST_CLOCK=true` on a non-production `APP_ENV` (force-disabled in prod). Advancing time posts
  **no ledger entries** (economy untouched), forward-only, capped at 8760h. ADR in `DECISIONS.md`
  (2026-06-14); usage in `docs/SIMULATION_TEST_CLOCK.md`; `tests/test_test_clock.py` (15).
- 🚀 ✅ **STEP 4 — e2e Grow Loop** (BE-004, 2026-06-14) — seed → plant → grow → flower → harvest →
  sell driven over the HTTP API and fast-forwarded with the STEP 3 dev clock
  (`tests/test_e2e_grow_loop.py`, 3). Ledger integrity proven (advancing time posts no entries).
  HTTP-boundary coverage for the value-bearing routes — withdraw/deposit/mint/nft — landed
  (`tests/test_http_boundary.py`, 13), partially closing RISK #8 (backend side). Report:
  `docs/STEP4_E2E_GROW_LOOP_VALIDATION.md`. Suite 262 green, 83.6% ≥ 79%. **Test-only, no source.**
- 🚀 ⬜ **STEP 4.5 — GameService on `active_clock()` + cure/auction e2e** (next; owner-approved
  2026-06-14) — one-line change (`game_service.py:82`, mirroring STEP 3) so the dev clock also
  fast-forwards harvest/**cure**/sell + auction expiry over HTTP, then extend the e2e loop to the
  cure step. Prod-behaviour identical (`active_clock()` → `SystemClock` in prod). See Risk #1 in the
  STEP 4 report.

## 🔴 Immediate (do now — correctness, truth, or unblocks others)
- 🔴 🔨 **Concurrency + idempotency hardening** (RISK #6) — *core landed 2026-06-10*: wallet
  optimistic locking (`version_id_col`) + `CHECK(cached_balance >= 0)` + harvest-once unique index
  (migration `f1a2b3c4d5e6`) + 409-on-conflict + the F5 flaky-limiter-test fix. +4 concurrency
  tests (189 total). Closes double-spend / double-harvest / negative-balance at the DB level.
  *Remaining (⬜): general `Idempotency-Key` header (duplicate → original response, not a 409) and
  one-shot-grant uniqueness (daily stipend, achievements).* See `DECISIONS.md` 2026-06-10 +
  `docs/audits/2026-06-10-fleet-sweep.md`.
- 🔴 ⬜ **Chain settlement verification** (RISK #7) — deposit must verify an on-chain txid
  (confirmed, asset-id, receiver=treasury, sender=linked addr, amount); txid replay protection
  (unique `onchain_txid`); reconciliation job; address validation/opt-in on link/withdraw. Blocks
  any real value moving (Sprint 4 gate).
- 🔴 ⬜ **Restore the web safety net** (RISK #8) — real vitest + Playwright in devDeps + CI (the
  scripts are `echo` stubs today); add HTTP-boundary tests for withdraw/deposit/mint
  (`game_api.py` 40% covered); global 401/403 handler.
- 🔴 ✅ **Make the integrity/CI gates REAL** (2026-06-10) — a chat found that
  `scripts/check_memory.py`, `scripts/check_single_head.py`, the SessionStart hook, **and
  `.github/workflows/ci.yml` did not exist on disk**, despite being claimed ✅ below and in
  `CLAUDE.md`/`MAP.md`. Built all four for real and verified locally: `make check-memory`,
  `make check-migrations`, `make lint`, and `make test` (**182 passed, 79.1% ≥ 78 gate**) all
  green; the two checkers carry a teeth-test. The four stale entries below are annotated. Also
  installed the **Session Relay Protocol** (`docs/SESSION_PROTOCOL.md` + `docs/HANDOFF.md`
  baton + `docs/audits/`). See standup `2026-06-10-lut-report.md`.
- ✅ Add `CLAUDE.md` + `docs/memory/` memory-layer system (this change).
- 🔴 ⬜ **Reconcile `docs/ROADMAP.md` with reality** — Sprints 1–3 are shipped but still show
  ⬜/🔨. Planning is reading a map that lies. *(partially fixed 2026-06-08; verify exit criteria)*
- 🔴 ⬜ **Retire/replace `docs/NEXT_SESSION_SPRINT3.md`** — Sprint 3 is done; the handoff is stale.
- 🔴 ⬜ **Fix `BUILDLOG.md` header** referencing the old trunk branch
  `claude/cannabis-game-lut-economics-utfiK`. *(fixed 2026-06-08 — keep an eye on drift)*
- ✅ **Repair the dev env install** (2026-06-08) — added `Makefile` (`make setup` = venv-based
  install, sidesteps the system-PyYAML collision), a `pyproject.toml` build backend so
  `pip install -e .` uses PEP 660 (no more legacy `install_layout` crash), and a
  `.claude/hooks/session-start.sh` SessionStart hook so web sessions install deps automatically
  (sets `PYTHONPATH=src`, mirroring CI). Validated: hook exit 0, `make setup && make test` →
  139 passed. *(⚠️ Drift corrected 2026-06-10: the hook file was actually absent on disk; it
  was built for real this session and now fires — see the Immediate entry above.)*

- 🔴 ✅ **Memory-integrity gate** (2026-06-08) — `scripts/check_memory.py` + `make check-memory` +
  a CI step fail on broken internal links, ✅ claims citing missing paths, or a codex that drifts out
  of the layer map. Plus a master `docs/memory/MAP.md` (layer map + code↔doc index + moat dashboard);
  ARCHITECTURE invariant #9 + two DECISIONS entries (Phase A, provable fairness) reconcile the layers
  with this session's code. *(Partly delivers the "docs-drift check" from the 2026-06-08 standup §4A.)*
  *(⚠️ Drift corrected 2026-06-10: `scripts/check_memory.py` was absent on disk; built for real
  + teeth-tested this session.)*

## 🟠 Medium (next 1–2 weeks — quality & the next real capability)
- 🟠 ✅ **CI coverage gate** (2026-06-08) — `pytest --cov` with a ratchet floor (`pyproject.toml`
  `fail_under=78`, ops scripts omitted), wired into `make test` + CI. Completes the "make truth
  automatic" trio (lint + memory-integrity + coverage). *Ratchet the floor up as coverage climbs.*
  *(⚠️ Drift corrected 2026-06-10: the coverage gate works in `make test`, but the claimed CI did
  not exist — `.github/workflows/ci.yml` was built for real this session.)*
- 🟠 ⬜ **Sprint 4: real TestNet + IPFS** — fund treasury, run `reset_asa`, wire `ASA_ID`; move NFT
  metadata to IPFS; add a DB↔chain reconciliation job + `onchain_txid` audit.
- 🟠 ✅ **Sim cost cap** (2026-06-10) — compute-on-read is bounded: one catch-up simulates at most
  `max_catchup_hours`, then the plant goes **dormant** through the rest of the gap (stage clock
  pauses; auditable `dormancy` event) and lands at `now` — one cap window once ever per derelict
  plant (311 ms → 0.1 ms on the next read), near-term reads bit-identical (parity-tested). +3 tests
  (185 total). ADR in `DECISIONS.md`. *Remaining (⬜): background materialization for bursts of
  first-reads at scale.*
- 🟠 ⬜ **Idempotency keys on mutations** — protect ledger/economy from double-submits & retries.
- 🟠 ⬜ **Anti-bot / fair-play framework (spec)** (owner request, 2026-06-11) — defense-in-depth
  against automation farming the faucets, layered so honest players never feel it:
  (1) **humanity gates** — lightweight proof-of-humanity challenges only at high-value moments
  (claim/mint/withdraw), never on the core grow loop; (2) **behavioral telemetry** — server-side
  cadence/entropy scoring per player (inter-action timing distributions, diurnal rhythm, input
  variety) — signals only, never auto-ban; (3) **diminishing-returns penalty** — per-day soft caps
  that taper faucet yield under inhuman cadence instead of hard-blocking; (4) **Sybil costs** —
  new-account faucet throttle + earned-trust curve before faucets open fully, scaled by
  IP/ASN/device-cluster reputation; (5) **shadow-penalties** — flagged accounts keep playing but
  faucet earnings land in a quarantined ledger pending review, so botters get no oracle;
  (6) **human-in-the-loop gate** — no permanent penalty without manual review + an appeals path;
  (7) **Adversarial Twin** — a sanctioned in-repo bot harness that plays the live rules to find
  profitable automation before players do (red-team CI for the economy). Composes with the
  time+skill anti-bot moat per `docs/memory/design/03-grower-skills.md` and the no-dark-patterns
  charter per `docs/memory/design/04-honesty-and-trust.md`. **Spec logged; build on owner
  green-light.**
- 🟠 ⬜ **Load/soak test the `/state` catch-up path** to find the cost knee before players do.
- 🟠 ⬜ **Web e2e smoke** (Playwright) over the full loop; today web CI is lint/typecheck/build only.
- 🟠 ✅ **Sim depth — Phase A (derive VPD + DLI; wire the stored light scalar into the tick).** Done
  2026-06-08: `simulation/horticulture.py` (VPD/DLI/SVP), light + VPD health terms in `engine.py`
  (tuned in `balance.yaml`), VPD/DLI/PPFD exposed on `/state`. +8 tests (147 total, green). *Next:*
  Phase B (photosynthesis + transpiration + EC/pH→uptake) — land the sim-cost-cap first.

## 🟡 Low / later (valuable, not urgent)
- 🟡 ⬜ **Constellation leaf-mesh follow-ups (sacred-hash re-pin batch)** (helper review,
  2026-06-11) — three deferred items that each require intentionally changing a pinned render
  function in `web/src/components/viz/Constellation.tsx` (update the sha256 pins in
  `constellationLifecycle.test.ts` in the same commit, per its header): (a) batch the leaf mesh
  edges into one path — in leaf mode `hovered` is never set so all ~900 edges share a style, but
  `draw()` strokes per-edge today (~913 extra canvas calls/frame at `leafCount=260`); (b) derive
  the mesh edge color from the `accent` prop (hard-coded green today — constrains non-default
  accents); (c) consider debouncing the wordmark resize re-seed (O(n²) mesh rebuild per 8px step;
  ~19ms desktop at 260). Net page cost already went *down* vs the old 620-particle hero — do this
  before any low-end-mobile push, not before launch.
- 🟡 ⬜ Sprint 6 LiveOps: seasonal strains rotation, timed events, breeding competitions, admin
  console with hot-reload `balance.yaml`, analytics/telemetry.
- 🟡 ⬜ Non-custodial Pera/WalletConnect path for player-owned NFTs.
- 🟡 ⬜ **Fiat payment rail (parked by owner, 2026-06-11)** — launch liquidity is bring-your-own
  ALGO; see the ADR in `DECISIONS.md` (2026-06-11). If/when revisited: Stripe Checkout Sessions
  (+ Billing for subscriptions), gated behind RISK #7 (real settlement) being closed, a matching
  sink for the new faucet, and an explicit owner green-light (charter: real money = stop-and-ask).
- 🟡 ⬜ Observability upgrade: logs → metrics → traces as traffic grows.
- 🟡 ⬜ Secrets management hardening before any real value (encrypt keys at rest / secrets manager).
- 🟡 ⬜ Age-gating/compliance + ToS/privacy review (simulated cannabis only).
- 🟡 ⬜ **Generative genetics** — polygenic genome + mutation/epistasis/G×E toward endless,
  *discovered* strains; genome fingerprint → on-chain GenBank + Proof-of-Cultivation (needs Sprint 4
  chain). Per `docs/memory/design/02-genetics.md`.
- 🟡 ⬜ **Grower-skill mastery** — use-based skill trees (effort/time → capability), distinct from the
  spend-based research tree; the equipment bridge. Per `docs/memory/design/03-grower-skills.md`.
- 🟡 🔨 **Trust layer** — provable fairness landed for breeding (`/strains/<id>/provenance`) and the
  whole pedigree (`/strains/<id>/lineage`, the GenBank's verifiable family tree). Remaining: generalize
  replay to sim/weather/discovery, a genome fingerprint, a public faucet-vs-sink economy view, advisor
  confidence/uncertainty surfacing, and a no-dark-patterns charter. Per `docs/memory/design/04-honesty-and-trust.md`.

- 🟡 ✅ **Strain knowledge base** (2026-06-08) — catalog grown 16→22 (iconic landraces/classics) +
  `data/strain_knowledge.yaml`, a scientist-grade encyclopedia (lineage, origin, cannabinoid/terpene
  detail, cultivation params) for every catalog strain, at public `GET /strains/<id>/knowledge`. A
  test enforces 1:1 catalog↔KB sync.
- 🟡 ✅ **Deep-research campaign** (2026-06-08) — `docs/research/2026-06-08-cannabis-strain-genetics-and-cultivation.md`:
  5-agent, peer-reviewed-prioritized reference on lineage, chemotype, cultivation, agronomy, and
  taxonomy/genetics. Reconciled into the KB (disputed-lineage flags + scientific caveats header).
- 🟡 ⬜ **KB enrichment pass (research-grounded)** — add a `terpene_cluster` per strain (myrcene /
  terpinolene / limonene-caryophyllene); model assayed THC as an inflation-biased distribution; wire
  the PPFD/DLI→yield relationship into the sim (Phase B). Per the research doc's §6 action items.
- 🟡 ✅ **Seasonal Cannabis Cup** (2026-06-08) — `services/cup_service.py` + `CannabisCup`/`CupEntry`
  models + migration `d5e6f7a8b9c0`: per-season competition, deterministic `cup_score`, lifetime
  champion rewards (one-of-a-kind legendary trophy strain + permanent title + Hall of Fame). Public
  `/cup/*` + authed enter; +9 tests. *Next (⬜): on-chain trophy NFT (Sprint 4), judged terpene-cluster
  categories, grower-reputation tie-in.* Per `docs/memory/design/05-events-and-competition.md`.
- 🟠 ✅ **CI: enforce a single Alembic head** (2026-06-08) — `scripts/check_single_head.py` (reads the
  migration graph via `ScriptDirectory`, fails with an actionable `alembic merge` hint on a fork),
  wired into `make check-migrations` + a CI step before `alembic upgrade head`. Catches the fork class
  of bug (e.g. the old `fbb8fceedacd` fork) automatically instead of by manual testing.
  *(⚠️ Drift corrected 2026-06-10: `scripts/check_single_head.py` was absent on disk; built for real
  + verified (single head `e7a9c1b3f2d8`) this session.)*
- 🟡 ✅ **GrowPod University** (2026-06-08) — `services/university_service.py` + `lecturer_service.py`
  + `data/curriculum.yaml` + `CourseEnrollment`/`DegreeProgress` + migration `e7a9c1b3f2d8`: enroll
  (tuition sink) → time + practical study → degrees (permanent perks via the research effect keys +
  a title + XP), taught by an AI Professor (mock for CI, Claude in prod). Public `/university/catalog`
  + authed enroll/complete/claim/lecture; +13 tests. Grounded in a cited curriculum research report.
  *Next (⬜): quizzes, more departments, Doctorate tier, diploma NFTs.* Per `docs/memory/design/06-university.md`.
- 🟡 ✅ **Web client — full UI build** (2026-06-08, branch `claude/growv2-web-ui-build-MZWZE`) — the
  Next 15 client now covers all seven screen groups (onboarding hero · grow dashboard with VPD/DLI/PPFD
  · strain lab + encyclopedia + DNA/lineage constellations + Verify provenance · GenBank galaxy ·
  market fixed/auctions/contracts · Cannabis Cup + Hall of Fame · University catalog/transcript/course
  + AI Professor lecture reader · Profile with lifetime titles). Centerpiece: dependency-free
  `web/src/components/viz/Constellation.tsx` (the genetic-constellation signature language). Green
  typecheck/lint/build + live-API contract smoke. Post-build cleanup: fixed a Constellation
  stale-deps bug (genome graphs reused locus ids across strains → now keyed on content + edges),
  hex-sanitized canvas colors + position clamp, retired `/account`+`/contracts` → redirects, and an
  a11y pass (Modal Escape/`role=dialog`, ARIA tabs, `aria-pressed` chips, input/select labels,
  reduced-motion). Follow-up pass: **constellation perf** (O(n²) repulsion → uniform spatial-hash
  grid, semantics preserved) and a **Vitest unit-test harness** (71 tests over `format.ts` +
  `graphAdapters.ts`, `pool: forks` for sandbox/CI robustness, wired into web CI). See standup
  `2026-06-08-lut-report-web-ui-build.md`.
- 🟠 ✅ **Web e2e smoke (Playwright)** (2026-06-08) — mocked-API Playwright suite (`web/e2e/`,
  `playwright.config.ts`) over onboarding + authed dashboard + university; `test:e2e` script + a CI
  `e2e` job. It immediately caught **two real browser-only bugs**, both fixed: (1) the CSP
  `script-src 'self'` blocked Next's inline hydration scripts so the app blanked in-browser — fixed
  by allowing `'unsafe-inline'` for scripts (sources still locked to self, eval still blocked);
  (2) the dashboard's Zustand selector returned a fresh `[]` each render → React #185 infinite loop
  that crashed the page for players with no locally-stored ids — fixed with a stable reference.
- 🟡 ⬜ **Education-gated Master Grower knowledge** (owner idea, 2026-06-08) — tie advisor depth +
  unlocks (tips/tricks, rare bio-DNA traits, breeding **pollen**, "DNA-in-the-seed") to University
  progress. Composes existing systems: degree perks (research effect keys) raise an advisor knowledge
  tier and unlock breeding consumables that bias the still-seeded, provably-fair cross. Needs a design
  doc + balance pass; no new infra.
- 🟡 ⬜ **Sponsored / branded content (revenue)** (owner idea, 2026-06-08) — real cannabis brands
  sponsoring cultivars, branded equipment/pods, and promotions, using the on-chain asset layer to
  sidestep traditional ad/banking restrictions. A "sponsored cultivar" is a GenBank entry with
  verifiable provenance + brand tag. Needs a partner/content model + a no-dark-patterns guardrail
  (ties into the trust layer charter). Business/LiveOps track.

## ✅ Recently shipped (2026-06-07) — see standup 2026-06-08
Foundation P1–P3; Wave 0 retention; Wave 1 hardening (auth/errors/health/CI/docker/openapi);
Wave 2 depth (search, leaderboards, auctions, weather, automation, stabilization, ASA settlement,
contracts); Wave 3 property tests; Sprint 3 web client; security audit (#4); game expansion (#6:
auction-exploit fix, legacy removal, curing/terpenes, research tree/shop/seasons, AI advisor +
agentic auto-care); manual/docs suite (#5).
