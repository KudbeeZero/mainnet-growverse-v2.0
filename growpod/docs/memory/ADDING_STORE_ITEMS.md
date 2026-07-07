# Adding a store item — the checklist (Layer 3, process)

> **Why this exists.** Every past store-item defect in this codebase (S3: fans/soils were pure
> GROW sinks with zero sim hook for months; S4: the chamber never showed equipped gear; E1: CO₂
> was a decorative sensor) had the SAME root cause: the catalog entry, the purchase route, and the
> UI listing all shipped — but the *gameplay effect* step (§7 below) was skipped, silently, because
> nothing forced it onto a checklist. This doc is that checklist. Follow it top to bottom for any
> new item; skipping §7 or §8 is exactly how the next S3 happens.
>
> **Template source:** the `gv-o01`/`gv-o02`/`gv-o03` PRs (2026-07-07) — fans/soils/CO₂ going from
> catalog-only to fully wired in one week. Every file:line citation below is a real, merged
> pattern to copy, not a hypothetical.

## 1. `balance.yaml` entry

- **Consumable** — add under `shop.consumables.<key>`: `name`, `cost`, `effects: {...}` (only
  keys `apply_consumable` already clamps: `water_set`, `nutrient_set`, `pest_set`, `disease_set`,
  `health_add` — a genuinely new key is a *separate* §7 change, not free), optional `stage_req`,
  `description`. Template: `data/balance.yaml:423-438`.
- **Gear (light/fan/soil/new category)** — add under `shop.gear.<category>.<key>`: `name`,
  `category`, `cost`, `image` (filename under `web/public/store/gear/`), `description`, `specs`
  (display-only), and — **the step every past defect skipped** — an `effects` block using only
  keys `simulation/gear.py`'s `GearEffects` dataclass already declares (`temp_offset_c`,
  `humidity_offset_pct`, `pest_spawn_mult`, `disease_growth_mult`, `water_decay_mult`,
  `nutrient_decay_mult`, `flowering_quality_bonus`). Template: `data/balance.yaml:476-517`. A
  category with **no** `effects` block is a legal no-op (this is how lights, and any purely
  cosmetic category, behave) — but if the item is supposed to *do* something, this block is
  non-optional.
- **Bundle / Partner / Seasonal strain** — these are DB rows, not `balance.yaml`. Add via the
  existing admin seed pattern (`db/seed.py:102-190`) or the admin API (`POST
  /admin/store/partners`, `/admin/seasonal/strains`, or a `Bundle` insert). Match the existing
  components/discount shape exactly — don't invent a new pricing formula.
- **Owner gate:** any new/changed *number* in `balance.yaml` is a protected surface
  (`docs/BUILD_RULES.md`) — record the owner sign-off in the PR (same D7-style gate the gear
  effects PR used).

## 2. Backend service method

Pick the verb that matches the category — acquisition (`buy_*`/`purchase_*`, a GROW sink),
durable equip state (`equip_*`/`unequip_*`), and one-shot use (`apply_*`) are three different
things; don't conflate them.

- **Gear:** reuse `GameService.equip_gear`/`unequip_gear` (`services/game_service.py:658-731`) —
  it is already category-generic (`item.get("category", "gear")`, no hardcoded whitelist), so a
  **brand-new gear category needs no new service method**, just a new catalog entry.
- **Consumable:** reuse `SimulationService.apply_consumable` (`services/simulation_service.py:
  394-440`). If the item needs an effect key that doesn't exist yet, add it here, in the same PR
  — not as a "later" follow-up.
- **A genuinely new mechanism** (not gear/consumable/bundle/partner/seasonal) needs a new
  dataclass field or service method — scope that as its own PR, not folded into a catalog add.

## 3. API route + Idempotency-Key

Buy routes already exist per category (`/players/<id>/store/gear/<key>/purchase`,
`/players/<id>/shop` for consumables, `/players/<id>/store/bundles/<id>/purchase`,
`/players/<id>/store/partners/<id>/purchase`, `/players/<id>/seasonal/strains/<id>/purchase`) — a
new catalog SKU rides the existing route, **no new route needed**.

A genuinely new mechanism (new equip verb, new claim flow) needs a new route — follow `POST
/players/<pid>/pods/<pod>/equip-gear` / `unequip-gear` (`api/game_api.py:2317-2350`) as the
template: Idempotency-Key header handling, `@require_player`/`@require_feature` decorators,
`_error()` helper for 4xx.

## 4. Web TS type + API client function

Extend the relevant interface in `web/src/lib/api/store.ts`: `GearItem`/`GearEffects` (`:69-90`)
for gear, `ConsumableItem` (`:56-63`) for consumables, `StoreBundle`/`BundleComponent` (`:35-51`)
for bundles, `StorePartner` (`:3-14`) for partners.

**If adding a new category value** (e.g. a cosmetic `pot`/`decor` gear category), widen the closed
union in **both** places or it silently breaks — these two have drifted independently before:
- `GearCategory` in `web/src/lib/api/store.ts:65`
- `PodEquippedGear["category"]` in `web/src/lib/types.ts:168`

Add/extend the client function in `store.ts`'s `store` object (`:92-173`) following the existing
`equipGear`/`purchaseGear` shape — one function per verb, not per SKU.

## 5. UI catalog listing

- **Gear:** `GearPanel.tsx` groups by category via a hardcoded `categories` array plus
  `GEAR_ICONS`/`GEAR_LABELS` maps (`:8-18,30`) — a new category needs an entry in **all three** or
  it renders invisibly even though the backend/type work is done. This exact silent-drop pattern
  is what made fans/soils invisible for months (S3/S4) — don't repeat it.
