# Macro Bud Rules

> Canonical rules for the **Detailed Bud View** (`GrowChamber`, `view="macro"`).
> See `botanical-bible.md`. Generator is measurement-driven from `BudDNA`.

## Pipeline
`BudSeed → Cola Spine → Nodes → Calyx Clusters → Golden Angle → Pistils →
Sugar Leaves → Trichomes → Phenotype Colours → Final Render`

## Cola silhouette
- Rows along the spine; per-row width = `sin(progress^k · π) · maxBudWidth`.
- `progress = row / (rows−1)` (0 top → 1 bottom): **narrow top, wide center,
  tapered base**. `k ≥ 1` (indica) pushes the widest point lower (heavier base).

## Placement — concentric ring packing (not independent blobs)
- Calyxes are packed in **rings** around the spine, one ring per spine segment
  (`nRings ≈ rows·1.25`). Each ring is a circumference at that height.
- Per-ring radius = `sin(progress^k·π)·budW/2`; per-ring **count** peaks in the
  middle (`round(widthCurve · calyxPerRowMax)`, e.g. 1·3·5·8·5·3) → narrow top,
  wide centre, tapered base.
- Around the ring: `angle = i·(360/count)` + a **golden-angle (137.5°) twist per
  ring** so rings never column up + a **half-step brick offset** so each calyx
  nests in the previous ring's gap (pinecone / sunflower / dragon-scale packing).
- **Depth comes from the ring angle**: `cos(angle)` → horizontal offset across the
  silhouette, `(sin(angle)+1)/2` → back↔front, so calyxes wrap around the cola.
- **Organic noise** keeps it natural: angle ±8°, radius ±6%, rotation ±25°,
  scale ±15%. No perfect spacing or symmetry.

## Layering (painter's algorithm, back → front)
- Each calyx carries a `depth` (0 back … 1 front): back = darker/smaller/lower
  opacity, front = brighter with highlights.
- Draw order: dark cola core → back calyxes → **sugar leaves** → front calyxes →
  pistils → trichome frost → frost bloom.

## Calyx rendering
- Shape mix teardrop/oval/pointed/foxtail; **height > width**, pointed tip.
- Per calyx: body fill, **outer-rim edge shadow** (overlap/ambient occlusion),
  **center vein**, **2 mirrored side ridges**, **surface speckles**, a thin
  **sliver highlight** (never a flat circle), and **micro-fuzz** on front calyxes.
- **Overlap target 60–75%.**

## Pistils & trichomes
- Pistils: thin, strongly curved, irregular, from between calyxes; reveal with
  `budDev`.
- Trichomes: additive (`lighter`) soft specks that build into **frost patches**;
  each is anchored to a host calyx and only drawn once that calyx is revealed.

## Performance
- Backdrop bokeh + framing leaves are precomputed once per build (gradients
  reused). Macro geometry omits `day` from the rebuild key; it rebuilds only on a
  coarse `BudDNA` signature change (env shift), not every frame.
- **Known follow-up:** the strain-profile hero runs the macro RAF loop while
  visible; offscreen-cache + IntersectionObserver gating is the planned perf step
  before heavy texture scales further.

## Implementation
`web/src/components/viz/GrowChamber.tsx` — `buildMacro()`, `drawMacro()`, `calyxPath()`.
