# Procedural Generation

> The end-to-end procedural model + determinism rules. See `botanical-bible.md`.

## Determinism (hard rule)
- All generation is seeded so the **same strain / plant id always renders the same
  bud**. PRNG is `mulberry32` and seeds come from `seedForPlant(id)` (FNV-1a) — see
  `web/src/lib/chamber/morphology.ts`. Never use `Math.random()` in generation.
- Pure, DOM-free logic lives in `morphology.ts` / `budDna.ts` / `strainVisuals.ts`
  (unit-testable). Canvas drawing lives in `GrowChamber.tsx`.

## Pipeline (macro bud)
```
BudSeed
  → resolve BudDNA (authored preset or derived; + environment modifiers)
  → cola spine + ring layout (sin(progress·π) silhouette; rings per segment)
  → concentric ring packing: per-ring count peaks mid; golden-angle twist per
    ring + half-step brick offset (nest in gaps); depth from ring angle; shape
    mix + palette colour; organic noise (±8°/±6%/±25°/±15%)
  → pistils (per-calyx spawn, thin/curly, between calyxes)
  → sugar leaves (woven between back/front layers)
  → trichomes (density-scaled, anchored to host calyxes)
  → render (core → back → sugar → front → pistils → frost → bloom)
```

## Build vs draw split
- **Build** (`buildMacro`, runs on a structural-change key): generates geometry +
  resolves per-calyx colour from the palette; precomputes the static backdrop
  (bokeh gradients, framing leaves).
- **Draw** (`drawMacro`, per frame): paints the precomputed geometry, applies the
  gentle sway, reveals calyxes/pistils/frost with `budDev`/`ripe`/`trich`.
- The rebuild key includes a coarse `BudDNA` signature (so env shifts re-render)
  but **excludes `day`** in macro view (so scrubbing the growth slider doesn't
  rebuild identical geometry every frame).

## Extending
- New strain look → add/adjust a `BudDNA` preset in `budDna.ts` (numbers, not
  shapes). New calyx shape → extend `calyxPath` + the shape-mix weights.
- New environmental reaction → extend `applyEnvironmentToBudDNA` + consume the new
  field in `buildMacro`/`drawMacro`.
- Planned perf step before scaling texture: render the bud to an offscreen canvas
  keyed on (DNA signature + dev bucket) and blit with the sway each frame; gate the
  RAF loop on visibility (IntersectionObserver) for the always-mounted hero.