- **Consumables/bundles/partners:** `web/src/app/store/page.tsx`'s section components
  (`BundleCard`, `PartnerCard`, the featured-shelf merge logic) — add the new SKU to whichever
  section's data source already serves it; a genuinely new section needs its own `SectionHeader`
  block following the existing pattern (`:281`).

## 6. Purchase/equip/apply UI flow + query invalidation

Every mutation must invalidate **all three** of: the owned-inventory query (seeds/gear
list/consumables), `player` (GC balance shown elsewhere), and `wallet` — copy the pattern at
`store/page.tsx:128-130` (seasonal branch) and `:138-139` (consumable branch, fixed 2026-07-07
after S2). Missing even one of these three query keys is exactly how GC balances went stale
before.

If the item can appear on the featured/seasonal shelf, also invalidate
`queryKeys.storeFeatured()` (`:155`, the S7 fix) so the shelf doesn't show stale owned/pinned
state after purchase.

Guard the buy button against double-clicks/in-flight duplicate submits (`useInFlightGuard`,
already used elsewhere in the store).

## 7. The gameplay-effect wiring — the step every past defect skipped

Pick exactly one:

- **Sim-engine hook (gear categories):** consume the new `effects` key inside
  `simulation/engine.py`'s existing env/pest/disease/decay terms (`:177-192, 262-302`) via
  `simulation/gear.py:effects_for` — this function is the single merge point. A brand-new effect
  key needs one new field on `GearEffects` (`:27-42`) plus one new consumption line in
  `engine.py`, not a parallel system.
- **Direct plant-state hook (consumables):** add the new effect key to
  `SimulationService.apply_consumable`'s clamp block (`services/simulation_service.py:426-435`).
- **Harvest-time hook** (e.g. `flowering_quality_bonus`): confirm the quality/pricing pipeline
  (`simulation/pricing.py`, `services/game_service.py`'s `harvest_plant`) already reads it —
  soils' `flowering_quality_bonus` is the existing template.
- **Serializer exposure (mandatory if the web needs to render the effect):** expose it through
  `api/serialize.py`'s `pod_dict`/`_pod_gear()` (`:88-142`) — this is the one function that turns
  "backend has the data" into "the web can render it." Skipping this is how a backend-complete
  feature still looks catalog-only to players.
- **Chamber visual (if the category should be visible):** add a mapping function in
  `web/src/lib/chamber/gearVisuals.ts` (follow `fanVisualIntensity`/`soilTint`, `:15-52`) — note
  `gearChips()` (`:75-81`) already renders *any* category generically via an icon fallback, so a
  purely cosmetic item gets a free chip with zero code here; only SKU-specific visuals (tint,
  sway) need a new mapping table.
- **Cosmetic-only items are legitimate** and need none of the sim-engine/serializer-effect
  substeps above — but still need the type-union widening in §4, or they silently fail to render
  (same trap as S3/S4, just on the frontend side).

## 8. Tests required at each layer

- **Pure sim unit test:** determinism + bounds test for the new effect key — follow
  `tests/test_gear_effects.py`/`tests/test_gear.py`.
- **Engine integration test:** a both-signs assertion (the item helps in one condition, hurts in
  another) if it's an offset/mult — follow the "humid+fan / dry+fan" scenario in
  `docs/audits/2026-07-07-gv-o02-gear-effects-sim-report.md` and `tests/test_gear_engine_effects.py`.
- **No-op parity test:** confirm `tests/test_engine_parity.py` still passes with the new item
  *unequipped* — nothing changes for players who don't buy it.
- **Backend route test:** buy/equip/apply happy path + the "don't own it" / "wrong stage" error
  paths.
- **Web unit test:** the `gearEffectsData.test.ts`/`gearVisuals.test.ts` pattern for any new
  formatting/visual mapping function.
- **Web component/e2e coverage:** GearPanel or `/store` rendering the new SKU/category — there is
  a documented, standing gap here (C11/S-series: "no store e2e tests exist at all"). Don't
  compound it; add at minimum a capture-shots verification (see §9) even if a full component test
  isn't written.

## 9. Memory/docs update

- Tick `docs/memory/BACKLOG.md` (the item's line, with a one-line "shipped" note + PR reference —
  follow the exact format at `BACKLOG.md:4-27`).
- If the item has a visual/chamber component, add a `VERIFIED_RENDERS.md` row via the
  `capture-shots` skill (follow `VER-016`'s format, `docs/memory/VERIFIED_RENDERS.md:37`) —
  golden before/after screenshots, regen recipe included.
- If it ticks an audit defect ID, tick it in `AUDIT_NFT_STORE_LOOP.md` in the same PR.
- If it introduces a new `balance.yaml` number, record the owner-gate decision in
  `docs/memory/DECISIONS.md` (D7-style entry).

## Known cross-cutting gaps to widen carefully, not casually

Two closed type unions have already drifted out of sync once — treat both as a matched pair,
never edit one without the other:

- `GearCategory` (`web/src/lib/api/store.ts:65`) and `PodEquippedGear["category"]`
  (`web/src/lib/types.ts:168`) — both `"light" | "fan" | "soil"` today. A cosmetic category (pot,
  wall decor) needs both widened together.
- `BundleComponent.type` (`web/src/lib/api/store.ts:35-41`) is `"consumable"`-only today; bundling
  in a gear SKU needs this widened AND `_bundle_full_price` (`api/game_api.py:2095-2134`) taught
  to price a gear item — confirm it handles that before shipping a gear-inclusive bundle.
- `StorePartner.product_type` (`store.ts:8`, `db/models.py`) is `"strain" | "consumable"`-only —
  selling gear through a partner drop needs the same type widening plus a
  `purchase_partner_product` (`api/game_api.py:2232-2262`) update.
