# HANDOFF — the baton

> Single source of truth for **what the next chat does first**. Rewritten by `/closeout` at
> the end of every chat; read by `/handoff-audit` at the start of the next. If this file and
> the code disagree, the code wins — fix the baton. See `docs/SESSION_PROTOCOL.md`.

**Last rewritten:** 2026-07-07 (later still) · **By:** the `gv-o03f-arcade-polish` session — another
**off-roadmap** owner-directed pass, run in parallel with `ROADMAP_90D_2026Q3.md`. Owner's dictated
ask: "polish off the arcade part of the game" (the single-plant chamber screen). This session
executed the already-decided Arcade preview-growth-scrubber removal (recorded in `BACKLOG.md`/
`DECISIONS.md` from PR #176) and did a light polish audit — see "What shipped" below and
VER-022/022b in `VERIFIED_RENDERS.md`. The prior session, `gv-o03d-plant-scale-vitality` (indica
scale + idle-motion fix, PR #178), is already merged to `main` — this branch was cut from
post-#178 `main`.
**Active branch:** `claude/gv-o03f-arcade-polish` — draft PR (see below) open against `main`. All
gates green: backend `make test` 1210 passed/6 skipped/91.74% coverage (untouched by this
pure-frontend change, re-run for the record), `make check-memory` OK, `make lint` clean; web
typecheck/build/lint clean, full web vitest suite 528/528, 39 relevant Playwright e2e specs
(care-loop-shot, chamber-landscape-hud-shot, growth-boost-shot, turbo-shot, slider-shot,
bud3d-shot, the full 30-route crash-sweep) all green.
**Per `docs/memory/DECISIONS.md`, D2 and D3 are RESOLVED** (D2: staking `reward_pct` = 2%; D3: cure
clock moves to the player-effective/turbo clock with a wall-clock floor) — `claude/gv-o04-cure-
mint-integrity` (week 5, protected-surface) is unblocked pending a direct re-read of
`DECISIONS.md` by whoever starts it (this session didn't touch that work — out of scope for an
Arcade-page polish pass).
**NEXT CHAT STARTS HERE:** get this PR merged (after CI + owner review), then either (a) resume
`ROADMAP_90D_2026Q3.md` week 5 (`gv-o04-cure-mint-integrity`) now that D2/D3 read as resolved — a
Security-Reviewer checklist + owner sign-off is still required in that PR body per
BUILD_RULES.md's protected-surface gate — or (b) take further owner direction if there's more
Arcade/Command-Center polish or plant-render feedback.
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

## What shipped 2026-07-07 (latest — Arcade chamber polish, off-roadmap, `gv-o03f-arcade-polish`)

Owner's dictated ask: "polish off the arcade part of the game" (the single-plant chamber screen,
`dashboard/plants/[plantId]/chamber/page.tsx` — distinct from the Command Center hub redesigned in
PR #175 and the plant-scale/vitality fix in PR #178, below). Two decisions were already recorded
in `BACKLOG.md`/`DECISIONS.md` (D2/D3 plus the Arcade-scrubber call, PR #176); this session
executed the scrubber removal and did a light polish audit:

1. **Removed the Arcade page's own preview-growth scrubber** — the TIME tab, `previewDay`/
   `setPreviewDay` state, the `previewing` flag, and every branch reading it (`day`/`renderStage`/
   `dev`/`serverBud` now always resolve to the live/boosted values, collapsing what used to be
   preview-vs-live ternaries). `maxPreviewDay` survives renamed `maxGrowDay` — it's still the
   clamp ceiling the ⚡ Boost Growth mechanic needs. The purchasable growth boost and the rewind/
   time-travel snapshot system (`useRewindStore`) were left untouched, per the owner's guardrail.
2. **Polish audit** over the page + `ArcadeToolbar`/`PlantReactionLayer`/`BoostAmbientLayer`/
   `ChamberDock` found two dead-code items, both **deferred to BACKLOG** (not fixed) because
   fixing either means picking a direction inside the protected rewind system:
   `components/arcade/ArcadeHUD.tsx` is a fully orphaned component (no longer mounted anywhere —
   the rewind feature has had no player-facing entry point since an earlier PR removed its
   floating-over-the-plant mount), and `chamber/page.tsx`'s `budScalars` is computed every render
   but never passed to `GrowChamber`'s `dev` prop, so a restored rewind UI still wouldn't visually
   "un-grow" the bud on this screen (unlike `bud/page.tsx`'s `BudGL`, which does consume the
   equivalent scalars).
3. Two Playwright specs updated for the removed TIME tab: `care-loop-shot.spec.ts` (asserted TIME
   was visible, now asserts `toHaveCount(0)`) and `chamber-landscape-hud-shot.spec.ts` (stale
   comment/redundant assertion cleaned up). New golden captures VER-022/022b confirm only GROW/
   CLIMATE tabs render, no "· preview" badge.
4. Verification: backend `make test` 1210 passed/6 skipped/91.74% coverage (unchanged — no backend
   files touched), `make lint`/`make check-memory` clean; web `npm run typecheck`/`lint`/`build`
   clean, `npm run test` 528/528; `npx playwright test care-loop-shot chamber-landscape-hud-shot
   growth-boost-shot turbo-shot slider-shot bud3d-shot` (9/9) + the full `route-crash-sweep`
   (30/30) all green. No protected surfaces touched.

## What shipped 2026-07-07 (earlier — off-roadmap, `gv-o03d-plant-scale-vitality`, PR #178)

Owner lifted the round-8 plant-render freeze by naming the gap: indica strains read too
small/weak, and idle motion too subtle. Root cause traced to `INDICA.heightMul` (0.74 vs
`SATIVA`'s 1.22, `web/src/lib/chamber/morphology.ts`) modulating a fraction of the SAME fixed
canvas frame that every strain shares, with branch/cola mass deriving from that same stem
height (`chamberCore.ts`'s `buildPlant`) — so a mature indica-leaning plant used only ~half the
vertical frame a sativa reaches, reading as shrunken rather than short-and-bushy.
- **Scale/presence fix:** `INDICA.heightMul` 0.74 → 0.88, plus a mature-flower presence floor in
  `buildPlant` (`hN` never below 58% of frame once flowering is underway, ramped in only after
  day 34 so seedling/veg curves are untouched). Verified against the two worst-case real strains
  (Northern Lights indica_ratio 1.0, Hindu Kush 0.9); Durban Poison (sativa baseline, 0.0) renders
  pixel-identical before/after, confirming the sativa/indica shape distinction is preserved.
- **Idle-motion liveliness:** `climateModel`'s `windAmp` floor/ceiling raised (0.004→0.007,
  0.05→0.062); branch sway gained a second, slower, out-of-phase wave so the canopy doesn't read
  as one rigid shape rocking in unison; leaflets get a small independent flutter (`drawFan`, ~2°,
  via a new module-scoped `frameTT`); the hero cola's bloom halo now breathes (±5% radius, ~10s
  period). All new motion is gated on the existing `motionOK` (`prefers-reduced-motion`) check —
  reduced-motion users see zero change.
- **Evidence:** VER-018 (Hindu Kush before/after) / VER-019 (Northern Lights before) / VER-020
  (Northern Lights after) / VER-021 (real in-app chamber integration, Gelato) in
  `VERIFIED_RENDERS.md`; a headless-render pixel diff between two animation frames shows ~58%
  more mean movement after the motion change (quantitative liveliness check, not just eyeballing).
- **Self-score: ~9/10**, not 10/10 — the owner's own framing ("a lot of branch work still needs to
  be done") signals this is one round of an ongoing series; branch-level architecture
  (candelabra spacing, branchlet placement, apical-dominance tuning) was deliberately untouched
  this round and is the likely next target if the owner still sees a gap.
- **Not touched (guardrail, confirmed in scope):** `balance.yaml`, migrations, auth/lockfiles, the
  Arcade chamber page's preview-growth scrubber, the Today's Plan panel.

## What shipped 2026-07-07 (off-roadmap, owner `/goal` audit — `gv-o03b-pod-button-fixes`, PR #174)

Owner asked for a pod-organization/button-wiring audit, a store-completeness + chain-wiring +
new-item audit, and a repeatable store-item workflow doc. Ran both audits independently, then
fixed the concrete, low-risk findings in one PR (bigger design-fork items queued in `BACKLOG.md`,
not fixed):

1. **A2** — `CreatePodForm.tsx` capacity input capped to 1–4 (was up to 12; dashboard only ever
   renders 4 plant slots per pod — the other 8 were invisible dead capacity).
2. **A3** — dashboard pod-switcher pill (`dashboard/page.tsx`) now reads the pod's real
   `capacity` instead of a hardcoded `"/4"`.
3. **A6** — `EnvironmentRail`'s AUTO badge tooltip no longer says "coming soon" when
   `auto_water`/`auto_feed` is already live for the pod's tier — was actively lying to players
   whose pod tier already has automation.
4. **B1** — Store's gear equip/unequip (`store/page.tsx`'s `GearCard`/`GrowRoomGearSection`) only
   worked for `category === "light"`, calling the superseded light-only `equipLight` API — fans
   and soils bought in-store had **no equip path in the store itself** (only via the chamber's
   GearPanel). Widened to any category and switched to the already-generic
   `equipGear`/`unequipGear` client functions; added an Unequip button.
5. **B2** — the two remaining hardcoded `fan: 45` chamber previews (plant detail page,
   standalone chamber page — `PodCommandCenter.tsx` was already fixed in week 4) now derive fan
   visual intensity from the pod's real equipped gear via `fanVisualIntensity`/`NO_FAN_BASELINE`,
   respecting `prefers-reduced-motion`.
6. **B3** — `CareButtons`' "Inspect" self-link (a dead link to the page it's already on) is now
   hidden via a new `onDetailPage` prop when mounted on the plant's own detail page.
7. **New `docs/memory/ADDING_STORE_ITEMS.md`** — the 9-step checklist for wiring a new store item
   end-to-end (`balance.yaml` → service method → API route → web type → UI listing → purchase
   flow + query invalidation → **gameplay-effect wiring**, the step every past defect (S3/S4/E1)
   skipped → tests at each layer → memory/docs update), with real file:line templates from the
   merged gv-o01/o02/o03 PRs. Also documents the `GearCategory`/`PodEquippedGear["category"]`
   type-union pair that has drifted out of sync before — treat as a matched pair going forward.
8. **`BACKLOG.md` reconciled**: A1 (pod tier/capacity/automation invisible, no upgrade UI), A4
   (dead `active` field / no real archive semantics), A5 (GearPanel 3 hops deep — a genuine
   design fork on where equip UI should live), B4 (setClimate CTA is a generic dashboard link,
   needs a pod-anchor feature that doesn't exist yet) recorded as open, deliberately not fixed
   this pass. Plus 10 new store-item ideas from the audit and the current chain/Algorand wiring
   status.

Verification: backend `make test` 1210 passed/6 skipped/91.73% coverage, `make check-memory` OK
(46 files), `make lint` clean; web `npm run typecheck && npm run build && npm run test` clean
(533/533), `npm run lint` only pre-existing warnings; `npx playwright test route-crash-sweep
care-loop-shot chamber-landscape-hud-shot` — 35 passed. No backend files touched. No protected
surfaces touched.

## What shipped 2026-07-07 (later still — ROADMAP_90D week 4, `gv-o03-pod-equipment-visuals`)

Merged the audited `gv-o02` PR #172, then built week 4 exactly as specced in
`ROADMAP_90D_2026Q3.md` §2 week 4 — fixes S4 and S5 from `AUDIT_NFT_STORE_LOOP.md`:

1. **New pure `web/src/lib/chamber/gearVisuals.ts`** (12 unit tests): maps equipped gear to
   chamber visuals — `fanVisualIntensity` (per-SKU airflow ranking, low ambient baseline with no
   fan), `lightGlowIntensity` (PPFD → 0.15–1 glow alpha), `soilTint` (per-SKU substrate color),
   `gearChips` (icon+name per equipped item).
2. **`PodCommandCenter.tsx` wiring** (S4): the hardcoded `climate={{ fan: 45 }}` now uses the
   equipped fan's real visual intensity (neutralized to the ambient baseline when
   `prefers-reduced-motion` is on, so a strong fan never adds MORE sway for those users — the
   pre-existing ambient idle motion is untouched); the cosmetic glow's alpha is now driven by the
   equipped light's real PPFD (`pod.light_intensity`); a new soil-tint radial gradient sits at
   the pot base; an equipped-gear chip row renders below the stage progress bar when any gear is
   equipped. `docs/memory/VERIFIED_RENDERS.md` VER-016 — capture-shots evidence (no gear vs. full
   fan+soil+light equipped, both viewports), full route-crash-sweep green.
3. **Desktop layout fix (owner-reported mid-session, same page):** the chamber (the reason the
   page exists) sat ~160px below the top of the `PlantDnaRail`/`EnvironmentRail` side rails,
   because the carousel thumbnail + "plant a seed" bar stacked above it in the center column's
   `xl:order-none` (= reset to DOM/source order) desktop override — mobile's `order-1` already
   put the chamber first, desktop didn't. Fixed by giving the chamber `xl:order-first`
   (order:-9999) instead, which pulls it to the front WITHOUT touching every other sibling's
   `xl:order-none` (order:0) — their relative order to each other is unchanged, only the chamber
   jumps ahead. Verified: mobile capture unaffected, desktop capture shows all 3 columns starting
   at the same y, and all 35 relevant e2e specs (care-loop-shot, chamber-landscape-hud-shot,
   the full 30-route crash sweep) still pass.
4. **In-store "Apply to plant" deep-link (S5):** a new pure `pickApplyTarget` helper
   (`lib/consumableAction.ts`, 5 unit tests) picks a live, unharvested plant for a consumable —
   preferring one matching the item's `stage_req` if any. The store's Consumables section shows
   an "Apply to plant →" link (when `owned > 0` and a target exists) to
   `/dashboard/plants/<id>?apply=<key>`; `ConsumablesPanel` reads that query param, scrolls the
   matching item into view, and gives it a brief highlight ring.
5. **`capture.spec.ts` gained `CAPTURE_POD_STATE`** (pod-level fixture overrides, mirroring the
   existing `CAPTURE_STATE`) — documented gotcha: its comma-split parser breaks on a
   multi-property JSON value (any embedded comma splits mid-JSON before `JSON.parse` sees it);
   for a real equipped-gear matrix, call `setup()`'s `extraOverrides` directly instead (see the
   temp spec pattern used this session, deleted before commit).
