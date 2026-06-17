# Whole Plant Architecture (NEXT PHASE — primary focus)

> Canonical spec for the **Whole Plant View** — the system the player spends most
> time with: Grow Chamber → Whole Plant → Growth Animation → Flowering → Harvest.
> Status: **planned / partial.** The chamber already renders a DNA-influenced
> plant (`GrowChamber.tsx` `view="chamber"`, `buildPlant`/`drawPlant`, driven by
> `morphology.ts`); this doc is the target architecture to grow it into.

## Positioning
The Macro Bud View is **done and no longer blocks launch.** It becomes an
optional **Detailed / Collector / NFT-gallery / inspection** mode. The Whole
Plant is now the emotional core — the plant must feel **alive, beautiful,
recognizable, personal, valuable**. The player should get attached to *their*
plant and recognize a strain by silhouette alone.

## PlantDNA (drive everything from this)
`internodeLength · branchAngle · apicalDominance · nodeCount · stretchFactor ·
branchFlex · budWeight · leafFingerCount · leafWidth · leafLength · serrationDepth ·
leafDroop · leafColor · purpleExpression · trichomeDensity · calyxDensity ·
foxtailChance · flowerDensity`
- Derive each from the strain genome where possible (see `genetics-system.md`),
  so bred strains get a unique, believable plant automatically.

## Silhouette system (recognizable per strain)
- **G13:** slim, spear/Christmas-tree, tighter nodes, medium stretch.
- **Purple Diddy Punch:** short, wide, chunky, heavy buds, strong lateral branching.
- **Animal Mints:** medium height, dense stacking, golf-ball clusters, frosty.

## Core variables
- **Internode** `6–40px` — short = bushy/indica, long = tall/airy/sativa. (Highest-impact silhouette knob.)
- **Branch angle** `35–90°` — 45 bushy · 60 balanced · 75 Christmas-tree · 90 wide.
- **Apical dominance** `0–100` — high = single cola, low = multiple tops.
- **Phyllotaxy** — young = opposite nodes; mature = spiral via golden angle 137.5077°
  (drives leaf, branch, and bud placement).
- **Stretch** — flower-transition animation, `stretchFactor` per strain (wk1 1.0×
  → wk4 ~3.0×); some barely stretch, some explode upward.
- **Branch weight** — `branchFlex + budWeight` → branches droop/bend as buds fill;
  no rigid branches.
- **Leaf morphology** — `leafFingerCount 5–11`, `leafWidth`, `leafLength`,
  `serrationDepth`; indica wide/dark, sativa thin/long/light, hybrid between.

## Environmental reactions (extend §11 to the whole plant)
High light → compact · low light → stretch · cool nights → purple · high UV →
frost · strong airflow → thicker stems · high humidity → moldRisk · temp swings →
colour expression.

## Motion
- **Airflow:** delayed physics, not random wiggle — top moves first, middle
  follows, bottom last (`windForce · branchFlex · leafFlex · budWeight`).
- **Circadian:** lights-on leaves pray upward, lights-off droop slightly. Subtle.

## Performance (now that rendering is heavy)
Offscreen-canvas cache · LOD · visibility culling · sprite batching · freeze
updates when the tab is hidden / chamber not visible / plant offscreen.

## State — single source of truth
`GameState · PlantState · EnvironmentState · UIState · BudState`, wired to the
Dashboard, Control Panel, Chamber UI, Growth Timeline, Environment sliders, Plant
Statistics, DNA Viewer, Plant Inspector.

## Launch loop (MVP only — resist feature creep)
`Seed → Veg → Flower → Harvest → Reward → Upgrade → Repeat`. Everything else is
Season 2+. Launch target chain: **Algorand** (utility token; see the chain
foundation notes — real settlement stays gated/owner-approved).

## What exists today vs. to build
- **Exists:** chamber whole-plant render (spine, nodes, branches, fan leaves,
  internode/branch from `morphology.ts`, climate sway), growth-preview slider,
  compute-on-read sim, breeding, the macro bud system.
- **To build:** formal `PlantDNA` (vs the current `Morphology`), apical-dominance
  multi-cola, true stretch animation over flowering, branch-weight droop, richer
  leaf morphology, delayed-physics airflow, circadian motion, the perf systems,
  and the unified game-state wiring to the UI.
