# Plant Anatomy Reference

> Part of the canonical knowledge base (see `botanical-bible.md`). The anatomy the
> macro bud renderer must reproduce. No circles; everything has structure.

## Calyx (bract) — the main building block
- **Teardrop / spear** shaped with a **pointed tip**; height is always **greater
  than width**.
- A **center seam / vein** runs from the swollen base to the tip.
- **2–4 side ridge lines (vertebrae)** curve up toward the tip.
- **Swollen base**, attaches to a bract; protects the ovule/immature seed.
- Surface carries **trichome frost** and fine **micro-noise / speckles**.
- Shape variations (all share the same structure):
  - **Teardrop** (~40%) — classic, most common.
  - **Oval / fat** (~25–30%) — rounder, common in indica.
  - **Spear / pointed** (~20%) — longer, more pointed.
  - **Foxtail** (~10–15%) — elongated new growth; rises under light stress.

## Pistils (stigma hairs)
- **Thin, curved/curly, irregular**; emerge from **between** calyxes across the
  whole cola — not only the top.
- Age/colour progression: **white → cream → orange → amber → pink/brown**
  (driven by ripeness + browning; the warm-vs-magenta bias is authored per strain).

## Trichomes (resin glands)
- Read as a **fuzzy frost coating / patches**, not discrete white snow dots.
- Maturity colour: **clear → cloudy white (dominant frost) → amber**.
- Density is a strain trait (`trichomeDensity`) and rises with high UV.

## Sugar leaves
- Small leaves protruding from the cola; break up the silhouette so it doesn't
  read as a single blob. Kept green.

## Cola spine & nodes
- An **invisible vertical spine** controls the bud shape.
- Calyx clusters, pistils and sugar leaves anchor to **nodes** along the spine;
  the highest nodes form the largest mass (the cola).

## Implementation
`web/src/components/viz/GrowChamber.tsx` — `calyxPath()` (shape paths), `drawMacro()`
(vein/ridge/speckle/edge-shadow/fuzz, pistils, frost). Reference infographic:
the owner's "Calyx Shape Breakdown" poster.