6. Full gates green: web `typecheck`/`lint`/`build` clean, `npm run test` 533/533 (was 516 — +17
   new: 12 gearVisuals + 5 pickApplyTarget), full route-crash-sweep (30 routes) + care-loop-shot +
   chamber-landscape-hud-shot e2e all green. No backend files touched this week (S4/S5 are
   web-only per the roadmap's "do NOT touch: sim engine, balance.yaml, 3D bud viewer" — backend
   suite re-run anyway for the record: 1210 passed/6 skipped, unchanged from `gv-o02`).

## What shipped 2026-07-07 (later this day — ROADMAP_90D weeks 2-3, `gv-o02-equipment-sim-effects`)

Opened with `/handoff-audit` on the just-merged PR #171 (independent auditor: PASS — every claim
verified against the diff, all gates re-run green, no scope creep, do-NOT-touch boundary held).
Then built the flagship slice — fans/soils/CO₂ get real, tunable, **both-signed** simulation
effects (owner directive) — exactly as specced in `ROADMAP_90D_2026Q3.md` §2 weeks 2–3:

1. **New pure `simulation/gear.py`** (`GearEffects` + `effects_for`): merges every equipped item's
   `effects` block (offsets sum, mults compound), clamped to sane bounds (offsets ±10, mults
   0.5–1.5). 100% test coverage, 11 unit tests (`tests/test_gear_effects.py`) — determinism,
   clamping, the coco-coir tradeoff direction, unknown-key safety.
