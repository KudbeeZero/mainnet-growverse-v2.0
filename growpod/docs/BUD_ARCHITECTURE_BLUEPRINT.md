# GrowPod Empire — Procedural Cannabis Bud Generation Blueprint

> Developer + art blueprint for the **Macro Bud View** (`web/src/components/viz/GrowChamber.tsx`,
> `view="macro"`). One unified spec so the procedural generator and any future art follow the
> same model. Status tags: ✅ implemented · 🔨 partial · ⬜ planned.

**Final goal:** a player should be able to identify a strain (e.g. G13, Animal Mints, Gelato,
White Fire OG) from the **bud silhouette + coloration alone**, even with the name hidden.

## 1. Current → Target
- ❌ Old: grape-like rings of big perfect circles, no layering/stem/depth.
- ✅ Target: layered organic teardrop calyxes around a central cola, pistils between calyxes,
  sugar leaves, trichome frost, strain-recognizable.

## 2. Bud anatomy
- **Cola spine** — invisible central stem; controls shape. ✅
- **Calyx** — the main building block (teardrop). ✅
- **Pistils** — hairs emerging from between calyxes. ✅
- **Sugar leaves** — small leaves protruding from the bud. 🔨
- **Trichomes** — resin crystal frost on the surface. ✅
- **Nodes** — growth anchor points down the spine. ✅ (chamber view)

## 3. Layer system (painter's algorithm, back → front)
| Layer | Content | Opacity | Scale | Notes |
|------|---------|---------|-------|-------|
| 1 | Back calyxes | ~55–80% | 90% | darker, optional 1px blur |
| 2 | Middle calyxes | ~80% | 100% | |
| 3 | Front calyxes | 100% | 100% | highlights + specular |
| 4 | Pistils | — | — | between clusters |
| 5 | Trichomes | — | — | surface frost |
| 6 | Particle glow | — | — | frost bloom |
Current impl uses a continuous `depth` (0..1) per calyx instead of 3 discrete layers. ✅

## 4. Cola shape generator ✅
Width as a function of vertical progress: `rowWidth = sin(progress^k · π) · budWidth`
(narrow top, widest middle, taper bottom; `k>1` for indica pushes the widest point lower /
heavier lower mass).

## 5. Calyx sprite types (weighted) 🔨
- **A — Teardrop** 40%
- **B — Oval** 30%
- **C — Pointed bract** 20%
- **D — Foxtail** 10% (thin, elongated)

## 6. Golden-angle distribution ⬜ → (the single biggest improvement)
Real cannabis is spiral phyllotaxy, not rows. Place calyx `i` at `theta = i · 137.5°`.
Use `cos(theta)` for horizontal offset across the silhouette width and `sin(theta)` to derive
back↔front depth, so the spiral itself produces natural overlap and layering.

## 7. Overlap system ✅
Target overlap 50–70% (vs 0% in the old rings) — calyxes should stack like scales.

## 8. Pistil system 🔨
- Spawn from ~25–40% of calyxes, from between clusters across the whole cola.
- Color age progression: **white → cream → orange → amber → pink/brown** (ripeness + browning;
  pistil hue is authored per strain, independent of calyx anthocyanin).

## 9. Trichome frost scale ✅
Maturity: clear → cloudy/white (dominant frost band) → amber. Density tuned to read as frost,
not snow.

## 10. Strain DNA profiles ⬜ (numeric generator traits)
| Trait | G13 | Animal Mints | Gelato | White Fire OG |
|------|-----|--------------|--------|---------------|
| Density | 90 | 95 | 85 | 90 |
| Trichomes | 70 | 98 | 95 | 100 |
| Purple chance | 10 | 40 | 60 | 20 |
| Foxtailing | 5 | 10 | 15 | 20 |
| Stretch | Medium | Medium | Medium | High |

## 11. Color mutation system ⬜
`Green → Lime → Deep Green → Purple → Black Purple → Pink Pistils → Albino`, with environmental
unlocks: cool nights → purple · high UV → more resin · light stress → foxtails · drought →
smaller calyxes · humidity → mold risk.

## 12. Final render pipeline
`bud seed → cola spine → nodes → calyx clusters → golden angle → pistils → sugar leaves →
trichomes → phenotype colors → particle effects → cache phenotype`

---
*Maps to the authored per-strain layer in `web/src/lib/chamber/strainVisuals.ts` (bud color /
accent) and the morphology archetypes in `web/src/lib/chamber/morphology.ts`. The strain-DNA
profile (§10) and color-mutation/environment system (§11) are the next data-model steps.*
