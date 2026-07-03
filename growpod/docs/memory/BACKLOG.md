# Backlog (Layer 3) — single source of priority

Status: `⬜ todo · 🔨 doing · ✅ done · ❄️ parked`. Standups may *propose* items; they're only real
once they appear here. Last reconciled: **2026-07-03** (plant mockup round 3: lower cola mass, interior fill, finer calyx grain, deeper green).

> **Reconciliation note (REC-004, 2026-06-14):** the Graphics Phase + Dashboard wiring are done and
> signed off; the studio is on the **New-Player / Launch-Readiness** track below. The full ledger of
> PRs / branches / directives + the launch critical path + department status live in
> `docs/memory/CANONICAL_STATE.md`.

## 🎮 Core Game Loop (TOP-PRIORITY ACTIVE track — owner freeze directive 2026-07-02, PR #111)
> Owner directive: **freeze advanced 3D bud/model work** and ship the playable core loop on the
> existing stylized 2D chamber engine — "I'm not worried about the 3-D right now." This track
> supersedes the 3D/Lab tracks below until the owner reopens them. Loop verified end-to-end by
> `web/e2e/care-loop-shot.spec.ts` (button states → plant reaction → harvest-ready CTA →
> post-harvest next-actions), 2026-07-03.
- 🎮 ✅ **Bud Viewer route parked, "Coming soon" (2026-07-02, PR #111)** — the dedicated Tier-2
  `/dashboard/plants/[plantId]/bud` screen (`BudGL` macro inspection) stays built and working
  (zero cost to leave, one-line re-enable later) but the Grow Chamber's floating "🔬 View Bud"
  CTA (`chamber/page.tsx`) is now a disabled "Coming soon" chip instead of a live link, per
  owner: "If the View Bud button exists, it can be disabled, hidden, or marked 'Coming soon'
  until the main game loop is stable."
- 🎮 ✅ **Care button functionality wired (2026-07-02, PR #111)** — `web/src/components/plant/CareButtons.tsx` now renders
  all 7 actions (Water, Feed, Treat Pests, Treat Disease, Prune, Train, Boost), not just
  Water/Feed. New `lib/careAvailability.ts` (pure, 12 unit tests) derives per-button
  available/disabled state + human reason from `plant.recent_events`: once-per-stage gating for
  Prune/Train (mirrors the backend's `_last_event_stage()`), pressure-gating for Treat
  Pests/Disease (`pest_level`/`disease_level` > 0), dead/harvested lockout with reason text.
  Boost intentionally always shows "available" from the UI (the real cooldown length lives in
  `balance.yaml`, not exposed to the client — fabricating a countdown would be dishonest; the
  existing toast-on-error stays the ground truth for the rare still-cooling-down case). Each
  button shows benefit text + last-used relative time (`formatSinceUsed`). Existing
  particle-burst press feedback (`CareFeedback`/`careFeedbackData.ts`) and mutations
  (`useCareActions`) were already built — this closed the actual gap (buttons not rendered +
  no proactive disabled-reason UI).
- 🎮 ✅ **Journal + Inspect + "what's next" wired into Care (2026-07-02, PR #111)** — `CareButtons`
  gained direct 🔍 Inspect / 📓 Journal links (Journal deep-links to `#journal` on the plant
  detail page, which now has `id="journal"` via `Card`'s new optional `id` prop). Chamber's GROW
  tab now shows the existing `PlantActionCTA`/`nextPlantAction` "what to do next" banner
  (previously only on the plant-detail page and PlantCard) so harvest-ready / critical-care state
  is never ambiguous inside the chamber itself.
- 🎮 ✅ **Per-action visual plant reactions (2026-07-03)** — owner-spec mapping shipped: Water →
  blue ring pulse at the root zone, Feed → green pulse rising the stem line, Prune → trim
  sparkles across the canopy, Train → branch-guide arcs, Inspect → scanner sweep (plays on
  arriving at the plant detail page via 🔍 Inspect); treatments/boost get subtle zone washes.
  Built as `web/src/components/plant/careReactionsData.ts` (pure spec map + CustomEvent
  dispatch, 5 unit tests) + `web/src/components/plant/PlantReactionLayer.tsx` (overlay mounted
  on the chamber stage and the detail render card; reduced-motion collapses to a static tint
  wash). Decoupled from the canvas via the same window-event pattern as `boostEngine` — no
  changes inside `chamberCore.ts` needed.
- 🎮 ✅ **Harvest next-actions (2026-07-03)** — the post-harvest celebration overlay now offers
  the owner's full set: 🌱 Grow another (dashboard), 📋 Harvest review (the plant detail page —
  vitals, stage timeline, metrics and the full journal serve as the final report; no new screen
  needed), 🏆 Enter the Cup (`/cup` link only — harvest handoff, no Cup logic touched), and
  📸 Save snapshot (downloads the chamber canvas as a PNG keepsake, client-only). Harvest-READY
  clarity was already covered by `PlantActionCTA` "Harvest now" + the ✂️ Harvest & Sell button.
  Verified by `web/e2e/care-loop-shot.spec.ts`.
- 🎮 ✅ **Menu clarity verified (2026-07-03, no change needed)** — `web/src/components/layout/navLinks.ts` already matches
  the owner's 5-menu spec exactly: Grow/Lab/Market/Cup are the `primary` mobile tabs and
  everything else (Store, University, Leaderboards, Guide, Profile, Economy) sits behind the
  "More" sheet. Desktop nav derives from the same list, so the surfaces can't drift.
- 🎮 ✅ **Chamber game-hub redesign (2026-07-03, owner mockup)** — built in-place on the existing
  chamber (no new page/route/room): `web/src/components/plant/ChamberDock.tsx` adds the six
  glassy embedded action tiles (Water/Feed/Prune/Train/Inspect/Boost — glow when available,
  dim+reason when not, flash on tap, per-action plant reaction) at the chamber base, plus the
  side-panel Today's Plan (ranked Do Now/Soon/Upcoming rows from the new pure
  `web/src/lib/todaysPlan.ts`, 5 tests, tappable Do-Now) and Plant Insights (top cola,
  trichome %, aroma, health, journal link). Boost reaction upgraded to a temporary aura ring.
  Treatments surface as Do-Now plan rows (bar keeps the mockup's six tiles). `CareButtons`
  stays as-is on the plant detail page. Verified mobile (390×844) + desktop via Playwright.
- 🎮 ✅ **Design punch list items 1–3 shipped (2026-07-03)** — (1) top stats compressed into one
  horizontal HUD strip across the stage top (strain chip + TO HARVEST/TEMP/HUM/CO₂ `HudChip`s,
  CLIMATE tab keeps the deep detail); (2) Boosts now an inline "BOOSTS · 1 active / Add Boost"
  section in the GROW sheet (`BoostsInline` in `web/src/components/plant/ChamberDock.tsx`, live
  multiplier + remaining-time bar from the existing boostEngine store; Add Boost expands the
  in-scene quick tray via `OPEN_BOOST_TRAY_EVENT`, tray's collapsed pill removed); (3) Plant
  Insights as a scannable 4-chip grid (Top cola / Health / Aroma / Trichomes with honest
  "Not scanned"/"Not yet" fallbacks). Verified mobile 390×844 + desktop, care-loop e2e green.
- 🎮 ✅ **Design punch list items 4–5 (honest subset) shipped (2026-07-03)** — (4) footer
  encouragement bar (`EncouragementFooter`: real health dial + state-honest copy); (5)
  plant-progress stat strip (`PlantProgressStrip`: server forecast only — stage day, stage %,
  days-to-harvest). Shipped: plant fullness/color pass (chamberCore: denser canopy,
  purple-pink bud accents, dominant top cola), mood chip (health/flag-derived pill on the
  stage), quick-boost chips (one-tap per-type row in `BoostsInline`) 2026-07-03.
- 🎮 ⬜ **Design punch list — remaining** — care-streak / resin-score stats (later: needs
  backend tracking; no server field exists, and we never invent numbers); (6) ambient
  in-scene care glyphs (floating ✂️/💧/❤️ accents).
- 🎮 ✅ **Plant mockup round 2 (2026-07-03, owner mockup image)** — "master one bud, then repeat
  it" pass on `chamberCore`: template bud now reads purple-TIPPED over green (tip-weighted
  accent pods + deeper mass-tip gradient, calmer per-pod jitter, sparser/shorter pistils,
  smaller frost sparks, pod-size cap so leader calyxes stop ballooning into marbles), then
  stamped across a denser canopy (flowering node pack 1.18→1.42 / cap 20, chunkier side +
  node colas starting lower, extra flowering branchlet, mid-branch fans, fuller flowering
  fan-leaf mass, wider reach 0.27) + maturity-gated woody brown lower trunk. Iterated 5
  headless-render rounds against the mockup; Blue Dream / G13 / White Rhino identities
  spot-checked (still distinct); veg + harvest stages sanity-checked. Honest gap vs mockup:
  the mockup is still denser (near-zero interior space) with chunky colas even lower on the
  plant — next lever is lower-canopy cola mass without drowning the skirt fans.
- 🎮 ✅ **Boost cooldowns lifted into the shared store (2026-07-03)** — per-type `cooldownUntil`
  moved from `ArcadeHUD`'s local `useRef` into `boostEngine`'s zustand store; `applyBoost` now
  enforces the lockout itself (returns applied/rejected so callers only fire sound/plant
  feedback on real applies; rejected taps start no cooldown; `clearBoost` can't dodge a
  lockout). `BoostsInline`'s quick-boost chips in `ChamberDock` now show honest
  disabled+countdown states from the same clock as the HUD tray. 13 unit tests in
  `web/src/lib/arcade/__tests__/boostEngine.test.ts`; chip lockout verified live via
  Playwright (tap → disabled + countdown; other types stay enabled).
- 🎮 ✅ **Plant mockup round 3 (2026-07-03, owner mockup image)** — targeted the round-2
  verdict's four named gaps in `chamberCore` (template refined, then re-stamped): (1)
  lower-third cola mass — side-cola floor 0.55→0.95 with a relaxed ramp, tip-site gate
  ×0.65 so the lowest branch tips carry real colas, plumper branchlet/node buds, low-cola
  cluster floor up; (2) interior fill — node buds start lower (0.24) and bigger, an inner
  fan per branch base + a cross-stem fan per tier, skirt fans a notch bigger; (3) finer
  calyx grain — more pods/cluster in a 4th ring, pod cap 5.2→4.2, taller pointier pods,
  juicier saturated pod gradient; (4) deeper green — leafTone +7 sat / −3 lit, fused-mass
  lit 37→33, pod base lit 38→35, deeper saturated shadow stops; plus tip-concentrated
  purple (exp 2.1) so accents read as a continuous cap, not dots. Iterated 5
  headless-render rounds vs the mockup; Blue Dream / G13 / White Rhino identities
  spot-checked (distinct); veg + harvest sane. Honest remaining gap: the mockup's colas
  are still chunkier/rounder with painterly airbrushed shading (ours are flatter vector
  gradients), its very bottom tier keeps bud mass where ours is mostly fan skirt, and its
  interior is still a touch denser.
- 🎮 ⬜ **Bud/flower polish notes (owner, future polish — NOT blockers)** — remaining after the
  round-3 pass above: tighter bract clusters; better embedded sugar leaves; subtle trichome
  sparkle at phone size (current frost is deliberately faint); painterly per-cola shading
  toward the mockup's airbrushed depth. 2D chamber-engine tuning lane (chamberCore),
  distinct from the ❄️ frozen 3D lane below.
- 🎮 ❄️ **Parked for later (owner-named, do not resume without explicit direction)**: photoreal
  bud viewer, full 3D cola inspection, trichome particle macro mode, scientific Lab breakdown,
  university 3D model, advanced morphology layer toggles. See the ❄️ items under "HERMES
  University + hardening" below for the specific backlog rows this covers.
- 🎮 **Do-not-touch (owner-named, unrelated to this track, restated for visibility):** wallet/funds
  path, staking, claim logic, Algorand production token flows, market purchases (unless required
  for button state), Cup logic (unless required for harvest handoff).

## 🏛️ HERMES University + hardening (ACTIVE track — owner directive 2026-07-02)
> The university keeps its systems (no overhaul) but becomes **HERMES University for cannabis** — an
> online school with produced-once lessons. Plus the security-review follow-ups (PR #104) and the
> grow-room procedural-visual track (photoreal-in-pod reverted; see DECISIONS.md 2026-07-02).
- 🏛️ ✅ **Difficulty selector removed** (2026-07-02) — the Beginner/Intermediate/Advanced picker at the
  bottom of the course page is gone; every student attends one canonical delivery per course
  (`web/src/app/university/courses/[key]/page.tsx`). Backend `level` param stays tolerant (defaults).
- 🏛️ ✅ **Online-school catalog restyle** (2026-07-02) — HERMES branding on all university eyebrows,
  degree-progress strip, department "School of …" sections, credits on course cards
  (`web/src/app/university/page.tsx`). No data-model changes.
- 🏛️ 🔨 **University wiring audit** — end-to-end trace (curriculum → skills → learner model → agents →
  exams → web). Owner suspects mis-wiring; findings + fixes land in the HERMES memory doc.
- 🏛️ 🔨 **Produce-once lesson audio (ElevenLabs)** — lectures must be produced once and saved, never
  re-billed per delivery. Today `/lecture` can mint a fresh AI lecture *and* fresh TTS per attend
  (content-hash keyed); the produced-once path exists only on `/university/courses/<key>/audio`.
  Unify on produce-once; `ELEVENLABS_API_KEY` stays host-secret-only (never in chat/repo).
- 🏛️ ⬜ **HERMES memory layer** — `docs/memory/design/HERMES_UNIVERSITY.md`: identity, layer map,
  wiring truths, lesson-production pipeline, open work (this session starts it).
- 🔴 ⬜ **Security follow-ups from PR #104** (before public launch): settlement **deposit** redesign
  (player-signed + indexer-verified inbound transfer) + **withdraw idempotency key** (treasury; owner
  gate); web CSP nonce (drop `'unsafe-inline'`) + move the player key off `localStorage`; TS api-server
  CORS allowlist; client-supplied `blockHash` / time-seeded `storyEngine` RNG hardening; add the
  missing `snapshot.yml` backup workflow (or correct SECURITY.md); enforce CODEOWNERS on protected
  surfaces; replace post-merge `drizzle-kit push` with generated migrations; delete the stale nested
  `growpod/artifacts/api-server` copy; dev-bypass explicit opt-in for previews.
- 🏛️ ⬜ **Global Learning Memory + personalization (design/11, owner directive 2026-07-02)** —
  P1 `knowledge_events` capture (append-only, anonymized-on-read, single-writer) at the 4
  generative call sites; P2 admissions persistence + `personal_context` into lecture/Master
  Grower; P3 `search_global_knowledge` retrieval tool (the teacher gets smarter from every
  player); P4 `global_insights` rollups + class-stats surface. Spec:
  `docs/memory/design/11-global-learning-memory.md`.
- 🎨 ❄️ **Per-strain procedural fidelity pass — PARKED (owner freeze directive 2026-07-02)** —
  `GrowChamber`/`BudGL` morphology + bud shape/color coverage across all 29 strains (the
  follow-up track from the 2026-07-02 revert ADR). Pilot strain Blue Dream is 4 rounds deep
  against the owner's harvest reference photo (identity → renderer realism → cola-silhouette
  smoothing → apex separation/mid-canopy fill, PRs #108-#110 + the handoff-audit session's
  round 4). Owner: "freeze advanced 3D bud/model work for now... do not keep trying to make the
  macro bud perfect." Do not resume without explicit owner direction; the core game loop is the
  priority track now (see "Core Game Loop" section below).
- 🎨 ✅ **Renderer tier architecture locked in (2026-07-02, PR #111)** — 4 tiers: Tier 1 gameplay
  = `GrowChamber` (2D canvas, canonical, mobile-first — unchanged engine); Tier 2 Lab/University
  = new `PlantGL` whole-plant Three.js model, wired into a "3D Model" tab on
  `lab/strains/[strainId]/page.tsx`; Tier 3 View Bud = `BudGL` macro close-up (unchanged); Tier 4
  dev-only = `/dev/plant-review`'s chamber/plant3d/macro toggle. The "Plant 3D" tab was **removed**
  from the live gameplay chamber page (`dashboard/plants/[plantId]/chamber/page.tsx`) — it must
  never resurface there; Tier 2/3 detail belongs in Lab/View Bud only, never forced into Tier 1.
- 🎨 ✅ **`PlantGL` whole-plant 3D construction model built (2026-07-02, PR #111)** — new
  `lib/chamber/plant3d/{skeleton,fanLeaf}.ts` + `components/viz/PlantGL.tsx`: stem → phyllotaxic
  nodes/branches → bud sites → phytomer-node-clustered bracts/calyxes (botanically grounded,
  Spitzer-Rimon et al. 2019) → sugar leaves from flower nodes → pistils → trichome frost → fan
  leaves (true palmate hand, shared origin, wide angle spread) → axillary sub-shoot compound
  raceme. Layer-inspection dev tooling (per-layer toggles, density sliders, skeleton/node debug
  overlays) shipped in `/dev/plant-review`. 16 new unit tests; shares `bud3d/cola.ts` +
  `bud3d/detail.ts` builders with `BudGL` so macro and Lab views can't drift apart.
- 🎨 ✅ **Chamber mobile-readability pass (2026-07-02, PR #111)** — the live Tier-1 gameplay
  renderer read as "moss on sticks" at real phone size (fine per-gland trichome detail + many
  tiny calyx pods + thin branches, verified via real-phone-viewport screenshots of the actual
  mocked gameplay route, not just the desktop dev panel). Fixed in `chamberCore.ts`
  `buildFlowerSite`/`drawFlowerSite` only (View Bud/Lab detail untouched): ~60% fewer, ~35%
  bigger calyx pods; ~65% fewer but bolder pistil strokes; per-gland trichome loop replaced with
  1-2 clustered soft frost-glow blobs per cluster; thicker stem/branch/branchlet strokes; a
  modest vegetative-stage node/leaf density boost (mirrors the existing flowering boost) so veg
  plants read leafy/branchy instead of leggy.
- 🎨 ❄️ **3D construction-model follow-ups — PARKED (owner freeze directive 2026-07-02, deferred
  from PR #111, owner science-based-architecture spec)** — (a) formalize the explicit `PlantNode`
  field-named data model (index/angle/radius/stage/branchPotential/… ) the spec calls for —
  currently implicit in `skeleton.ts`; (b) finer growth-stage architecture for `PlantGL`
  (cotyledon seedling, pre-flower, senescence/yellowing — today it's just veg → flower →
  harvest); (c) true stalk-and-gland trichome geometry for close-up Lab/View-Bud distance (today
  both use frost spheres) + LOD (near/mid/far detail tiers); (d) roll the 3D model out
  per-strain the same way the 2D pilot above will — only Blue Dream/verified strains have been
  visually checked in 3D. All parked alongside the photoreal bud viewer / full 3D cola
  inspection / trichome particle macro mode / scientific Lab breakdown / university model /
  advanced morphology layer toggles — see "Core Game Loop" section below.
- 🎨 ⬜ **Chamber mobile-readability follow-ups (deferred from PR #111)** — (a) "shorten
  exaggerated curved wire branches" was only partially addressed (stroke width bumped; branch
  *curve amplitude* — `nd.curve`, `0.14–0.36` — was left untouched as lower-risk); revisit if
  branches still read as too arced at phone size; (b) the mobile-viewport verification only
  covered Blue Dream — spot-check a spiral/sativa-pattern strain (e.g. G13) and a bushy strain
  (e.g. Purple Diddy Punch/White Rhino) since `buildFlowerSite`'s `pattern`/`fatMul` branches
  weren't individually re-verified at phone size.

### 🕵️ Dormant investments (2026-07-02 sweep — built but unused; owner picks wire-in vs retire)
> Full evidence (file:line per item) in the sweep report attached to PR #104. "Staged, not dead"
> items (HeyGen presenter, `/mission`, Clone Room TS stack, boost-economy docs, WO-1/WO-2) are
> deliberately parked and NOT listed here.
- 🔴 ⬜ **5 of 12 feature flags gate nothing** — `ftue_tutorial`, `grow_chamber`,
  `master_grower_advisor`, `breeding_lab`, `daily_stipend` (`data/balance.yaml` `feature_flags:`)
  have zero `require_feature` call sites: flipping them off does nothing. False kill switches are
  worse than none — decorate the FTUE/breeding/advisor/stipend routes. **Protected surface (flags):
  needs owner OK.**
- 🔴 ⬜ **Web gating never reads `GET /api/game/flags`** — `web/src/lib/features.ts` is env-var-driven
  default-ON; the planned re-point (DECISIONS 2026-06-14 "Web Gating PR") never landed, so backend
  kill switches don't reach the web UI. Land the re-point.
- 🟠 ⬜ **Wire in: finished backends one UI hop from paying off** — `POST .../plants/<id>/apply`
  (consumables; store sells them but has no "use item"), `GET /strains/<id>/effects` (effects panel),
  admissions department/track recommendation (persist + surface; HERMES open-work #2),
  `Player.last_active_at` (exactly what WO-2 "welcome-back delta" needs), `/contracts` page
  (whole built surface with no nav entry — one `navLinks.ts` line).
- 🟠 ⬜ **Retire: superseded/dead web code** — `components/intro/` (4 files; superseded by FTUE),
  `components/pod/PodCard.tsx` + `EnvironmentForm`/`WeatherRoller` (superseded by Command Center),
  `command/CommandTopBar.tsx`/`CommandFooter.tsx` (+ stranded `hooks/useLiveClock.ts`, cosmetics
  exports), `lib/timeControls.ts`, backend `serve_narration` route (superseded by produce-once
  audio). Owner-taste call: `onboarding/VideoHero.tsx` + `public/media/*` (revive on landing or
  retire).
- 🟡 ⬜ **Retire: stale infra** — `growpod/artifacts/*` nested duplicates (confirmed stale vs root),
  `scripts/build-production.sh` + `start-production.sh` (describe a deploy that doesn't exist),
  `scripts/src/hello.ts` scaffolds, `attached_assets/` dumps, empty `growpod/lib/db` schema stub.
- 🟡 ⬜ **Dead DB columns** — `ResearchProgress.unlocked_at`, `GrowthMeasurement.leaf_count`/
  `growth_rate` (drop migration when convenient); `Player.last_active_at` is the wire-in above.
  `INDEXER_URL` is read but unconsumed — it's needed by the settlement-deposit redesign; keep.
- 🟡 ⬜ **Docs hygiene tail (2026-07-02 MD sweep)** — remaining from `docs/memory/DOCS_INDEX.md`:
  resume or tombstone `BUILDLOG.md`; restamp the frozen "Live" ledgers (`CANONICAL_STATE.md`,
  `STUDIO_AGENT_REGISTRY.md`, `AGENT_ORCHESTRATION_LEDGER.md`) as dated snapshots or refresh;
  retire `docs/DEV_BUILD_LOG.md` (Replit-era); archive-or-refresh the `docs/00–09` numbered
  snapshots; merge the two DATABASE_SYSTEMS_AUDIT copies; consider a HANDOFF staleness gate in
  `check_memory.py` like the backlog's.
- 🟡 ⬜ **Simplify: unreachable AI-factory branches** — master-grower/admissions/roadmap "real
  provider" arms always return the mock (classes don't exist); build the Claude providers or
  simplify the guards. (HeyGen arm stays — owner-gated spend.)

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
- 🚀 🔨 **Playtesting → Retention Validation → MVP Launch Candidate** — the launch critical-path tail.
  Testing-prep (2026-06-18): `make testenv` stands up the full stack behind a cloudflared tunnel with
  a dev/test-only **skip-login** shortcut (`NEXT_PUBLIC_ENABLE_DEV_BYPASS`, default OFF) + dev clock,
  plus `docs/TESTER_RUNBOOK.md` + a bug-report template. Economy is in deliberate **free testing mode**
  (free seeds, boosted stipend); launch values are guarded by `tests/fixtures/launch_balance.yaml` +
  the `test_launch_balance_values` tripwire — **restore them in `balance.yaml` before launch.**
- 🚀 ❄️ **OMNI Charter v1.0** (PR #38, merged 2026-06-14) — organizational constitution
  (`docs/OMNI_CHARTER.md`): chain of command, departments, work-order system, canonical principles.
  Governance layer; no further backlog action.

- 🚀 ⬜ **Optional boost economy + UI feature package (planning, docs only)** — product/economy/UI
  planning for 10 UI lanes, an optional **free-in-alpha** paid boost/recovery concept, a
  liquidity-first transparency model, fairness guardrails, boost UI copy, and a build roadmap. Docs
  in `docs/product/` (`GROWVERSE_UI_FEATURE_BUILDS.md`, `GROWVERSE_OPTIONAL_BOOST_ECONOMY.md`,
  `GROWVERSE_LIQUIDITY_TRANSPARENCY_MODEL.md`, `GROWVERSE_FAIRNESS_GUARDRAILS.md`,
  `GROWVERSE_BOOST_UI_COPY.md`, `GROWVERSE_BUILD_PRIORITY_ROADMAP.md`); ADR in `DECISIONS.md`
  (2026-06-19). **No code / no economy change** — boosts are `planned`, free + QA-labeled in alpha;
  five owner decisions gate any real activation. Build only after the named owner decisions.
- 🚀 ⬜ **AI-assistance feature package (planning, docs only)** — 10 lanes for an AI bot the player
  can **ask for assistance** that **evaluates real grow state** and **gives correct, grounded
  assistance**, priced as an optional boost but **free + QA-labeled in alpha**. Grounded on the
  existing `live` advisor (`GET /players/<id>/plants/<id>/advisor`, `api/game_api.py:621` →
  `services/advisor_service.py` → swappable `ai/` providers) + `ai/autocare.py`. Doc:
  `docs/product/GROWVERSE_AI_ASSISTANCE_FEATURE_BUILDS.md`. **No code / no economy change** — every
  lane `planned`, assists post $0 ledger entries in alpha; moving off free is an owner stop-and-ask.
  Five owner design questions gate activation. Extends the boost-economy package above.

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
- 🔴 ✅ **Restore the web safety net** (RISK #8, 2026-06-18) — `web/package.json` test scripts
  un-stubbed (`vitest run` / `playwright test`), `vitest` + `@playwright/test` added to devDeps, and
  `.github/workflows/ci.yml` web job now runs vitest **and** a Playwright e2e step (`npm install`
  since the lockfile can't be regenerated offline — switch back to `npm ci` once it's regenerated
  with network). Re-exported `computeFeatures` (was commented out in testing mode) so the existing
  features unit test passes. HTTP-boundary withdraw/deposit/mint (PR #47) + global 401/403 handler
  (PR #29/#30) were already done. *Validation pending the first CI run (no web npm network locally).*
- 🔴 ✅ **Make the integrity/CI gates REAL** (2026-06-10) — a chat found that
  `scripts/check_memory.py`, `scripts/check_single_head.py`, the SessionStart hook, **and
  the CI workflow did not exist on disk** (it was later built, and on 2026-06-18 relocated to the
  repository root so GitHub actually runs it), despite being claimed ✅ below and in
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