2. **Engine wiring** (`simulation/engine.py`): `_env_for` applies equipped fans' temp/humidity
   offsets to the *effective* environment the health math scores (display-facing
   `environment_for` stays unaffected — raw sensor reading only); `_step` applies pest/disease
   mults to hourly pressure and water/nutrient mults to decay; `catch_up` reads the pod's equipped
   `GearInventory` rows once per catch-up and threads the merged `GearEffects` through
   `EngineContext`. **CO2 is real now** (E1/E2): an `optimal_ppm` stress band plus a narrower
   `enriched_ppm` sweet spot that earns a small growth bonus — the sweet spot deliberately
   excludes the unsensored default (800 ppm) so no existing plant's numbers changed.
   `tests/test_engine_parity.py` stays green (no gear -> byte-identical); new
   `tests/test_gear_engine_effects.py` proves the fan **helps in a humid pod and hurts in a dry
   one** (same equipment, opposite sign — both an instantaneous `_health_target` proof and a 48h
   trajectory), the coco tradeoff over a real 30h decay run, and the CO2 stress/bonus bands.
3. **Generalized equip**: `GameService.equip_gear`/`unequip_gear` — one equipped item per category
   per pod (reuses `GearInventory.equipped_pod_id`, **no migration**), lights keep writing PPFD;
   `equip_light` kept unchanged for backward compatibility. New routes
   `POST /players/<pid>/pods/<pod>/equip-gear` + `/unequip-gear` (`Idempotency-Key` supported, same
   as every other mutation route). 8 new service tests (`tests/test_gear.py`).
