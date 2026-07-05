# Backlog (Layer 3) — single source of priority

Status: `⬜ todo · 🔨 doing · ✅ done · ❄️ parked`. Standups may *propose* items; they're only real
once they appear here. Last reconciled: **2026-07-05** (chamber round 10 — pod shape variety,
size/lightness rebalance, branch/leaf color separation (PR #142); security audit + fixes closing
withdraw double-payout and mint double-mint races via commit-before-external-call + optimistic
locking on Harvest/Strain (PR #144); simulated-player playtest found and fixed the harvest
force-sell bug that made cure/mint/Enter-Cup unreachable from the UI, plus a dead onboarding
token-claim tutorial wire (PR #145); a follow-up store/seed/market purchase-flow playtest found
and fixed a dead Consumables/Research shop (unauthenticated GET), stale header balance after
purchase, a client-stricter-than-server auction bid-minimum, an unguarded auction Settle button,
and a latent float/Decimal bundle-pricing bug for strain components (PR #146); a University
playtest (see new 🏛️ items below) found the dev-clock doesn't reach University study-time, course
completion isn't celebrated (only a full degree grants a title), bio-101 is a non-credentialing
dead-end elective, and University is invisible to onboarding/mobile-nav; pod-recycle fix + landing-particle perf/scale fix — GameService.cleanup_plant now ARCHIVES (not deletes) a harvested/dead plant so Harvest/CupEntry rows survive, and the missing UI got wired into all 3 screens (dashboard, plant detail, chamber); Constellation.tsx particle glow now scales with viewport + blits a cached sprite instead of a per-frame gradient, fixing both the mobile "huge blob" look and the slow frame rate; Lab microscope rework phase 1 — purple-hue fix via authored strainVisuals BudColor (calyxTint), live-plant deep-link ?plantId= seeded from server trichome telemetry (maturityFromTelemetry), chamber 🔬 Inspect-trichomes chip replacing the dead View-Bud placeholder, terpene-label collision skip + µm scale bar; visual-verification archive — `docs/memory/VERIFIED_RENDERS.md` chapter list + `verification/golden/` + shared e2e fixtures (`web/e2e/fixtures/mockGame.ts`) + parameterized `capture.spec.ts` + sandbox-Chromium auto-detect in `playwright.config.ts` + `capture-shots` skill, ending the per-session throwaway-rig ritual; plant round 8c — leaf + bract TEXTURE LAYERING (owner: "the layering in the texture"): `drawFan` leaflets now carry deterministic per-leaflet size/angle/tone jitter plus a light↔shadow facet gradient (was one flat hsl() fill repeated identically at every node — the "stamped decal" read); `drawPod` now gives every calyx bract a volumetric gradient (the old `w>4.2` gate meant almost none ever cleared it, since podW's own ceiling is 4.2) plus a new base "undercut" shadow so overlapping bracts read as a physically shingled stack instead of blending into the mass gradient; plant round 8b — airier, more-separated candelabra branch layout in chamberCore.ts's `buildPlant`, matching the owner's "10/10" hero render (fewer/more-separated tiers, colas held further OUT, opened interior), superseding the round-2..7 density push on the spacing axis; top cola construction — deterministic ring-parity stacking-alternation colour ("every other one purple"), ported from `buildMacro`'s golden-angle ring-pack; plant round 8 combined "10/10 hero render" push — four parallel specialists combined-verified against the reference: pistil hairs (curl, length tiers, tip-density, pale→orange mix), trichome frost (dense crystalline sugar-coat), green sugar-leaf sepals (tuned to peek not stab — purple dominant), chamber glow Phase 2 (in-canvas green rim/back glow + green pot-base ring); dedupe floating boost tray; chamber ambient glow Phase 1 (DOM-only); game-hub restructure; plant mockup round 6 purple-dominant color; top cola construction v2 structure-first; mint metadata server-truth fix).

> **Reconciliation note (REC-004, 2026-06-14):** the Graphics Phase + Dashboard wiring are done and
> signed off; the studio is on the **New-Player / Launch-Readiness** track below. The full ledger of
> PRs / branches / directives + the launch critical path + department status live in
> `docs/memory/CANONICAL_STATE.md`.

---
## ⚡ Priority Snapshot — open items only (2026-07-03)
> Compact directory of every ⬜ todo and 🔨 doing item. Jump to the `##` section heading to read the full entry.
> ✅ done and ❄️ parked items are in their track sections below and are NOT listed here.

### 🔴 Now — correctness / risk / security (must close before public launch)
1. 🔨 **Concurrency hardening** — remaining: `Idempotency-Key` header + one-shot-grant uniqueness → `## 🔴 Immediate`
2. ⬜ **Chain settlement verification (RISK #7)** — deposit txid verify, replay protection, reconciliation job → `## 🔴 Immediate`
3. ⬜ **Security follow-ups PR #104** — deposit redesign, CSP nonce, CORS allowlist, player key off localStorage → `## 🏛️ HERMES`
4. ⬜ **5 of 12 feature flags gate nothing** — `ftue_tutorial`/`grow_chamber`/`master_grower_advisor`/`breeding_lab`/`daily_stipend` off does nothing (owner OK needed) → `### 🕵️ Dormant investments`
5. ⬜ **Web gating never reads `GET /api/game/flags`** — `features.ts` is env-var default-ON; land the re-point → `### 🕵️ Dormant investments`
6. ⬜ **Reconcile `docs/ROADMAP.md`** — Sprints 1–3 still show ⬜/🔨 → `## 🔴 Immediate`
7. ⬜ **Retire `docs/NEXT_SESSION_SPRINT3.md`** — Sprint 3 is done; doc is stale → `## 🔴 Immediate`
8. ⬜ **Fix `BUILDLOG.md` header** — still references old trunk branch → `## 🔴 Immediate`

### 🎮 Core Game Loop — active (owner-freeze directive 2026-07-02, PR #111)
9. 🔨 **Onboarding AI-guide rework** — remaining: landing-page scroll + 3-panel FTUE coach wiring → `## 🎮`
10. ⬜ **Design punch list remaining** — care-streak / resin-score stats polish → `## 🎮`
11. ⬜ **Bud/flower polish** (NOT launch-blocking) — bract clusters, sugar leaves, trichome sparkle at phone size → `## 🎮`
12. ⬜ **Chamber mobile follow-ups** — branch curve amplitude untouched; sativa + bushy spot-check → `## 🎮`

### 🏛️ HERMES University — active (owner directive 2026-07-02)
13. 🔨 **Produce-once lesson audio** — unify `/lecture` endpoint on produce-once path → `## 🏛️ HERMES`
14. ⬜ **Assessment banks — 14 remaining courses** — `cult/gen/nut/ipm/chem/ph` YAML files in `data/assessments/` (only `bio-101.yaml` exists; see `docs/memory/design/HERMES_UNIVERSITY.md` §Open work #1)
15. ⬜ **Persist + surface admissions recommendation** — store dept/track on profile, surface on `/university/learner` (see HERMES open work #2 + `### 🕵️ Dormant investments` wire-in item)
16. ⬜ **MasteryPanel metadata** — serve skill name/domain from catalog; mastered skills render as raw ids today (HERMES open work #4)
17. ⬜ **Retire `serve_narration`** — `/narration/<key>/<level>?h=` superseded; confirm no external links, then remove → `## 🟠 Medium` retire item
18. ⬜ **Global Learning Memory (design/11)** — P1 `knowledge_events` at 4 generative call sites; P2 admissions + personal context into lecture/MasterGrower → `## 🏛️ HERMES`

### 🚀 Launch Readiness — active
19. 🔨 **Playtesting → Retention → MVP Launch** — the critical-path tail; economy in free-testing mode (**restore `balance.yaml` launch values before launch**) → `## 🚀`
20. ⬜ **Wire in finished backends** — consumables use-item UI, `GET /strains/<id>/effects` panel, `Player.last_active_at` → `### 🕵️ Dormant investments`
21. ⬜ **Retire dead web code** — remaining: `serve_narration` + owner-taste call on `VideoHero.tsx`/`public/media/*` → `## 🟠 Medium`
22. ⬜ **WO-1 / WO-2 (Grow Guide salvage)** — per-action care-ack signals + welcome-back delta endpoint → `## 🚀`
23. ⬜ **Boost economy + AI-assistance packages** — planning docs only; 5 owner gates each before any activation → `## 🚀`

### 🟠 Medium — next 1–2 weeks
24. ⬜ **Sprint 4: real TestNet + IPFS** — fund treasury, `reset_asa`, wire `ASA_ID`, reconciliation job → `## 🟠 Medium`
25. ⬜ **Idempotency keys on mutations** — general `Idempotency-Key` header (dup → original, not 409) → `## 🟠 Medium`
26. ⬜ **Anti-bot / fair-play framework** — spec logged; build on owner green-light → `## 🟠 Medium`
27. ⬜ **Load/soak test `/state` catch-up** — find cost knee before players do → `## 🟠 Medium`
28. ⬜ **Web e2e smoke (Playwright)** — over the full loop; today web CI is lint/typecheck/build only → `## 🟠 Medium`
29. ⬜ **HANDOFF staleness gate** in `check_memory.py` — low urgency while HANDOFF is actively maintained → `## 🟠 Medium`

### 🟡 Low / later
30. 🔨 **Trust layer** — remaining: generalize replay, genome fingerprint, public faucet/sink view, no-dark-patterns → `## 🟡 Low`
31. ⬜ **Constellation leaf-mesh follow-ups** — batch edges, color from accent prop, debounce resize → `## 🟡 Low`
32. ⬜ **KB enrichment pass** — `terpene_cluster` per strain, assayed THC distribution, PPFD/DLI→yield → `## 🟡 Low`
33. ⬜ **Education-gated Master Grower knowledge** — tie advisor depth + breeding consumables to degree progress → `## 🟡 Low`
34. ⬜ **Macro Bud Polish II** (NOT launch-blocking) — calyx ridges, denser clusters, ombré buds → `## 🎮` (parked item)
35. ⬜ **Generative genetics** — polygenic genome + mutation/epistasis/G×E + on-chain GenBank → `## 🟡 Low`
36. ⬜ **Grower-skill mastery** — use-based skill trees (effort/time → capability) → `## 🟡 Low`
37. ⬜ **Sprint 6 LiveOps** — seasonal rotations, timed events, breeding competitions, admin console → `## 🟡 Low`
38. ⬜ **Non-custodial Pera/WalletConnect** path for player-owned NFTs → `## 🟡 Low`
39. ⬜ **Observability** upgrade + secrets management hardening + age-gating/compliance → `## 🟡 Low`
40. ⬜ **Fiat payment rail** — parked by owner; RISK #7 + 5 owner decisions required before any activation → `## 🟡 Low`
41. ⬜ **Sponsored / branded content** — real brands sponsoring cultivars; business/LiveOps track → `## 🟡 Low`

---
## 🎮 Core Game Loop (TOP-PRIORITY ACTIVE track — owner freeze directive 2026-07-02, PR #111)
> Owner directive: **freeze advanced 3D bud/model work** and ship the playable core loop on the
> existing stylized 2D chamber engine — "I'm not worried about the 3-D right now." This track
> supersedes the 3D/Lab tracks below until the owner reopens them. Loop verified end-to-end by
> `web/e2e/care-loop-shot.spec.ts` (button states → plant reaction → harvest-ready CTA →
> post-harvest next-actions), 2026-07-03.
- 🎮 ✅ **Route-wide white-screen crash hunt + permanent regression net (2026-07-03 PM)** — a
  client-side-exception sweep across ALL 30 routes × plant states found the same bug class
  repeatedly: pages guarded only `!data` (presence), so a truthy-but-malformed API response (an
  empty array, a list where an object was expected, a partial body) slipped through and
  white-screened on the first field access — surfacing as a full-page "Application error" and, in
  CI, as an opaque Playwright timeout. Four fatal crashes found + fixed with shape guards:
  `/university` (`t.courses.filter`), `/lab/strains/[id]` (`s.lineage_type` on a list-shaped
  response — fixture also gained an explicit `/strains/str1` route shadowed by `/strains`),
  `/university/learner` (RoadmapPanel `plan.skipped_mastered.length`), `/admin/economy`
  (`setEntries(data.strains)` → `entries.length`; sibling loaders + ledger-summary hardened too).
  Locked in with a permanent opt-in regression spec `web/e2e/route-crash-sweep.spec.ts` (loads
  every route under the shared fixture, fails on any pageerror or the Next error boundary) — 29
  routes green. This is the root-cause fix for the recurring "unexpected API shape crashes the
  page" class (seen 6× this session incl. the events/seasonal fixture misroutes).
- 🎮 ✅ **/university white-screen crash guarded (2026-07-03 PM)** — a client-side-exception
  sweep across routes × plant states (default/harvested/dead/veg) found `/university` throwing
  `Cannot read properties of undefined (reading 'filter')` → full-page "Application error". The
  guard only checked `!transcript.data`, so a truthy-but-malformed response slipped through and
  crashed on `t.courses.filter(...)`. Now validates the shape (`Array.isArray(courses)`) →
  retryable `ErrorState`; shared e2e fixture gained a minimal transcript (keyed on the exact
  `/players/p1/university` path, not a bare `/university` that'd shadow siblings). Happy path
  unchanged (smoke green). `web/src/app/university/page.tsx`.
- 🟠 ✅ **Global React #418 hydration mismatch fixed (2026-07-03 PM)** — the exception sweep
  showed a "Minified React error #418" (server/client text mismatch) firing on EVERY route
  (React recovers by re-rendering client-side, so non-fatal but real). Root cause: the app-shell
  `Footer` formats its build timestamp with `Date#toLocaleString("en-US", {timeZone: …})` at
  module eval on BOTH server and client, and Node's ICU vs the browser's differ on the
  narrow-no-break-space before AM/PM — same value, different whitespace. Fixed with
  `suppressHydrationWarning` on that one span (`web/src/components/layout/Footer.tsx`); the fix
  was VERIFIED empirically (re-ran the sweep: react418 count 1→0 on /dashboard, /store, /cup),
  not just assumed. Full gate green.
- 🎮 ✅ **Plant render rework — owner "pod plant" blueprints (2026-07-03, 10 passes shipped)** —
  the owner sent 3 detailed blueprints (bud-integration + mesh, branch-overlay structure map,
  visual-refinement plan) effectively lifting the render freeze with a precise spec. Ten structural
  passes landed in `chamberCore.ts` (all draw-path only → pinned determinism intact): (1) **node
  attachment** — `drawBudCollar` sockets every cola onto a visible tapered stem neck + leaf collar;
  (2) **front depth** — front-facing nodes draw a lit support branch IN FRONT of their bud; (3)
  **stronger tapered central stem** + front rim; (4) **separation halo** behind each cola (buds pop
  off foliage); (5) **branch rim-light** so branches read as visible rounded support; (6) **leaf
  recede** in flowering (depth shade, increased darkness at node fans); (7) **hero bloom** pass; (8)
  **triangular silhouette** — cone clamp taper changed from convex `(1-f)^0.75` to linear `(1-f)`,
  apex narrowed 0.14→0.10, base widened 0.62→0.70; (9) **17-21 cola anchor spacing** — leader-cola
  nClusters multiplier 1.5→1.85 for hybrid/nodal (Gelato nC=19); (10) **leaf-fan demotion** —
  budDev suppression raised 0.25→0.40 on leafSize / 0.22→0.35 on nodeLeafSize so fans recede
  behind buds in full flower. TypeScript clean (tsc --noEmit 0 errors), vitest green. Owner to
  verify pass 8-10 visually and steer next visual round.
- 🎮 🔨 **Onboarding AI-guide rework (2026-07-03 PM, owner: "too long, not exciting, doesn't work;
  AI helping along the way")** — pass 1 on `/ftue` (backend step machine untouched): the Master
  Grower is now an on-screen 🤖 character (avatar + speech bubble), an instant per-step hype line
  (`STEP_HYPE`) shows before the AI coaching loads so a step never looks empty/broken, a delight
  burst fires on each tap, and the current step glows on the rail. Answers "where's the AI" (it was
  already wired on dashboard/plant/FTUE/University; this makes it the visible guide). ⬜ Remaining:
  the `/onboarding` cinematic LANDING scroll length ("too long") — a separate taste pass.
- 🎮 ✅ **Consumables "use item" wired (2026-07-03 PM)** — the store sold consumables you couldn't
  use; a living plant's Care area now shows an "Items" panel that applies owned consumables
  (`POST .../apply`, no ledger/currency — inventory→plant-state, safe). `api.store.consumables` +
  `api.plants.applyConsumable`, `useConsumables`/`useApplyConsumable`, pure `ownedConsumableOptions`
  (5 tests) mirroring the server's living-plant + stage_req guards, `ConsumablesPanel`, e2e proof.
  Closes the wire-in flagged in "finished backends one UI hop from paying off."
- 🎮 ✅ **Store panelized + seasonal "undefined" drop fixed (2026-07-03 PM, owner: "redo the
  store... some sort of panel or tile type of look")** — all 7 store shelves now sit in a
  consistent elevated panel (`STORE_PANEL`, `store/page.tsx`) so the page reads as distinct
  tiles instead of loose headers on the bare bg; presentation-only, no purchase/data logic
  touched, section spacing tightened. Also fixed a real render defect: "This Week's Drops"
  showed "undefined — Seasonal genetics" because (a) the store didn't guard a missing
  `strain_name` (now falls back to "Seasonal strain") and (b) the mock fixture's
  `/seasonal/strains` route substring-matched the `/strains` catalog (objects carry `name`,
  not `strain_name`) — added an explicit fixture route. Verified 390px + 1440px; full gate green.
  Honest note: a full visual-identity rewrite of the store (bespoke layout, hero art) remains a
  larger owner-taste call — this is the safe paneling pass, not that.
- 🎮 ✅ **Mobile chamber HUD chip no longer clips off-screen (2026-07-03 PM, owner: "text and
  stuff off of the screen" on mobile)** — the chamber top stat strip used a `flex-1` spacer to
  push the 4 chips right, but the strip is `pointer-events-none` so its `overflow-x-auto` could
  never be scrolled; on a 390px phone the last chip (CO₂) sat ~26px past the right edge,
  unreachable. Now wraps on mobile (spacer hidden), desktop keeps the single-line
  strain-left/stats-right layout via `sm:` variants (`chamber/page.tsx`). Found + verified with a
  horizontal-overflow audit across all key mobile routes (chamber offenders 3→0); the only other
  root overflow is /profile's ledger table inside its intended `overflow-x-auto`, and an 8px
  phantom on the plant-detail page with no element actually off-screen (nothing lost — left
  alone). Full gate green.
- 🎮 ✅ **E2E fixture events-route crash fixed + memory conflict-marker gate (2026-07-03 PM)** —
  (1) `pod-cleanup-shot.spec.ts` was failing in CI (looked like a flake): the mock had no
  `/plants/:id/events` route so it substring-matched the `/plants` LIST, `EventLog` rendered
  plant objects as events and crashed on `titleCase(undefined)`, taking the whole page down.
  Added the explicit fixture route; recorded in INCIDENTS.md (incl. correcting a wrong
  "CI contention" first guess). (2) BACKLOG.md had shipped three unresolved git conflict markers
  from a two-branch merge with no gate catching it — resolved (kept both sides' ✅ entries, it's
  append-mostly) and added `check_memory.py` check #6 (fails on any committed conflict marker in
  a memory doc), teeth-tested.
- 🎮 ✅ **Dedupe the floating boost tray (2026-07-03)** — the chamber had two boost-apply UIs
  reading the same `useBoostStore` state: the floating `ArcadeHUD` tray (4 boost buttons + its
  own grow-speed/countdown readout, absolutely-positioned over the 3D stage) and the inline
  `BoostsInline` quick-chip row already embedded in the GROW/ARCADE sheet
  (`web/src/components/plant/ChamberDock.tsx`) — the "floating menu" residue the owner
  specifically dislikes. `ArcadeHUD` (`web/src/components/arcade/ArcadeHUD.tsx`) is now slimmed
  to the two things `BoostsInline` doesn't cover — REWIND (`useRewindStore` snapshot scrubber)
  and the optional Phase-2 `chainSlot` (WalletConnect + Mint NFT, `ALGO_ENABLED`-gated) — as a
  small floating ⏪ button instead of a boost tray. `BoostsInline` is now the single boost-apply
  surface; its "Add Boost" button (which used to expand the old tray via
  `OPEN_BOOST_TRAY_EVENT`) was removed since the quick chips already apply boosts directly.
  `boostEngine.ts`'s store, cooldown logic, and `BOOST_COLORS`/reduced-motion handling are
  untouched — presentation-layer only. Verified mobile 390×844 + desktop
  (`web/e2e/dedupe-boost-tray-shot.spec.ts`): one boost surface, rewind opens its sheet, care
  tiles/ARCADE sheet/growth-boost unaffected; chain row (`ChainRow`) verified separately with a
  one-off `NEXT_PUBLIC_ALGO_ENABLE=true` build (this is a build-time flag with no existing e2e
  coverage) — Connect Wallet + Mint NFT still render inside the slimmed `ArcadeHUD`.
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
- 🎮 ❄️ **Plant mockup round 4 (2026-07-03, branch `design/plant-mockup-round4`, NOT merged —
  superseded by round 5 below)** — a canopy-density/silhouette-fill pass (flowering node pack
  1.42→2.5, cap 20→36, a new mid-branch `midBud`, wider/extra leaf fans, up to 2 bonus
  branchlets). Independently reviewed twice before merge: the owner's delegate scored it
  7.5/10 (real density win, but shape read as a two-headed **candelabra, not a cone**,
  orange/purple busy texture); a specialist botanical+procedural-rendering consultant then
  reviewed the CODE (not just the render) and scored it 6.0/10 with a precise root-cause
  diagnosis — Gelato's `apicalDominance: 0.55` yielded 2 co-dominant tops (a straightened,
  extended second spike), `apexSplay` was actively widening the f≈0.58-0.88 band instead of
  narrowing it, the branch-length taper was too shallow for a crisp cone, `midBud` added a
  3rd discrete bud blob botanically inconsistent with a continuous tapering spike, and
  pistil/purple-accent/frost density read as busy confetti rather than sparse accents. Left
  queued/unmerged rather than fixed in place, since it needed an independent architecture pass,
  not more density.
- 🎮 ✅ **Plant mockup round 5 (2026-07-03, specialist-diagnosed architecture fix)** — branched
  from `main` (round 3), NOT round 4 (round 4's density work was left queued/unreleased, per
  above) — implements the specialist's punch list against `chamberCore.ts` +
  `strainVisuals.ts`'s Gelato record: (1) Gelato `apicalDominance` 0.55→0.82 (verified
  `colaTops(0.82)` resolves `count=1`, collapsing the second co-dominant top); (2) `apexSplay`
  spread multiplier 1.8→1.25x and its tilt term scaled proportionally, so the upper-middle
  stops flaring; (3) branch-length taper `(0.35+0.65·low)`→`(0.24+0.76·low)` + Gelato
  `upperShorten` 0.3→0.4 for a crisper cone; (4) calmer texture — pistil count ×0.6 + smaller
  tip balls, per-pod purple-accent gain 2.4→1.4 (the fused-mass gradient carries the purple
  identity, pods now carry grain only), frost blob count ×0.6 and gated to the top third of
  each cola (`cl.yf > 0.66`) matching the mockup's subtle top-third frost. Additional restraint
  beyond the literal list, in the same spirit: a soft dark "under-mass" cone silhouette painted
  behind the branch loop so residual gaps read as shaded interior, not black background; a
  wedge-fill pass on the lowest tier (Gelato `lowerSpread` 1.14→1.28, enlarged + a second inner
  base fan, one low-node branchlet biased toward the stem-facing side); an explicit cone-reach
  clamp on regular (non-co-dominant) branches as a straight-taper guarantee; and a
  dominance-scaled taper on near-apex side-bud sizing (`SK.apicalDominance`-scaled) so a
  single-leader strain's near-apex side nodes stop inflating into competing spikes — gated so
  low-dominance bush strains (White Rhino, Purple Diddy Punch) keep their candelabra identity.
  Spot-checked G13 (still a clean single spear), White Rhino (still bushy/candelabra, correctly
  unaffected), Blue Dream (still a tall open sativa spear) via `gen-stage-pngs.ts` — no
  cross-strain regression. Gates: `tsc --noEmit` clean, `next lint` 0 errors, vitest 463/463 (no
  pinned values needed updating), `npm run build` clean, Playwright screenshots at 390×844 +
  desktop plus the full `care-loop-shot.spec.ts` (4/4) all green. **Honest self-score: 8/10** —
  single-leader cone architecture and calmer color/texture are a genuine, verified fix over
  round 4's candelabra/busy-texture read; remaining gap: individual cola shapes still read as
  separated, somewhat spiky "fingers" rather than the fully smooth, fused, painterly silhouette
  of the owner's mockup — that's a bud-mass-shape/rendering-style question (spline smoothing,
  color-fill technique), not an architecture one, and is out of this round's scope
  (`chamberCore.ts` + Gelato record only, no bud-shape rewrite). This PR's recommendation is to
  supersede round 4's PR #119 (open, draft, unmerged, base `main`) rather than merge it
  separately — round 4's density work stays queued on its own branch/PR in case a future round
  wants to layer it back on top of round 5's architecture; closing #119 is the owner's call, not
  done unilaterally here.
- 🎮 ✅ **Plant mockup round 6 (2026-07-03, close-up + full-plant reference photos)** — branched
  from round 5's commit (`fedc1d6`, single-leader cone architecture — inherited, not redone).
  Round 5 fixed architecture but over-corrected color: its pistil/purple-accent cut (per an
  earlier, overly conservative instruction) left the render predominantly GREEN with sparse,
  faint purple flecks — further from the target on the color axis than round 4, despite the
  architecture win. This round targets ONLY the color mechanism in `chamberCore.ts`'s
  `drawFlowerSite` (fused-mass gradient + per-pod accent), against two reference images: a
  close-up crop (purple as majority cola surface, green as base/edge) and a fuller-render
  reference supplied mid-round (near-total purple bract coverage, green confined to separate
  leaf blades, not blended into the bud mass at all) — the second, more extreme reference is
  treated as the primary bar since it's the more complete/authoritative target. Root cause: the
  round-5 fused-mass gradient held its purple stop as a single point right at the tip
  (`accAmt` capped 0.6, transition stop capped at 0.5 of the cola) so it visually washed to pale
  purple within the top ~20%; and the per-pod accent's tip-weighting curve (`exponent 2.1`,
  `floor 0.25`) confined accent-hued pods to roughly the top quarter of each cola at a damped
  `gain 1.4`. Fixes: (1) fused-mass gradient — `accAmt` gain ×2.0 + cap 0.6→0.98, a HELD purple
  plateau (two same-hue stops before the green transition, not an instant blend), transition
  point pushed to ~97% down the cola at max strength (was 50%); (2) per-pod accent — tip-weight
  exponent 2.1→0.65 and floor 0.25→0.02 so accent share ramps up almost from the cola base
  instead of only the top quarter, gain 1.4→7.0 so accent-hued pods saturate to "almost always"
  past the first few percent of the cola, accent pod saturation nudged +4→+9 over base (still
  capped well short of neon) so pods read clearly purple at a glance. Orange/pistil count
  UNCHANGED (round 5's reduction was correct per this round's brief — deliberately not
  reintroduced). Secondary, cheap win taken alongside (not the round's main effort): a touch
  wider per-cola mass envelope (`podW` multiplier 1.25→1.4, `cw` multiplier 0.56→0.62) so
  individual colas read a shade chunkier/more fused, a partial nudge on round 5's flagged
  "separated spiky fingers" gap — not a full fix (that needs branch-spacing/whole-plant-layout
  changes, out of scope here). Mechanism-only change (no strain-specific values touched in
  `strainVisuals.ts`): only strains with an authored/derived `accentHue` (anthocyanin > 0.05 —
  Gelato, Wedding Cake, Animal Mints, Purple Diddy Punch) are affected; spot-checked G13, White
  Rhino, Blue Dream via a headless mock-API Playwright render — all three unaffected, still their
  own distinct green/teal identities, no purple leakage. Gates: `tsc --noEmit` clean, `next lint`
  0 errors, vitest 463/463 (no pinned values needed updating), `npm run build` clean, Playwright
  `care-loop-shot.spec.ts` 4/4 green via a local playwright config (deleted before commit, not
  tracked) pinned to the sandbox Chromium binary. **Honest self-score: 8/10 against the reference
  photos** — purple now genuinely reads as the dominant, majority cola color with green correctly
  relegated to a base/edge/leaflet role and orange staying near-absent, a real fix over round 5's
  green-dominant read; remaining gap (inherited from round 5, not addressed here beyond the cheap
  width nudge above): individual cola texture is still a spiky stacked-pod look rather than the
  references' smooth, fused, diamond-bract silhouette, and the accent hue reads a touch more
  magenta/saturated than the references' dustier violet — both are bud-mass-shape/rendering-style
  questions (spline smoothing, color-fill technique, hue calibration), not color-dominance or
  architecture ones, and are out of this round's scope. Round 5's architecture (single-leader
  `colaTops` count=1, taper) is untouched and confirmed intact by the same cross-strain spot-check
  above.
- 🎮 ✅ **Chamber glow layer — Phase 2, in-canvas "arcade layer" (2026-07-03, PR pending)** — the
  in-canvas counterpart to Phase 1's DOM overlay, painted directly inside `drawChamberShell` in
  `web/src/lib/chamber/chamberCore.ts` (environment-only; the plant draw functions were untouched
  to merge cleanly alongside the cola-construction branches). Three additive-light pieces matching
  the owner's "10/10" hero render: (a) a soft GREEN rim/back glow behind the plant column — a wide
  scaled radial "column halo" plus a brighter apical "core bloom" over the top colas, both drawn
  with `globalCompositeOperation = "lighter"` so they read as backlight, not flat shapes (the
  panel is fully opaque — same reason Phase 1 needed a screen-blend DOM overlay); (b) the pot-base
  tech-ring upgraded to a bright green energy ring — a wide additive green bloom seated under it +
  a green ring stroke with a strong `shadowBlur` glow; (c) a green glowing soil pad where the stem
  meets the base, and the radiating spokes recolored to clean white-green ticks with a soft glow.
  Glow intensity is gated on `live.current.dev.budDev` (always-on baseline `0.5`/`0.55`, ramping
  to full as the plant flowers) so mature colas pop hardest. Boost-reactivity left as a clean
  `TODO(arcade)` — wiring the `boostEngine` zustand store into the plain-module renderer is
  non-trivial plumbing and out of scope; the DOM `BoostAmbientLayer` already handles boost tint.
  Verified with a standalone Playwright script (flowering Gelato fixture, mobile 390×844 + desktop
  1440×900, 2 look-compare-adjust rounds; script cleaned up). Gates: `tsc --noEmit` clean, `next
  lint` 0 new errors, vitest 472/472, `npm run build` clean, `care-loop-shot` 4/4 green.
- 🧰 ✅ **Visual-verification archive — screenshots become durable, indexed memory (2026-07-03,
  owner: "save those images... reference them... pull from the chapter list")** — every visual
  round used to rebuild the same throwaway Playwright rig (hand-copying `setup()` from
  `care-loop-shot.spec.ts`, hand-patching `playwright.config.ts` with the sandbox Chromium path,
  writing a one-off spec, deleting it all) and the evidence screenshots died with the session
  container. Now: (1) shared fixtures `web/e2e/fixtures/mockGame.ts` (extracted verbatim;
  `care-loop-shot.spec.ts` refactored onto it, 4/4 green = the regression proof); (2) permanent
  env-driven `web/e2e/capture.spec.ts` (`CAPTURE_ROUTE/STATE/VIEWPORTS/NAME/OUT/WAIT/CANVAS`,
  self-skips when unset so CI cost is zero); (3) `playwright.config.ts` auto-detects
  `/opt/pw-browsers/chromium` (stable symlink) with a `PW_CHROMIUM` override — the hand-patch
  ritual is dead; (4) `docs/memory/VERIFIED_RENDERS.md` — the chapter list: golden images
  committed under `docs/memory/verification/golden/` (curated, owner-taste moments only) and
  regen-only rows whose command+SHA is the artifact, link-rot enforced by the existing
  `check_memory.py` link rule since it lives in docs/memory/; (5) `.claude/skills/capture-shots/`
  skill + rows in CLAUDE.md/MAP.md/DOCS_INDEX.md for discoverability. Seeded with 5 goldens
  (round-8c chamber before/after; 3 microscope-audit evidence shots) + regen recipes for the
  care-loop proofs and the `gen:stages` browserless matrix (PR #29's renderer, rediscovered as
  the fastest plant-capture path). Zero new deps, no lockfile diff. Open owner calls recorded in
  the manifest rules: golden-promotion approval stays with the owner; commit budget stays
  curated. Design notes: recipes-not-pixels default, hybrid goldens (design-agent proposal,
  this session).
- 🎮 ✅ **Pod-recycle fix: harvested/dead plants can finally be cleaned up
  (2026-07-03, owner: "there's nothing else I can do... it should recycle... everything should be
  reset to zero")** — the backend (`GameService.cleanup_plant`, `DELETE /players/:id/plants/:id`)
  and the frontend mutation (`useCleanupPlant`) already existed, fully wired, completely unused —
  no button anywhere called them. Two fixes:
  1. **Backend correctness bug found + fixed while wiring this up**: `cleanup_plant` was hard-
     deleting the `Plant` row AND its `Harvest` row on cleanup. `CupEntry.harvest_id` is a
     non-nullable FK into `harvests` — cleaning up a pod after submitting that harvest to a
     Cannabis Cup would either violate the FK or leave a dangling reference. New `plants.archived_at`
     column (migration `d4e5f6a7b8c9`): cleanup now ARCHIVES (keeps the row, stamps `archived_at`)
     instead of deleting; `list_plants` excludes archived rows so the pod still reads as empty, but
     `Harvest`/`CupEntry` stay valid forever. Cost now reads from `balance.yaml`
     `simulation.actions.pod_cleanup.cost` (25 GC) instead of a hardcoded default. 5 new backend
     tests (archive-not-delete, harvest survives, double-cleanup rejected, balance.yaml cost,
     list_plants excludes archived) — full suite 1117/1117 green.
  2. **Frontend: the missing button, in all 3 places a player sees a terminal plant** —
     `lib/plantAction.ts`'s `nextPlantAction` used to return `kind: "none"` for a harvested/dead
     plant (a literal dead end with no button); now returns a new `"cleanup"` kind, wired through
     `PlantActionCTA` to `useCleanupPlant`. (a) Main dashboard (`PodCommandCenter`): the live
     CareDeck/Today's-Plan block — full water/nutrient bars + an active 6-tile care row — is now
     gated `!ended` and replaced by the Clean & recycle CTA when the plant is done (was the exact
     screenshot: 82%/83% bars still showing on a "Harvest complete!" plant). (b) Plant detail page:
     Vitals/Care swapped for a plain summary + the (now-fixed) `PlantActionCTA`. (c) Chamber page:
     "Grow another" was a plain `Link` back to `/dashboard` that never actually cleaned the pod
     (the harvested plant just kept sitting there) — now a button that pays the cleanup fee first;
     the "This plant has died" dead-end got the same fix. 3 new Playwright specs
     (`pod-cleanup-shot.spec.ts`, matching the owner's exact bug-report screenshots) + 2 existing
     specs updated for the Link→button change. Goldens VER-011/012 (before/after).
- 🎮 ✅ **Landing-page particle perf + scale fix (2026-07-03, owner: "particles are huge and it
  runs very slow... completely change that")** — `Constellation.tsx`'s leaf-mode ambient particle
  cloud (the ~/onboarding hero backdrop) had two bugs, both root-caused before fixing: (1) each
  particle's glow radius was a FIXED PIXEL SIZE regardless of viewport — the leaf silhouette itself
  correctly shrinks to fit a narrow phone screen (`base = min(w,h)*0.42`), but the dots didn't
  scale with it, so on mobile they overlapped into one solid fused blob (confirmed with a genuine
  before/after screenshot comparison, VER-013 — the before shot shows the leaf's "O" completely
  swallowed); (2) every one of up to 340 particles rebuilt a `createRadialGradient` from scratch
  EVERY FRAME — the same per-frame-gradient cost the chamber plant round fixed with sprite caching,
  applied here too. Fix: new `getGlowSprite()` cache (one offscreen glow+core sprite per
  color/radius-bucket/lit/dpr, blitted via `drawImage`) plus a `sizeScale` factor
  (`base / REFERENCE_BASE`, clamped) applied at blit time so dots stay proportional to the
  viewport instead of a fixed size; ambient particle counts also cut (340→160 landing backdrop,
  300→150 onboarding story-beat panel — GenBank's interactive graph mode is untouched). The
  `constellationLifecycle.test.ts` "sacred hash" pinning `draw()`'s exact body was intentionally
  updated in this commit per its own documented process (the file header says exactly when/how).
  Gates: tsc/lint/build/vitest (478/478) all green.
- 🎮 ✅ **Lab microscope rework phase 1 — real colors, real plant, real-microscope framing
  (2026-07-03, PR #137)** — first implementation slice of the 6-agent Lab-magnifier audit
  (recon×2 + design + architecture + gamification; report in the session scratchpad, evidence
  goldens VER-006..VER-010). Four changes, all Canvas-2D / plumbing — the frozen 3D lane
  (`bud3d/`, `PlantGL`, `BudGL`) untouched:
  1. **Purple-hue bug fixed at the root** — `Microscope.tsx` computed `hue = 96 - purple*50`
     (max 66° olive-yellow; purple strains could never render purple, flagged independently by
     all four specialists). New pure `calyxTint()` in `microscopeGeometry.ts` renders each calyx
     from the strain's AUTHORED `strainVisuals.ts` BudColor — the same source the Grow Chamber
     uses — including the accentHue/accentFrac purple-accent mix (Gelato: green base + ~50%
     violet calyxes, verified in golden VER-010); the legacy scalar fallback now actually sweeps
     96°→290°. Accent roll is a position hash, NOT a geometry-RNG draw, so the pinned
     `buildBudGeometry` determinism tests are untouched.
  2. **Live-plant deep-link** (the audit's flagged scope decision, owner-approved) —
     `/lab/microscope?plantId=…` seeds specimen + maturity from the plant's real
     `/state` trichome telemetry via new pure `maturityFromTelemetry()` (0.5·cloudy + amber,
     normalized; care-loop fixture's 30/62/8 → 39% = "cloudy/peak", matching the server's own
     dominant read). LIVE badge when synced, ↺ Re-sync button after what-if scrubbing, server
     `recommendation` shown in the readiness card, Back-to-chamber action. Entry point: the
     chamber's dead "🔬 View Bud · Coming soon" chip is now a live "🔬 Inspect trichomes" link
     (the parked WebGL View Bud route itself is unchanged — still a one-line re-enable);
     `bud3d-shot.spec.ts`'s chip assertion updated to match.
  3. **Terpene-label collision fix** — max-zoom labels now skip placements overlapping an
     already-drawn label (recon-verified pileup bug).
  4. **µm/mm scale bar** (bottom-right, 1/2/5×10ⁿ steps, WORLD≈25 mm calibration) — the
     real-microscope framing quick-win from the design review.
  Gates: tsc clean · lint 0 errors · vitest 478/478 (6 new: calyxTint ×3, maturityFromTelemetry
  ×3) · build clean · care-loop-shot 4/4 + bud3d-shot 1/1 green. Next phases (parked in this
  entry, owner-prioritized): "Call the Harvest Window" scoring mechanic + scan-coverage lens
  mechanic + terpene-discovery codex (gamification report §5), geometry swap to shared
  `budDna.ts` bract-shape genetics, chamber-grade bract shading port.
- 🎮 ✅ **Plant round 8c — leaf + bract texture layering (2026-07-03, owner: "the leaves and the
  actual node clusters... it's more of the layering in the texture")** — the owner flagged the
  live chamber plant's foliage and cola surface as reading flat/decal-like on close inspection.
  Two scoped fixes in `chamberCore.ts`, both draw-path-only (no build-time RNG stream touched, no
  pinned test values changed):
  1. **`drawFan` (every fan-leaf call site)** — leaflets previously came from one fixed `FAN_A`/
     `FAN_M` table filled with a single flat `hsl()` colour, so every fan at every node was an
     identical stamped decal (only the caller's overall size/rotation varied). Added a cheap
     deterministic hash (`fanJit`, pure function of a stable per-instance seed — `nd.phase`,
     `bl.phase`, `lf.rot` — and the leaflet index; no new RNG calls, so build-time determinism and
     every pinned test are untouched) driving per-leaflet length/width/angle/tone jitter, and
     replaced the flat fill with a light↔shadow linear-gradient "facet" per leaflet (plus a second
     shadow-crease stroke alongside the existing vein highlight) so each blade reads as a folded
     surface, not a solid-colour cutout. All ~10 `drawFan` call sites now pass a seed.
  2. **`drawPod` (per-bract calyx draw)** — the volumetric radial-gradient shading (this file's own
     comments call it "the single highest-leverage fix" for the bud reading as a scale, not a
     berry) was gated `w > 4.2`, but `podW` is itself clamped to a 4.2 ceiling — so in practice
     almost no pod ever cleared the gate and the cola was built almost entirely from the flat-fill
     branch, which is why the shingled-bract structure (round 7/#127's ring-parity work) read as a
     smooth blended blob instead of a textured stack. Removed the gate (every pod gets the
     gradient now), lowered the tip-glow/ridge-vein gate `2.2→1.2` (same problem, smaller pods were
     silently skipping it), and added a new base "undercut" shadow (a soft dark linear-gradient
     wash on the lower third of each bract) — independent of the light-direction radial gradient —
     so overlapping bracts read as physically shingled scales, not a blend.
  Verified with the same headless mock-API Playwright render (Gelato, `late_flower`) cropped 3× on
  the foliage/node-cluster region and the top cola, before/after: leaflets now show visible
  per-blade size/shading variation instead of identical copies; the cola's green/base tiers show
  clearly separated individual bract highlights+shadows instead of one smooth gradient. The
  purple/accent-heavy tip band is a smaller remaining gap — the strong `tipBlend` accent wash still
  dampens per-bract contrast there more than the green base tiers. Gates: `tsc --noEmit` clean,
  `next lint` 0 new errors, vitest 472/472, `npm run build` clean, `care-loop-shot.spec.ts` 4/4
  green, `check_memory.py` OK. Owner to re-verify visually; the purple-tip layering gap is a
  candidate follow-up if it still reads flat there.
- 🎮 ✅ **Plant mockup round 8 — airier separated candelabra (2026-07-03, owner "10/10" hero
  render)** — whole-plant branch-LAYOUT pass in `chamberCore.ts` only (no `strainVisuals`/
  `apicalDominance`/`morphology` value changes, so no pinned test touched). The owner's new hero
  render reverses the round-2..7 density push: it wants FEWER, more-separated colas fanning OUT
  from the spine with visible dark air between each distinct spear — not the solid fir-tree mass
  the live plant had become. This is the direct fix for the "separated spiky fingers vs fused
  mass" tension rounds 5/6 flagged as out-of-scope (branch spacing / whole-plant layout) — but
  toward SEPARATION, not fusion, per the hero. Six `buildPlant` levers: (1) flowering node pack
  1.42→1.16 + hard cap 20→16 (more vertical gap between tiers); (2) branch length base 0.27→0.31
  with a lifted apex floor `(0.24+0.76·low)`→`(0.30+0.70·low)` (colas held further OUT); (3)
  `apexSplay` band starts lower/wider (`f-0.58/0.30`→`f-0.46/0.36`) so more upper side branches
  fan out, not just the top 2-3; (4) apex-splay spread reach 1.25→1.5×; (5) branch tilt base
  0.92→0.98, splay tilt term 0.17→0.28, skirt tilt 1.12→1.18× (branches angle away from
  vertical, carrying colas off the spine); (6) cone-reach clamp opened `lerp(0.1,0.5·spread)`→
  `lerp(0.14,0.62·spread)` so the longer branches aren't clipped back. Plus the interior
  de-clutter: the stem-hugging node-intersection bud (round 3's "near-zero empty interior"
  filler) gate raised `0.24`→`0.5` so only upper nodes carry one — the lower/mid interior opens
  to dark air + fan leaves, letting branch-tip colas read as distinct separated spears. Foliage
  (skirt/inner/node fans) untouched, so the plant stays leaf-full/airy, not bare. Verified with a
  headless mock-API Playwright render (full chamber, `late_flower`) of Purple Diddy Punch
  (multi-cola), G13 (single green spear) and Gelato (single purple-dessert spear) — all three now
  read as an airy separated candelabra with a dominant apex and clear dark gaps between distinct
  colas, matching the hero; single-dominant-apex preserved. Gates: `tsc --noEmit` clean, `next
  lint` 0 new errors, vitest 472/472 (no pinned values needed updating), `npm run build` clean,
  `care-loop-shot.spec.ts` 4/4 green. **Honest self-score: 8.5/10** — the airier separated
  candelabra + held-out colas is a genuine, verified match to the hero's spacing over the prior
  dense-fir read. Remaining gaps (out of this layout round's scope): individual cola shape/width
  and the pistil/frost texture (a parallel specialist owns those in the same file); indica/sativa
  height-spread widening (indica ~½ sativa height) was left untouched — a `morphology.ts`
  archetype change, deferred as not needed for the spacing fix.
- 🎮 ✅ **Chamber ambient glow layer — Phase 1, DOM/CSS only (2026-07-03, PR pending)** — new
  `web/src/components/plant/BoostAmbientLayer.tsx`, mounted as a sibling of `PlantReactionLayer`
  in the chamber stage (`chamber/page.tsx`). Zero `chamberCore.ts` edits — deliberately scoped
  around the two concurrent cola-construction branches (`design/cola-construction-layers`,
  `design/cola-construction-structure`) that are mid-flight on that file's bud-drawing functions,
  so this ships as a pure overlay with no collision surface. Three pieces: (a) a static
  rim/backlight bloom behind the plant column, always on (not boost-gated) — `mix-blend-mode:
  screen` because the chamber canvas is fully opaque, so a CSS drop-shadow can't bleed through it
  but a screen-blended radial gradient can; (b) a boost-tinted ring pulse over the floor-ring
  band (reuses the `gpe-react-aura` keyframe looped instead of its one-shot class), visible only
  while `useBoostStore`'s `activeBoost` is set and unexpired; (c) drifting sparkle bokeh
  (reuses `gpe-arcade-particle`'s `--angle`/`--dist`/`--dur` custom props, looped + alternated,
  capped at 8 particles), tinted from `BOOST_COLORS`. All new animated classes
  (`gpe-glow-ring-pulse`, `gpe-glow-sparkle`) added to the `prefers-reduced-motion` kill-switch in
  `globals.css`; reduced motion collapses the ring to a static `gpe-glow-ring-static` glow and
  drops the sparkles, the rim bloom stays (per spec, it's meant to read as static ambience either
  way). Verified live: mobile (390×844) portrait stacks the action-tile bar directly over the
  canvas's `floorY` band (chamberCore's `cap.floorY = cap.y + cap.h*0.875`), so the ring is tuned
  to `bottom-[13%]` of the stage rather than a naive `bottom-[6%]` (which landed the glow fully
  behind the opaque WATER/FEED/… tiles) — it now reads as a warm glow at the base of the canopy,
  above the tile row; desktop's landscape split (dedicated stage column, no tile overlay) reads
  cleanly at the same offset. Evidence screenshots at `e2e-output/glow-layer-idle.png` /
  `glow-layer-boosted.png` (mobile, gitignored — not committed) plus per-viewport idle/boosted
  shots at 390×844 and 1440×900 during iteration (3 look-compare-adjust rounds: initial mount →
  ring found buried under the action tiles and repositioned → reduced-motion collapse verified
  via a `reducedMotion: 'reduce'` Playwright context). Gates: `tsc --noEmit` clean, `next lint` 0
  errors, vitest 463/463 (no new/changed pinned values), `npm run build` clean, `care-loop-shot`
  4/4 green unmodified. **Phase 2 (DONE — see entry above): in-canvas ring/soil glow modulation in
  `chamberCore.ts` itself** (matching the reference image's radiating tech-ring spokes more
  directly than a DOM overlay can) — was intentionally deferred until the two cola-construction
  branches landed, to avoid a three-way collision on the same file's draw functions.
- 🎮 ✅ **Top cola construction v2 — structure-first (2026-07-03, "GroVerse Anatomy & Construction
  Guide" reference set — Top Cola / Pistil Hair / Top Cola Tip / Bract-Calyx Scale breakdowns)** —
  branched from round 6's commit (`9f98c9e`; round 5's single-leader cone architecture + round 6's
  purple-dominant color are inherited, not redone). Round 6 flagged the remaining gap as "spiky
  stacked-pod look, not the references' smooth fused diamond-bract silhouette" — this round
  targets exactly that, scoped to `chamberCore.ts`'s flower-site build/draw functions only. (1)
  **Bract shape** — `podPath` rewritten from a wide rounded bulb to a pointed elongated
  teardrop/diamond (narrow base → shoulder ~30% up → sharp needle tip at `-0.86h`), the
  single highest-leverage change per the reference's "pointed scales, not round berries" goal;
  `drawPod` gained a faint tip-to-base ridge/vein overlay + a per-bract axial brighten (muted at
  the base, saturated glow at the tip) for non-flat surface read. (2) **Shingle overlap** — the
  per-cluster paint loop now iterates tip-to-base instead of base-to-tip (`shingleOrder`), so each
  lower tier's bracts lay forward over the base of the tier above (roof-shingle read); bract
  height bumped 1.6→1.85× width to close the dark chamber-background valleys the sharper tip
  shape initially opened between tiers (verified via cropped screenshot iteration, not asserted).
  (3) **Purple gradient** — round 6's per-pod colour was a coin-flip between two flat hues
  (probability-gated by tip position); replaced with a continuous `tipBlend` driven by the pod's
  tier position, blended in RGB space (`blendHueSat`, new pure helper) rather than HSL hue-degree
  space — direct hue-angle interpolation swept through a hot saturated red/orange band at ~mid-
  cola (caught and fixed via the first screenshot round), RGB blending reads as the reference's
  muted dusty-maroon transition instead. (4) **Pistil hairs** — root points are now grouped
  per-cluster "seams" (2-4 shared anchors, not one independent random root per hair), density
  scales with tier position (`tierDensity`, denser near the tip), and the filament is a filled
  tapered wedge (thick root → fine tip) instead of a constant-width stroke. (5) **Sugar leaves**
  shrunk/narrowed (2 thin blades vs. the old 3-blade near-full fan) per "small narrow leaves
  between clusters, not fan leaves." (6) **Frost** anchored to a specific pod's tip/ridge
  (deterministic pick from the spark's angle) instead of a free polar offset from the cluster
  centre, and the hard `cl.yf > 0.66` cutoff replaced with a smooth taper so it thins gradually
  toward the base. Spot-checked G13/White Rhino/Blue Dream (all `accentHue == null` → the new
  gradient blend is a no-op for them by construction; confirmed visually unchanged aside from the
  shared structural changes). Gates: `tsc --noEmit` clean, `next lint` 0 errors, vitest 463/463
  (no pinned values needed updating), `npm run build` clean, `care-loop-shot.spec.ts` 4/4 green
  via a local playwright config (deleted before commit, not tracked; port 3010 was occupied by a
  concurrent sibling agent's server on this shared sandbox host, so the local config used 3055
  instead to avoid colliding with it). **Honest self-score: 7/10** — the bract shape, shingle
  paint order, RGB-blended gradient, and seam-anchored tapered pistils are genuine, verified fixes
  directly against the reference breakdowns and close the round-6-flagged gap significantly;
  remaining shortfalls: (a) node anchor tiers were NOT restructured this round (still the
  round-5/6 continuous-ish tier spacing, not visually discrete node points) — item 2 of the
  8-layer guide is only partially addressed; (b) a handful of small dark valleys between tiers
  persist in places even after the podH increase — "no visible gaps" (bract/calyx reference item
  3) isn't fully met; (c) trichome frost's anchoring mechanism now correctly follows bract
  tips/ridges, but its visual weight at chamber scale reads as subtle/light rather than the
  references' heavy tip frosting — a density/alpha tune, not touched here to stay inside this
  round's scope. A sibling agent is attempting the same brief with a layer-order-first approach on
  branch `design/cola-construction-layers` — see that PR for a second read on the same references.
- 🎮 ✅ **Top cola construction round 8 — deterministic ring-parity "stacking" alternation
  (2026-07-03, owner verbatim: "each area has to be populated with a stacking pattern — 12 in one
  ring, 8 stacked inside, every other one purple, then the top stacks with a different colour... is
  there a numerical/algorithmic way to structure the bud, instead of just a blob?")** — a dispatched
  botanical/procedural-generation research pass (WebSearch + full codebase read) confirmed real cola
  bract growth IS nodal/whorled, that the file's own golden-angle constant (`j * 2.399` ≈ 137.5°,
  already used for pod placement here) is the correct real-world pattern (pinecone/sunflower
  phyllotaxis), and — critically — that `buildMacro` ("Detailed Bud View," ~line 1252, not yet a
  live route: "Coming soon") already implements a proper deterministic golden-angle ring-pack; this
  round ported the missing piece (deterministic colour, not the already-correct placement) down into
  the LIVE view, `buildFlowerSite`. Scope, in `chamberCore.ts`: (1) `Cluster.pods` gained a
  `parity` field — a pod's position (odd/even) within its own ring (`ringCounts` tracked per-ring
  during generation), deterministic, not random; (2) placement/ring-size math (2/3/3/rest,
  continuous golden-angle spiral) is UNCHANGED — round 7 tuned that across several passes, no reason
  to re-litigate it; (3) colour: `parity`/`ring` now drive a deterministic hue/lightness/saturation
  offset applied AFTER the existing base→tip `tipBlend` gradient (folding the alternation INTO
  `tipBlend` was tried first and was nearly invisible — that fraction clamps to 1.0 well before the
  tip, swallowing any additive term exactly where the pattern most needs to show). Verified with a
  same-session before/after screenshot comparison (not just self-report): the "before" render read
  as a smooth purple gradient with only faint random mottling; "after" shows a clearly legible
  alternating diamond-scale texture up each cola, checked on both a purple-accent strain (Purple
  Diddy Punch) and a pure-green strain (G13), at both desktop crop and mobile (390×844) scale — still
  reads as a cohesive cone silhouette, not speckle/noise. Gates: `tsc --noEmit` clean, `next lint` 0
  new errors, `vitest run` 463/463 (no pinned-value regressions), `npm run build` clean,
  `care-loop-shot` 4/4 green unmodified. Left untouched: `buildMacro` itself (not a live route yet —
  a natural follow-up once "View Bud" ships), hair/pistil/frost logic, silhouette/mass-gradient
  drawing.
- 🎮 ✅ **Game-hub restructure — ACTIVE LANE DEFINITION (2026-07-03, owner directive, verbatim
  intent)** — *"There are too many windows. Everything should be accessible from the main game
  page. Don't repeat all of the watering everywhere — have that in ONE spot. Anybody should be
  able to play the ENTIRE game from the main game page. The Grow Chamber should be something
  different — the ARCADE part of the game: that's where you boost, train, trim. Don't create any
  new chambers or pages. Merge everything into the main grow panel; the chamber is for the
  arcade part."* Shipped in place, no new routes: the **main game page** (dashboard →
  `PodCommandCenter`) now closes the full care loop — the six-tile `ChamberActionBar` replaces
  the old `CommandActionBar` in `CareDeck` (one care surface; `CommandActionBar.tsx` deleted),
  and Today's Plan + Plant Insights + Harvest & Sell (`ChamberPanel`), `PlantProgressStrip`,
  `EncouragementFooter` and `PlantReactionLayer` are imported from the existing tested
  `ChamberDock.tsx` (not forked). The **chamber** is now the ARCADE layer: stage + HUD strip +
  reactions + action tiles + boosts tray stay, GROW tab renamed ARCADE and slimmed to
  BoostsInline + growth boost (Today's Plan / Insights / progress strip / footer removed there —
  nothing the player NEEDS is chamber-only), header reads "GROW CHAMBER · ARCADE", and the main
  page links to it via a 🕹 Arcade chip on the stage. `care-loop-shot.spec.ts` re-cut: full loop
  proven on `/dashboard`, chamber asserted arcade-only. **Future item (owner-named): the parked
  Clone Room / cloning-lab concept folds into this hub model later — no cloning built now.**
- 🎮 ⬜ **Bud/flower polish notes (owner, future polish — NOT blockers)** — remaining after the
  round-3 pass above: tighter bract clusters; better embedded sugar leaves; subtle trichome
  sparkle at phone size (current frost is deliberately faint); painterly per-cola shading
  toward the mockup's airbrushed depth. 2D chamber-engine tuning lane (chamberCore),
  distinct from the ❄️ frozen 3D lane below.
- 🎮 ❄️ **Parked for later (owner-named, do not resume without explicit direction)**: photoreal
  bud viewer, full 3D cola inspection, trichome particle macro mode, scientific Lab breakdown,
  university 3D model, advanced morphology layer toggles. See the ❄️ items under "HERMES
  University + hardening" below for the specific backlog rows this covers.
- 🎮 ✅ **Mint metadata server-truth fix (2026-07-03)** — fixed — mint metadata now sources
  grow_day/bud_dev from server truth, not boosted/preview display values, matching
  trich_density/grow_stage. `chamber/page.tsx` was passing the boosted/previewed visual `day`
  and `budScalars.budDev` into `ChainRow`'s `mintOptions`, so minting mid-boost or mid-scrub
  could permanently write an internally inconsistent ARC-69 snapshot: grow_day/bud_dev reading
  a fictional advanced state while trich_density/grow_stage (already read straight off `plant`
  in `buildPlantMetadata`) read the real one. Added `mintTruthMetadata()` (pure, in
  `lib/chamber/morphology.ts`) that derives grow_day/bud_dev from `liveNominalDay` — the
  authoritative (stage, stage_progress_pct) day, before any boost offset or preview override —
  and wired the chamber page to feed it into `mintOptions` instead. On-screen rendering
  (`day`/`dev`/`budScalars`) is untouched; only what gets minted changed. No change to
  `mintPlantNFT`/`updatePlantMetadata`/`harvestAtomicGroup` signatures or transaction-building.
  Tests: `morphology.test.ts` (boost-only, preview-only, and boost+preview-simultaneously cases)
  + new `chain/algorand/__tests__/plantNFT.test.ts` locking `buildPlantMetadata`'s
  server-truth contract.
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
- 🏛️ ✅ **University wiring audit (2026-07-03)** — 16 backend routes traced against 15 api.university.*
  frontend methods. One structural gap found + fixed: `GET /university/courses/<key>/audio` was
  accessed via hardcoded raw `fetch()` URL in the course page (outside the api abstraction, no
  error handling, no auth injection). Fixed by adding `api.university.audioUrl(courseKey)` helper
  (returns the URL string — intentionally not an apiFetch call since audio streaming and HEAD
  probe need a raw URL). All 15 remaining routes verified: paths, HTTP methods, auth behavior all
  match their backend routes. Remaining open work: HERMES memory doc (see ⬜ item below).
- 🏛️ 🔨 **Produce-once lesson audio (ElevenLabs)** — lectures must be produced once and saved, never
  re-billed per delivery. Today `/lecture` can mint a fresh AI lecture *and* fresh TTS per attend
  (content-hash keyed); the produced-once path exists only on `/university/courses/<key>/audio`.
  Unify on produce-once; `ELEVENLABS_API_KEY` stays host-secret-only (never in chat/repo).
- 🏛️ ✅ **HERMES memory layer (2026-07-03)** — created `docs/memory/design/HERMES_UNIVERSITY.md`:
  identity, layer map (with 2026-07-03 ClaudeAdmissions + ClaudeRoadmap status), lesson-production
  pipeline, provider table, open-work list, must-not-drift invariants. Updated `10-hermes-university.md`
  layer map rows to reflect real providers.
- 🔴 ⬜ **Security follow-ups from PR #104** (before public launch): settlement **deposit** redesign
  (player-signed + indexer-verified inbound transfer) + **withdraw idempotency key** (treasury; owner
  gate); web CSP nonce (drop `'unsafe-inline'`) + move the player key off `localStorage`; TS api-server
  CORS allowlist; client-supplied `blockHash` / time-seeded `storyEngine` RNG hardening; add the
  missing `snapshot.yml` backup workflow (or correct SECURITY.md); replace post-merge
  `drizzle-kit push` with generated migrations; delete the stale nested
  `growpod/artifacts/api-server` copy; dev-bypass explicit opt-in for previews.
  (Security audit 2026-07-05: **CODEOWNERS is done** — `.github/CODEOWNERS` exists, added
  2026-06-25, predating this bullet's last edit; struck from the open list.)
- 🏛️ ⬜ **Global Learning Memory + personalization (design/11, owner directive 2026-07-02)** —
  P1 `knowledge_events` capture (append-only, anonymized-on-read, single-writer) at the 4
  generative call sites; P2 admissions persistence + `personal_context` into lecture/Master
  Grower; P3 `search_global_knowledge` retrieval tool (the teacher gets smarter from every
  player); P4 `global_insights` rollups + class-stats surface. Spec:
  `docs/memory/design/11-global-learning-memory.md`.
- 🏛️ ⬜ **University dev-clock doesn't reach study-time (playtest finding, 2026-07-05, confirmed
  by two independent playtest agents)** — `UniversityService`/`LecturerService`/
  `LearnerModelService` all hardcode `SystemClock()` instead of `active_clock()` (contrast
  `GameService`/`SimulationService`, which both correctly default to `active_clock()` — the
  thing `/api/dev/clock/advance` actually works through). Confirmed empirically both times: a
  48h dev-clock advance leaves `study_hours_remaining` completely unchanged. Every course is
  gated on genuine wall-clock time (12h–192h) with **no dev/QA affordance** — one playtest could
  only reach an exam by directly backdating a DB row. Files: `services/university_service.py:119`,
  `services/lecturer_service.py:29`, `services/learner_model_service.py:43`.
- 🏛️ ⬜ **Course completion isn't celebrated; only a whole degree grants a title (playtest
  finding, 2026-07-05)** — `complete_course()` awards XP/KXP/streak only (no badge/title/moment);
  the UI flips a status pill from amber "Enrolled" to green "Completed" plus a toast, full stop.
  Profile's "Lifetime titles" card explicitly requires "win a Cannabis Cup **or earn a degree**"
  — individual courses never count, and a degree is 2-6 courses each gated on a real-gameplay
  practical, so "get a degree" (the headline framing) is many real-time days away with no visible
  intermediate waypoint. `services/university_service.py:195-254` (course) vs `:345-373` (degree,
  the only title-granting path).
- 🏛️ ⬜ **bio-101 is a non-credentialing dead-end for the first-steered course (playtest finding,
  2026-07-05)** — extends the existing "Reconcile prerequisite graphs" open-work item above:
  bio-101 is the course the catalog points a new player at first (no prereqs, "Available" badge,
  the only course with a real exam bank today) and can be fully completed + aced, but it isn't
  required by any of the 5 degrees and doesn't appear in the Learner roadmap either — the most
  polished, most-discoverable slice of the feature doesn't connect to the credentialing structure
  it's ostensibly part of. `data/curriculum.yaml` (no degree lists `bio-101`).
- 🏛️ ⬜ **University is invisible to onboarding and demoted on mobile (playtest finding,
  2026-07-05)** — `web/src/components/layout/navLinks.ts`: University lacks `primary: true` (so
  it's desktop-nav-only; mobile tab bar omits it, one tap deeper in "More") and has no entry in
  `ONBOARDING_NAV_IDS` (the guided FTUE tour spotlights Grow/Lab/Market/Cup/Guide/Profile, never
  University). A new player who doesn't manually scan the nav will never learn the feature exists.
- 🏛️ ⬜ (informational, not a confirmed bug) **Mock-provider lecture text is repetitive without
  an AI key; ElevenLabs-less dev envs hide the marquee audio feature entirely** (playtest finding,
  2026-07-05) — expected behavior of the deterministic mock `LecturerProvider`/no-`ELEVENLABS_API_KEY`
  dev config (audio route returns 204, `CourseAudioPlayer` renders nothing), not a bug — flagging
  so a future pass doesn't mistake environment artifacts for product defects.
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
  `Player.last_active_at` (exactly what WO-2 "welcome-back delta" needs). **Corrected 2026-07-03:
  the old `/contracts` "whole built surface, one navLinks line" item is STALE — `web/src/app/
  contracts/page.tsx` is now just a 6-line legacy `redirect("/market")` (NPC contracts already
  live under Market → Contracts tab, which IS in the nav). Do NOT add a nav entry (it would point
  at a redirect that lands on Market, already reachable). The redirect stub is fine to keep for
  old bookmarks; nothing to wire.**
- 🟠 🔨 **Retire: superseded/dead web code** — ✅ **web cluster retired (2026-07-03 PM)**:
  removed `components/intro/` (4 files; superseded by FTUE), `components/pod/PodCard.tsx` +
  `EnvironmentForm`/`WeatherRoller` (superseded by Command Center), `command/CommandTopBar.tsx`/
  `CommandFooter.tsx` + stranded `hooks/useLiveClock.ts`, and `lib/timeControls.ts` (+ its test)
  — 12 files, each verified unreferenced (no external imports, no barrel re-exports, no test/e2e
  refs) before deletion; full gate green after (tsc/lint/build/vitest 475/e2e 52). ⬜ Remaining:
  backend `serve_narration` route (superseded by produce-once audio). Owner-taste call:
  `onboarding/VideoHero.tsx` + `public/media/*` (revive on landing or retire).
- 🟡 ✅ **Retire: stale TS scaffolding (2026-07-03)** — deleted growpod/artifacts/ (TS Express
  api-server + Vite mockup-sandbox, ~106 files), `growpod/lib/` (Drizzle db stub, orval-generated
  api-client-react/api-zod, api-spec stub), `growpod/scripts/src/hello.ts` + tsconfig.json +
  package.json, `attached_assets/` (dev screenshot/paste dumps). Updated `pnpm-workspace.yaml`
  (packages: []), `growpod/tsconfig.json` (references: []), `growpod/package.json` (typecheck
  simplified). Python/shell scripts (check_memory.py, testenv-up.sh, etc.) untouched. Net: 9917
  lines removed, no functionality lost. ⬜ Remaining: backend `serve_narration` route (superseded
  by produce-once audio); `scripts/build-production.sh` + `start-production.sh` (stale deploy
  scripts — left since they're shell, not tracked by pnpm).
- 🟡 ✅ **Dead DB columns (2026-07-03)** — dropped `ResearchProgress.unlocked_at`,
  `GrowthMeasurement.leaf_count`, `GrowthMeasurement.growth_rate` via migration
  `e5f6a7b8c9d0_drop_unused_columns.py`; model updated; 1117 tests green.
  `Player.last_active_at` is the wire-in above. `INDEXER_URL` kept (needed for settlement redesign).
- 🟡 ✅ **Docs hygiene tail (2026-07-03)** — all open ⚠️ items from `docs/memory/DOCS_INDEX.md`
  bannered or closed: `BUILDLOG.md` (FROZEN banner), `CANONICAL_STATE.md` + `STUDIO_AGENT_REGISTRY.md`
  + `AGENT_ORCHESTRATION_LEDGER.md` (SNAPSHOT banners, restamped 🧊), `docs/DEV_BUILD_LOG.md`
  (HISTORICAL banner), root `docs/DATABASE_SYSTEMS_AUDIT.md` (HISTORICAL + cross-ref banner),
  `docs/00–09` snapshots (marked 🧊 in DOCS_INDEX). DOCS_INDEX stale ledger table updated.
  ⬜ Remaining: HANDOFF staleness gate in `check_memory.py` (deferred — low urgency while HANDOFF
  is actively maintained).
- 🟡 ✅ **Unreachable AI-factory branches (2026-07-03)** — built `ClaudeAdmissions`
  (`admissions_claude.py`) and `ClaudeRoadmap` (`roadmap_claude.py`); both now activate when
  `ANTHROPIC_API_KEY` is set and `USE_MOCK_AI` is false. MasterGrower was already done. HeyGen
  arm stays intentionally mocked (owner-gated spend).

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
- 🚀 ✅ **STEP 4.5 — GameService on `active_clock()` + cure/auction e2e** (2026-07-03) —
  `game_service.py:87` wired to `active_clock()`; cure start/finish use `self.clock.now()`;
  `test_cure_advances_under_dev_clock` in `tests/test_e2e_grow_loop.py` proves cure
  fast-forwards under the dev clock and is guarded against early finish. 1117 green.

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
  *(➕ Extended 2026-07-03: added check #6 — fails on an unresolved git merge-conflict marker
  (`<<<<<<<` / bare `=======` / `>>>>>>>`) committed into a memory doc. BACKLOG.md had shipped
  all three from a two-branch merge (chamber-glow-Phase-2 × airy-candelabra) with no gate catching
  it; resolved by keeping both sides' ✅ entries — this is an append-mostly log. Teeth-tested.)*

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
