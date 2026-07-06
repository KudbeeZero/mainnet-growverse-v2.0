# 🔨 Disruptor Sweep — Adversarial Game-Flow Probe + AAA / App-Store Bar

> **Date:** 2026-07-06 · **Base:** `main` @ 221a0ff (post PR #162) · **Type:** read-only adversarial audit.
> **Method:** 11 read-only probe agents across the full player loop (grow → care → harvest → cure →
> sell/breed/stabilize → mint/trade), then **6 independent verifier agents** on the top single-sourced
> claims. Nothing in this sweep touched code — it is a findings report only. Every CRITICAL/HIGH below
> was confirmed by a second, independent code read.
>
> **Protected surfaces** (`chain/`, settlement, `balance.yaml`, auth, migrations, lockfiles) were
> **reported on, never modified.** Economy/chain fixes are owner-gated and require the Security-Reviewer
> checklist + testnet click-test per `docs/BUILD_RULES.md` — this report recommends, it does not patch.
>
> **Tags:** `[NEW]` = not in any tracked planning doc · `[ROADMAP-WRONG]` = memory doc is factually
> inaccurate vs the code · `[PLANNED]` = already tracked (referenced, not re-litigated).

---

## TL;DR — the one thing that matters

**The single most severe finding is NOT in the flagged NFT feature — it's in core, always-on code.**
`harvest_plant()` has no growth-stage or is-alive gate, so a brand-new seed can be harvested for
**full value in one API call at t=0**. Every other economy exploit here sits behind the NFT
marketplace/staking flags, which are **OFF by default** (`balance.yaml:591-592`, testnet-only) — so they
are *not* exploitable in production today, but they are landmines the moment that flag flips. The harvest
gate is the exception: it is live on `main` right now.

**Merge-safety verdict:** the docs (PR #157) and the NFT feature (PR #162) were safe to merge as
*shipped* — the NFT surface is fail-closed behind OFF flags. But **do not enable the `nft_marketplace` /
`nft_staking` flags** until findings #2–#8 are fixed, and **the harvest gate (#1) should be fixed on
`main` regardless of any flag.**

---

## Ranked findings (most severe first)

Severity considers both blast radius **and** whether it's live today (LIVE) vs. gated behind an
OFF-by-default flag (GATED).

### 1. `[NEW]` CRITICAL · LIVE — Harvest has no stage/alive gate → instant full-value harvest
**`services/game_service.py:1059-1063`** (route `api/game_api.py:533-547`). ✅ verified.
`harvest_plant()` guards only existence, ownership, and `plant.harvested`. It never checks
`growth_stage == GrowthStage.HARVEST` or `plant.is_alive`. `weight_g` (`:1080-1081`) depends only on
`plant.health` (default `100.0` → factor `1.0` = full midpoint yield); quality resolves to `100` because
`quality_window_delta` returns `0.0` for the `"not_flowering"` window. Net: plant a seed → immediately
`POST …/harvest` → full-value harvest, zero time, zero care, zero risk. The guard pattern already exists
in the codebase — `cleanup_plant` (`:1133`) checks `is_alive` — it was simply omitted here.
**Recommended fix (S):** add `if plant.growth_stage != GrowthStage.HARVEST.value: raise GameError(...)`
and an alive check, mirroring `start_cure`/`cleanup_plant`. Provable green via a new test asserting a
seed-stage harvest is rejected. **This is the one I recommend fixing on `main` first, independent of the
NFT flags.**

### 2. `[NEW]` CRITICAL · GATED — Infinite GC faucet via repeated stake/claim on the same NFT
**`services/staking.py:62-96, 176-177, 207-210`.** ✅ cross-confirmed by two probes.
`claim_rewards` resets `nft.status = MINTED`; `create_lock` only rejects `STAKING`/`LISTED`; rewards
recompute `reward_pct * harvest.sale_value` fresh every cycle from a value that never decays. Stake →
wait cure → claim GC → re-stake same NFT → repeat forever. Uncapped currency printing, violates the
"every faucet has a sink" ledger invariant. **Fix (M):** mark a harvest/NFT as cured-once (or decay the
reward snapshot). Owner-gated (economy).

### 3. `[NEW]` CRITICAL · GATED — Harvest value double/triple-spend (sell + mint + stake same harvest)
**`services/game_service.py:1152-1197`, `services/minting_service.py:59-84`, `services/nft_mint.py`.**
✅ cross-confirmed by two probes. `mint_harvest` checks only `nft_status` + rarity; it never checks
`harvest.sold` (which `sell_harvest`/`start_cure` do). Sell a harvest for NPC-market GC, then mint the
same harvest into an NFT (carrying the stale `sale_value`), then list it for testnet ALGO *and* stake it
for a GC bonus. One item, three payouts — and the precondition that makes #2's rewards non-zero.
**Fix (S):** add a `harvest.sold` / already-monetized guard to the mint path. Owner-gated.

### 4. `[NEW]` CRITICAL · GATED — Wallet-address hijack (no key-ownership proof, address not unique)
**`services/game_service.py:264-267` + `db/models.py:49`.** ✅ verified.
`link_wallet` only checksum-validates an address before assigning it; `algorand_address` is `index=True`
but **not** `unique=True`. Marketplace ownership authorizes purely by `owner_address`/`seller_address`
string-equality (`marketplace.py:68`, `nft_api.py:99`), and listings (with `seller_address`) are readable
unauthenticated (`nft_api.py:150-152`). Player B reads a victim's public address off the listings feed,
links it to B's own account, and can then list/sell/drain the victim's NFTs. All authorization collapses
to a spoofable string. **Fix (M):** require a signed challenge before trusting a linked address as an
ownership credential, and/or add a uniqueness constraint. Owner-gated (auth + chain).

### 5. `[NEW]` HIGH · LIVE — Genome hover-popup feature (#160) is dead on touch
**`web/src/components/viz/Constellation.tsx:696-744`.** ✅ verified.
`onDown` sets `dragging = true` on *any* `pointerdown` (no `pointerType` check); the hover hit-test that
fires `onHoverNode` runs only in the `else if (!dragging)` branch. On touch, `pointerdown` always precedes
any `pointermove`, so the branch is unreachable and the card never shows. The only tap path
(`onClick → onSelect`) drives navigation, not the hover. Tapping any genome dot on GenBank, a strain DNA
tab, or the breed page on a phone does nothing — a whole feature shipped last week works only on a desktop
mouse, in a mobile-first product. Also a keyboard-a11y gap (canvas dots aren't focusable). **Fix (S–M):**
add a tap-to-reveal path (hit-test on `pointerup` without drag, or wire `onSelect`→reveal on touch).

### 6. `[NEW]` HIGH · LIVE — Zero error boundaries app-wide → any client error = dead white screen
**The finding is an ABSENCE (independently verified):** no error.tsx or global-error.tsx exists anywhere
under `web/src`, and no ErrorBoundary / componentDidCatch / getDerivedStateFromError exists in the tree
(confirmed by glob + grep returning nothing).
`INCIDENTS.md:90-112` documents a real occurrence (an `EventLog` `TypeError` blanked the whole page); the
"fix" only patched a mock fixture, leaving the architectural hole open. Any unhandled render exception →
Next's generic "Application error" with no recovery — the exact dead-end the AAA bar forbids. **Fix (S):**
add a root `web/src/app/error.tsx` (+ per-route boundaries for chamber/market/profile) with a reload CTA.

### 7. `[NEW]` HIGH · GATED — Staking authorizes off `Harvest.player_id`, not current NFT ownership
**`services/staking.py:72-76, 166-173`.** ✅ verified. A seller can keep staking and collecting rewards
on an NFT they already sold; the PR's own test (`tests/test_nft_marketplace.py:272-281`) *asserts* this as
intended. While staked, `marketplace.py:62-63` blocks the real (buyer) owner from reselling. Griefs the
buyer + pays the wrong player. Recorded only in the merge-commit prose — **not** in BACKLOG/ROADMAP.
**Fix (M):** authorize staking on `nft.owner_address`. Owner-gated.

### 8. `[NEW]` HIGH · GATED — `NFTAsset` missing `version_id_col` → duplicate-stake / double-sell races
**`db/models.py:882-900`.** ✅ verified. It's the one status-gated model lacking the optimistic-lock
column all four siblings have (`NFTListing`, `Wallet`, `Harvest`, `MarketListing`). Two concurrent
`create_lock` (or `create_listing`) calls both pass the status check-then-write → two claimable locks, or
one NFT sold to two buyers via two listings. **Fix (S):** add `version` + `version_id_col` to `NFTAsset`.
Owner-gated.

### 9. `[NEW]` HIGH · LIVE — #161 double-click guard reaches only 3 files; core economy buttons unguarded
**`web/src/hooks/useApiMutation.ts:26-61`.** ✅ verified. `useInFlightGuard` (the synchronous fix from
#161) is imported only in `ListingCard.tsx`, `store/page.tsx`, `lab/page.tsx`. Every other spend button —
Sell/Mint (`HarvestsPanel.tsx:65,69`), Growth Boost (`useCareActions.ts:118`), Breed/Stabilize
(`lab/breed/page.tsx:85,91`), NFT Buy/List/Stake/Claim (`nft/*`) — uses the unguarded
`useApiMutation`/`useMutation`, retaining the exact stale-render double-fire gap #161 diagnosed. **Fix
(M, altitude):** fold the synchronous guard into `useApiMutation` itself so every call site inherits it —
a deeper fix than hand-wiring 4 files. Backend re-checks blunt sell/mint but not the NFT actions.

### 10. `[NEW]` HIGH · LIVE — Chamber render loop allocates ~24 uncached gradients per frame
**`web/src/lib/chamber/chamberCore.ts` (24 gradient calls on the hot path; anchor `:261`).** ✅ verified.
`GrowChamber.tsx`'s ~30fps rAF loop rebuilds the whole scene every ~33ms; a flowering plant allocates
dozens-to-100+ gradient objects/frame → GC jank on mid/low-end phones. Same bug class already fixed for
landing particles (`Constellation.tsx`, sprite cache, `06c0e7c`); the chamber never got it. **Fix (M):**
pre-render gradient sprites once and blit. See also #16 (BACKLOG falsely claims this was done).

---

## Lower-severity findings (in the report, below the top 10)

- **11. `[NEW]` MED-HIGH · LIVE — CLIMATE micro-controls under the 44px touch floor.** Chamber `NudgeBtn`
  is `h-7 w-7` (28px), Quick-Boost chips `min-h-[36px]` (`chamber/page.tsx:107-129`, `ChamberDock.tsx:528`)
  — the same redesign uses `min-h-[44px]` for tabs/tiles, so the rule is known and applied inconsistently.
  Mis-tap hazard on a 390px phone. WCAG 2.5.5.
- **12. `[NEW]` HIGH (process) — `route-crash-sweep` never exercises the NFT surface.** The flags are OFF
  and nothing in `e2e/fixtures/mockGame.ts` / `playwright.config.ts` turns them on, so
  `MarketplaceBrowser`/`NFTCollection`/`CuringRoom` are never rendered by the crash net cited as a #162
  gate (`route-crash-sweep.spec.ts:17-47`). The safety net has zero coverage of the surface it was cited
  to protect.
- **13. `[NEW]` MED — NFT cards are `<div onClick>` with no role/tabIndex/focus ring**
  (`MarketplaceBrowser.tsx:84-92`, `NFTCollection.tsx:78-95`) — keyboard users can't select a listing.
- **14. `[NEW]` MED — NFT list-price entry uses `window.prompt` in raw microAlgos, unvalidated**
  (`NFTCollection.tsx:166-167`) — jarring native modal, alphabetic keyboard, no numeric validation, forces
  manual ALGO→µA conversion.
- **15. `[NEW]` MED — Staking ignores the per-player `Clock`** (`staking.py:79,115,180` use
  `datetime.utcnow()` directly) — cure timers can't be fast-forwarded by the dev/test `OffsetClock`, and a
  turbo player's plants advance up to 10× while their stake counts at 1× (`simulation/clock.py:94-134` is
  the documented single source of truth this bypasses).
- **16. `[NEW]` LOW-MED — `create_lock` doesn't validate `cure_target_hours`** (latent; not client-reachable
  yet — `nft_api.py:298-325` doesn't forward it) — sibling `start_cure` rejects `<= 0` and clamps to 336h;
  `create_lock` has no guard, so it'd accept a 0/negative value the moment the param is wired.
- **17. `[NEW, hypothesis]` LOW-MED — `breed()` requires no seed ownership/consumption of either parent**
  (`game_service.py:699-779`) — contrast `stabilize_strain`, which consumes an owned `SeedInventory` row.
  May be intentional (shared GenBank per `design/02-genetics.md:82`) — flagged for an owner decision.
- **18. `[NEW, inert]` LOW — `confirm_trade`/`fail_trade` don't check current trade status before mutating**
  (`marketplace.py:223-272`) — unreachable today (no route calls them; reconciliation step not built), but
  should be hardened before that ships.
- **19. `[NEW, hypothesis]` LOW — no-wallet NFT empty state is indistinguishable from "connected, 0 NFTs"**
  (`nft_api.py:88-90`, `NFTCollection.tsx:47-57`) — a fresh player's first mint dead-ends in a 403 toast
  instead of being steered to connect a wallet first.
- **20. `[NEW]` LOW — 7MB `grow-timelapse.mp4` autoplays with no `preload`/mobile variant**
  (`VideoHero.tsx:25-34`) — reduced-motion falls back to a poster, but the default path downloads 7MB on
  cellular. `public/buds/blue-dream-harvest.jpg` (308K) is the only other >200K static asset.

---

## AAA / App-Store bar

Concrete gaps between GROWv2 today and "a polished mobile game a reviewer would praise."

### App-Store review risk (submission-gating first)
- **`[NEW]` BLOCKER — No privacy policy anywhere in the app.** The logged-out waitlist collects **email +
  Algorand wallet address** (`web/src/lib/api/waitlist.ts:12-14`); profiles store email. Apple requires a
  privacy-policy URL for *any* data collection — this blocks submission outright. Cheap to fix (add a page
  + link), but mandatory before any native shell submission.
- **`[NEW]` MEDIUM-HIGH — Guideline 1.4.3 (drug reference).** Driven not by art (stylized/cartoon Canvas
  2D — a mitigant) but by **real strain names verbatim** (OG Kush, Sour Diesel, GSC, AK-47…,
  `data/strains.yaml:11-240`) + **explicit displayed THC%** (`types.ts:123,262,763`) across a full
  grow→sell loop. Pre-submission move: fictionalize strain names and abstract/drop THC%, or budget for a
  rejection/appeal cycle.
- **`[NEW]` HIGH (optics) — "Staking" naming + "earn bonus rewards" copy, no in-app disclosure.** The
  mechanic is *mechanically* clean (in-game GC only, no real money, no securities-like promise, no
  functional unlock, testnet-only, flags OFF) — but Apple 3.1.5(b) reviewers pattern-match the *word*
  "staking" and copy like *"Lock a harvest to earn bonus rewards!"* (`CuringRoom.tsx:42,164`) regardless of
  payout currency. Add an explicit in-product disclosure ("cosmetic in-game bonus, no real-world value, not
  an investment") and/or rename before submission. **This is the App-Store item to watch** given PR #162
  just merged it.
- **OK / no action:** NFTs unlock no functionality; no real-money/IAP-bypass commerce; no mainnet default
  (genesis-ID guard at `chain/algorand.py:159-167`, testnet default, `MockChainProvider` unless a treasury
  mnemonic is set); no analytics/tracking SDK; no native permission surface yet (no wrapper exists).

### Feel / juice (strengths worth preserving, then gaps)
- **Strong:** optimistic care-action feedback fires haptic + particle + zone reaction *before* the network
  call (`CareButtons.tsx:41-45`); reduced-motion coverage is disciplined and complete
  (`globals.css:724-764`); the trim "receipt" and genome hover-card entrance are genuine AAA touches.
- **`[PLANNED]` (Phase 9) — No stage-transition reveal.** A stage change tears down and rebuilds geometry
  instantly (`GrowChamber.tsx:100` `buildKey` includes `stage`) — an unannounced cut, no burst/glow.
  `playStageUnlock()` sound exists (`soundHooks.ts:72-77`) but is never called (dead code).
- **`[NEW]` — Harvest ceremony has no stat reveal at the moment of harvest** (`chamber/page.tsx:734-752`
  shows emoji + static copy, numbers only appear after clicking through to "Harvest review").
- **`[NEW]` — Squash/stretch bounce + trim juice is mounted on only 1 of 3 plant surfaces** (`usePlantBounce`
  only in `chamber/page.tsx`; the dashboard command-center and plant detail get the zone pulse but not the
  canvas bounce) — contradicts the design doc's own "mount anywhere a plant canvas + boosts coexist" rule.
- **`[NEW]` — Arcade sound ships effectively off** (`NEXT_PUBLIC_ARCADE_SOUND` defaults false).

### Onboarding — first 90 seconds
- **Strong:** ~5 taps + one text field to a real "my plant reacted" moment (~30–60s); **no blocking
  wallet-connect** in the critical path (username/API-key only) — a real strength to preserve.
- **`[NEW]` — Untested infinite-spinner dead-end:** `ftue/page.tsx:100` has no `isError`/retry branch, so a
  failed `GET /ftue/status` for a brand-new player spins forever with no recovery.
- **`[NEW]` — No genetics/rarity hook in the actual first session:** the "heritable genome" pitch is
  landing-page copy; the FTUE starter plant is generic (no rarity/strain/mutation shown), so the game's
  differentiator isn't *felt* until well past the first 90 seconds.
- **`[PLANNED]` (Phase 18) — owner already flagged onboarding "way too long"** (`HeroSection.tsx:53`);
  roadmap lists "finish onboarding/FTUE" as open MVP scope.

### Failure-state grace
- **Graceful:** plant death has a dedicated non-punishing overlay + cleanup recovery path
  (`PodCommandCenter.tsx:349-427`). Network errors become a clean `ApiError` toast (`client.ts:99-106`).
- **Gap:** death overlay shows *what* but not *why* — no post-mortem cause-of-death (the advisor can
  diagnose a *live* plant only).
- **`[NEW]` ABSENT — no pre-flight balance check** before buy/mint/stake (`MarketplaceBrowser.tsx:143-150`
  disables only on `!playerId`, never price-vs-balance) → "you need X" is whatever the backend error string
  says, surfaced generically. Plus the zero-error-boundary hole (#6).

### Low-end phone performance
- The chamber per-frame gradient allocation (#10) is the headline. Good practices already present: dpr
  capped at 2, `IntersectionObserver` pauses the rAF loop offscreen, reduced-motion skips it entirely;
  `three`/wallet SDKs are code-split. The 7MB autoplay hero video (#20) is the other concrete hit.

---

## Roadmap / memory reconciliation `[ROADMAP-WRONG]`

Re-verified against code (the PR #157 review already found the gap-list had fabricated/mis-scoped items;
these are *additional* drifts introduced by #159–#162 landing after the docs froze):

1. **`ROADMAP.md:159` "engine purity preserved (no DB imports in `simulation/`)" is factually false.**
   `simulation/engine.py:18` imports `db.models`; `catch_up()` reads/writes a live session;
   `simulation/curing.py:18` imports `EconomyConfig`. *Nuance (verifier):* the ARCHITECTURE_TRUTH:28 line
   "No player-scoped economy logic inside" is **defensible** (the engine holds no player economy logic) —
   only the roadmap's literal "no DB imports" parenthetical is wrong. Fix the roadmap wording; leave the
   truth-doc line.
2. **Test/coverage/endpoint counts have drifted again.** #162's own CI reported **1163 tests / 91.44%
   cov** and **22** `@require_idempotency` endpoints, vs. the docs' 1140 / 93.64% / 18
   (`ARCHITECTURE_TRUTH.md:20,142,169`).
3. **Phase 9 (genetics lineage UI) is partially shipped by #160** — `GeneHoverCard` now shows
   rarity/gen/verify-badge/lineage; still open: the reveal *animation* + Genetics Advisor. And
   ARCHITECTURE_TRUTH's "web settlement incomplete" gap item is resolved by #162 (UI exists, flagged off).
4. **`BACKLOG.md:472` inaccurately claims the chamber per-frame-gradient cost was "fixed with sprite
   caching."** `git log --grep=sprite` shows only the `Constellation.tsx` fix (`06c0e7c`); `chamberCore.ts`
   never got it (see #10). Correct the BACKLOG line.
5. **Not stale (verified still open):** Phase 3 mood-layer / mutation-rarity chamber visuals — no `mood`
   code exists post-#159; correctly `[PLANNED]`. And the `/mission` gap-list entry is **accurate** (it is
   an admin ops board, not a player mission system) — not wrong, flagged only so it isn't re-litigated.

---

## What I did NOT do (and why)

- **No code changed.** This is a read-only sweep; the deliverable is this report + a draft PR for owner
  review, per the standing "do not merge or push without owner review" instruction.
- **No protected-surface edits.** Findings #1–#4, #7, #8, #15, #16 touch `services/` economy/staking, auth
  (`link_wallet`), and `db/models.py` — all owner-gated. They are reported with recommended fixes and
  effort estimates; applying any of them needs the Security-Reviewer checklist + testnet click-test.
- **No flag flips.** The recommendation is explicitly to keep `nft_marketplace`/`nft_staking` OFF until
  #2–#8 are fixed.

## Suggested next moves (owner decides)

1. **Fix #1 (harvest gate) on `main` now** — it's live, S-effort, core (not economy-tuning), and provable
   green with one test. This is the one I'd act on first if you say go.
2. **Fix #6 (root error boundary) + #5 (touch tap-to-reveal)** — live UX/resilience, S–M, non-protected
   frontend, safe to do without the economy checklist.
3. **Batch the NFT economy fixes (#2, #3, #4, #7, #8) into one owner-reviewed security PR** before the flag
   is ever enabled — these are the Security-Reviewer-gated set.
4. **Before any App-Store submission:** add a privacy policy (#BLOCKER), disclose/rename "staking",
   fictionalize strains + abstract THC% (1.4.3).