4. **Flowering quality bonus** (bat_guano, etc.): applied at harvest as a flat quality add from
   whatever's equipped on the pod, same clamp as the research quality_bonus.
5. **Serializer + web**: `pod_dict` now exposes `equipped_gear` + merged `gear_effects` (feeds
   `gv-o03`'s chamber visuals) via the pod's own bound session — no existing call site changed.
   `GearPanel.tsx` drops the `["light"]`-only filter (fans/soils are real now), adds unequip
   (click an equipped item to unequip), and a pure `gearEffectsData.ts` formatter renders a
   preview line (e.g. "−25% pest risk · −8% humidity") — 5 unit tests.
6. **D7 sim report attached**: `docs/audits/2026-07-07-gv-o02-gear-effects-sim-report.md` — run
   against the real engine + real `balance.yaml`, proving both signs (humid pod +4.09 health
   target, dry pod −4.00) and the coco tradeoff (+6.8 water retained, −4.5 nutrient drained faster)
   with real numbers, not synthetic ones.
7. Full gates green: backend `make test` 1210 passed/6 skipped/90.57% coverage (was 1184/91.90%
   before this session's +26 new tests — coverage % dipped slightly because the new gear.py module
   and engine branches add lines faster than they add covered-lines share, but every new line is
   covered: `simulation/gear.py` is 100%), `make lint`/`make check-memory`/`make check-migrations`
   clean; web `typecheck`/`lint`/`build` clean, `npm run test` 516/516 (was 511 — +5 new
   `gearEffectsData` tests).

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

**Get the `gv-o03d-plant-scale-vitality` PR reviewed/merged, then re-read `DECISIONS.md` to
confirm D2/D3 are truly resolved before starting `claude/gv-o04-cure-mint-integrity`** (week 5 —
protected-surface, not a plain "start building" week). If the owner instead has more plant-render
feedback after seeing this pass, that supersedes gv-o04 (owner taste on the hero render takes
priority over the roadmap, per the delegation charter). The chamber-mockup reconciliation was
resolved 2026-07-06 (owner chose replace — shipped in PR #159); the 90-day plan supersedes the old
"(b) proceed to p02" path — p02 is week 9.

**Older owner-directed threads, still open, not gating anything (tracked in BACKLOG.md):**
1. **Onboarding rework (owner, 2026-07-03):** "it's too long, not exciting, doesn't really work —
   set up some sort of onboarding with AI helping along the way." The AI advisor (Master Grower)
   already exists on the dashboard, plant detail, FTUE (per-step coaching) and University — it's
   wired, just not prominent. Current onboarding = a 4-beat cinematic landing (`/onboarding`) + a
   7-step FTUE (`/ftue`). Overlaps GrowVerse Phase 18's onboarding-finish requirement.
2. **Plant render:** the round-8 freeze is LIFTED as of this session — owner named the gap
   (indica scale + idle vitality), `gv-o03d-plant-scale-vitality` fixed it, self-score ~9/10 (see
   "What shipped" above). Branch-level architecture is the likely next ask if the owner still sees
   a gap; no freeze is in force right now, but don't speculatively chase more polish without new
   owner direction — same "don't chase the macro bud" spirit, just not literally frozen anymore.
3. ~~**Cleanup:** close stale draft PRs #151, #152 (arcade polish — superseded, no unique content).~~
   Confirmed closed (not open) — no action needed.

Off-limits unless separately approved: economy values, treasury paths, settlement deposit/withdraw.

## Verification split

- **Agent-verified (test-backed, `gv-o03f-arcade-polish`, this session):** web typecheck/lint/build
  clean; full web vitest suite 528/528; 9 targeted Playwright specs green (care-loop-shot,
  chamber-landscape-hud-shot, growth-boost-shot, turbo-shot, slider-shot, bud3d-shot) + the full
  30-route crash-sweep; backend `make test` 1210 passed/6 skipped/91.74% coverage (untouched, no
  backend files touched), `make lint` + `make check-memory` clean. Fresh capture-shots goldens
  (VER-022/022b) confirm the chamber's GROW and CLIMATE tabs render with the TIME tab and its
  "· preview" badge fully gone.
- **Device-verify (owner):** open the Arcade chamber (`/dashboard/plants/<id>/chamber`) and confirm
  only GROW and CLIMATE tabs remain (no TIME), the ⚡ Boost Growth button still works, and nothing
  about the plant's growth day/stage display looks different from before other than the missing
  tab — this is purely a removal, so the bar is "nothing changed except the scrubber is gone."
- **Agent-verified (test-backed, `gv-o03d-plant-scale-vitality`, prior session):** web
  typecheck/lint/build clean; full web vitest suite 528/528 (incl. `morphology.test.ts`,
  `chamberCore.test.ts`); 36 relevant Playwright specs green (care-loop-shot,
  chamber-landscape-hud-shot, bud3d-shot, the full 30-route crash-sweep); backend `make test`
  1210 passed/6 skipped/91.73% coverage (untouched by this change, re-run for the record),
  `make lint` + `make check-memory` clean. Headless `chamberCore` renders confirm: Northern Lights
  (indica_ratio 1.0) and Hindu Kush (0.9) grow visibly taller/fuller at late-flower/harvest;
  Durban Poison (sativa baseline, 0.0) renders pixel-identical before/after (no regression to the
  strain this fix wasn't targeting); a two-frame pixel diff shows ~58% more mean movement in the
  idle-sway loop after the motion-amplitude change. See VER-018 through VER-021 in
  `VERIFIED_RENDERS.md`.
- **Device-verify (owner):** open a Northern Lights / Hindu Kush (or any high-indica-ratio) plant
  in the chamber at flowering/harvest and judge by eye whether it now reads as a substantial,
  short-and-bushy plant rather than a small/weak one — this is inherently an owner-taste call, the
  agent can only verify the numeric fix landed and didn't regress the sativa baseline. Also watch
  the idle sway for ~10-15s and judge whether the plant now reads as visibly alive without being
  distracting; toggle OS-level "reduce motion" and confirm the plant goes fully static (this is a
  device-only check — the agent verified the code gates on `motionOK` but can't observe an actual
  OS accessibility setting). Older carried device-checks (chamber-mockup reconciliation,
  ARCADE-tab-removal UX) are unchanged by this session.

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
