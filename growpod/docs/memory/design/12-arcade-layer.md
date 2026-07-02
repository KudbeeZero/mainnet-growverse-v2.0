# 12 — Arcade Layer on the Plant Simulator (+ Control Panel map)

> Owner directive (2026-07-02): a FUN, skill-based, **non-gambling**, educational arcade layer of
> fast replayable mini-games ON TOP of the scientific plant sim. The photorealistic simulation
> stays the authoritative core; the arcade only touches **cosmetic visuals + separate arcade
> scores**, never plant health / economy / genetics truth. This doc = the recon map (control
> panel + existing arcade foundation) + the per-game hook map + build order. Composes existing
> systems; nothing here overhauls the sim.

## A. Control panel (Pod Command Center) — layout map

Mount: `web/src/app/dashboard/page.tsx` → `<PodCommandCenter>` (the old
`/dashboard/plants/[id]/command` route now just redirects to `/dashboard`).
Hub: `web/src/components/command/PodCommandCenter.tsx`. `CommandTopBar.tsx`/`CommandFooter.tsx`
exist but are unmounted (legacy — free chrome if an arcade top/bottom bar is wanted).

- **Header band:** FleetCounters + ConnectivityBadge (left) · HeroStatChips (right, xl+) ·
  StageHeader + StageProgressBar (centered).
- **3-rail grid** `xl:grid-cols-[320px_1fr_340px]`; collapses to one column below xl with the
  CENTER column first in DOM (leads on mobile).
  - **Left rail:** `PlantDnaRail` (strain identity / trait bars / morphology).
  - **Center:** PlantCarousel → seed-slot strip → **chamber viewport** (GrowChamber 2D **or**
    BudGL 3D, toggled, `hasWebGL()`-gated; cosmetic glass overlays; PodStatusTag; health meter)
    → TimeControls → GrowthScrubber → StageInfoCard → NextActionHint → CareDeck
    (Water/Feed/Prune/Train/Boost via `useCareActions`).
  - **Right rail:** EnvironmentRail (climate sliders + optimal bands) · GrowConsole (read-only
    university targets — never writes to the sim).
- **Data flow:** reads `usePlantState` (authoritative compute-on-read), `useStrainMap/usePods/
  usePlantsList`; render derivation centralized in `web/src/lib/plantRender.ts`. Writes: debounced
  `setEnvironment`, care mutations, paid `growthBoost` (chamber route only).

**Arcade plug-in points (non-disruptive):** (1) chamber-canvas overlay — the viewport already
layers absolute children; precedent: the chamber route mounts `ArcadeHUD` + `NutrientPop` there.
(2) a right-rail `CollapsiblePanel` "🎮 ARCADE" launcher. (3) a CareDeck tile / center strip.
(4) a `fixed inset-0 z-40` takeover (chamber route shows the pattern).

## B. Existing arcade foundation (PR #100 — extend, don't duplicate)

- `web/src/lib/arcade/boostEngine.ts` — Zustand store, 4 timed **purely-visual** grow-speed
  boosts; emits `growpod:boost-applied`; "no DB writes, no API calls, no localStorage." THE
  contract template every mini-game copies.
- `web/src/lib/arcade/timeRewind.ts` — circular buffer of the 5 bud scalars
  (`budDev/ripe/brown/trich/purple`), overrides the live scalars fed to BudGL; never touches
  server/chain.
- `web/src/components/arcade/` — `ArcadeHUD` (boost buttons + rewind), `NutrientPop` (CSS-only
  FX), `WalletConnect`, `ChainRow`. Mounted ONLY on the chamber route today; NOT in the command
  center yet. No `arcade` feature flag exists (add one).
- **Receipts machinery** `web/src/lib/chain/algorand/` — `growEvents.ts` is the receipts engine:
  zero-value pay-to-self txns w/ `"gpe:"` JSON notes, in-memory queue + batch flush + simulate
  mode; typed events (BOOST/STAGE/HARVEST/DISCOVERY/REWIND). `client.ts` `isSimulate()` (default
  ON — never real txns unless disarmed). Transport is DONE + generic. Missing for arcade:
  `ARCADE_SCORE`/`MUTATION_UNLOCK` event types, a local score store, an `arcade` flag.

## C. Per-mini-game hook map (cosmetic channel = the 5 bud scalars + BudDNA)

1. **Trichome Rush → ✅ SHIPPED 2026-07-02** (`web/src/lib/arcade/trichomeRush.ts` + `web/src/components/arcade/TrichomeRush.tsx`; ArcadeHUD launcher; `arcade` feature flag; `ARCADE_SCORE` growEvents type). Score→frost-reward is emitted via a `growpod:trichome-rush-result` CustomEvent — NOT YET wired into chamberCore/BudGL/PlantGL live rendering (follow-up integration, not a gap in this shipment). Original hook plan below for reference.
   → `BudDNA.trichomeDensity` + `trich` scalar + `buildFrost()`
   (`chamber/bud3d/detail.ts`); seed difficulty from real `plant.trichomes` telemetry. Resin
   Combo = bounded cosmetic `trich`/`highlightBoost` offset (boostOffset pattern). **Build first**
   (smallest surface, proves score→receipt→cosmetic loop).
   **The trichome layer IS the mechanic (owner spec 2026-07-02):** build a dedicated
   `TrichomeLayer` (GPU-instanced capitate-stalked trichomes — tiny stalk capsule + gland-ball
   micro-sphere, angled along the bud surface normal, density-mapped to bracts/sugar-leaves by
   `trichomeDensity`, per-instance height/tilt/scale/opacity/sparkle jitter). LOD: CLOSE = real
   stalk+gland meshes (~2–8k instances); MID = point/frost highlights + normal-map sparkle
   (~0.5–2k); FAR/mobile = shader frost only (noise + light-catching material + baked normal).
   Because glands are individually addressable instances, Trichome Rush makes some gland heads
   glow → player collects → frost intensity rises: ONE system = photoreal frost + gameplay. Used
   by PlantGL (3D whole-plant); keep BudGL's `buildFrost` working alongside.
2. **Terpene Combo** → strain terpene data exists end-to-end (`Strain.terpenes`, backend
   `effects_service`); orb colors already authored in `web/src/lib/terpenes.ts`. Aura = new
   cosmetic overlay (NutrientPop CSS pattern / BudGL glow). Read light as beat source; never
   write `setEnvironment`.
3. **Pest Invader** → read `plant.condition_flags`/`pest_level`; theme waves via
   `web/src/lib/conditionVisuals.ts`. Outcomes COSMETIC only — never call `treatPests` or alter
   pest_level (real treatment stays the paid care action).
4. **Lightwave Rhythm** → light already drives visuals (`applyEnvironmentToBudDNA`
   highlightBoost); photosynthesis score is a new local field; read committed light, don't write.
5. **Cola Builder** → the plant3d 7-layer asset (`web/src/lib/plant3d/` skeleton/leaves/assembly
   → reuses `bud3d/cola.ts`+`detail.ts`): stem→nodes→bracts→sugar-leaves→pistils→trichomes is
   exactly what the game assembles; structure score maps to per-layer instance counts. Blocked on
   plant3d stabilizing.
6. **Mutation Events** (meta-layer) → cosmetic overrides via a NEW `applyArcadeCosmetics(budDna,
   budColor, unlocks)` step layered AFTER `plantRender()` (like `applyEnvironmentToBudDNA`):
   Blue Frost = the sageTeal/frostBlue palette; Golden Pistils = pistil hue; Diamond Trichomes =
   highlightBoost+frost; Dense Cola Stack = rows/overlap/maxBudWidth multipliers; Terpene Aura =
   the Terpene overlay. **NEVER** touch strain records, breeding, `genotypeCodec` traits, or the
   on-chain `mutationFlags` byte — cosmetic unlocks are a separate client decoration + separate
   receipt events.

## Invariant guardrails (the boundary, in code)

- `CLAUDE.md`: sim engine is pure + server-authoritative; DB authoritative, chain is a mirror.
- `arcade/boostEngine.ts` + `timeRewind.ts` header contracts: purely visual, no DB/API/chain
  writes — the template every game module copies.
- `chain/algorand/client.ts`: "Nothing here gates gameplay — best-effort."
- **Economy collision to avoid:** the arcade's free visual "boost" must never call the REAL
  `api.plants.boost` (care) or `api.plants.growthBoost` (costs 60 GROW). `balance.yaml` is a
  protected surface.
- Arcade scores live in a NEW client store (zustand + localStorage OK — not economy); receipts
  optional, always behind `isSimulate()`/`isAlgoEnabled()`.

## Build order

1. Foundations: `arcade` FeatureName; `arcade/scoreStore.ts` (scores + cosmetic-unlock registry);
   `applyArcadeCosmetics()` after `plantRender()`; extend `GrowEventType` + tests.
2. Trichome Rush → 3. Terpene Combo → 4. Pest Invader → 5. Lightwave Rhythm →
   6. Cola Builder (after plant3d stable) → 7. Mutation Events (meta-layer).
3. Surface via right-rail "ARCADE" CollapsiblePanel launcher + chamber-canvas gameplay overlay.

## What must NOT drift

- Arcade affects COSMETIC visuals + separate arcade scores ONLY — never health/economy/genetics.
- Every mini-game module copies the boostEngine "no DB/API/chain writes" contract.
- Receipts are best-effort, simulate-default; scores are not currency.
