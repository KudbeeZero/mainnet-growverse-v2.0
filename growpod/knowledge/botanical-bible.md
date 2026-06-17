# GrowPod Empire — Botanical Bible & Developer Specification

> **CANONICAL.** This document and the files beside it are the source of truth for
> procedural cannabis morphology, strain DNA, environmental reactions, and macro
> bud rendering. Where code and this spec disagree, the code is the bug — fix it.
> Imported from the owner's `GrowPod_Empire_Botanical_Bible_Developer_Spec.docx`.

## 1. Project Vision
- **Goal:** generate recognizable strains procedurally from DNA presets instead of
  hand-drawn assets.
- **Rule:** no circles, no grape clusters, no perfect symmetry.
- **Target:** a player can identify a strain by **silhouette, frost, and coloration
  alone** — even with the name hidden.

## 2. Botanical Rules
- Buds are composed of overlapping **calyxes (bracts)**, **pistils**, **sugar
  leaves**, and **trichomes**.
- Calyxes are **teardrop / spear** shaped with **pointed tips** and **ridge lines**.
- **Golden-angle distribution (137.5°)** drives natural placement.

## 3. Macro Bud Generator Architecture
`BudSeed → Cola Spine → Nodes → Calyx Clusters → Pistils → Sugar Leaves → Trichomes → Final Render`
- Rows follow `sin(progress × π)` → narrow top, wide center, tapered base.

## 4. Strain DNA System
- **G13:** slim, spear-shaped, mostly green, medium frost.
- **Purple Diddy Punch:** chunky, purple/magenta, indica-like structure.
- **Animal Mints:** mixed green/purple, extremely frosty, golf-ball stacking.

## 5. Environmental System (§11)
- **Cool nights:** increase purple expression.
- **High UV:** increase trichome density.
- **Light stress:** increase foxtailing.
- **Drought:** smaller, tighter calyxes.
- **Humidity:** hidden `moldRisk` score.

## 6. Rendering Rules
- Overlap 60–75%.
- Add fuzzy frost, micro-noise, and subtle ridges.
- Pistils are thin, curved, and emerge **between** calyxes.

## Knowledge base map
| Doc | Covers |
|-----|--------|
| `plant-anatomy-reference.md` | calyx/pistil/trichome/sugar-leaf/cola anatomy |
| `macro-bud-rules.md` | the macro generator + rendering rules |
| `strain-dna.md` | `BudDNA` fields + the authored presets |
| `environment-rules.md` | §11 environmental modifiers |
| `mutation-system.md` | colour-mutation chain + environmental unlocks |
| `genetics-system.md` | backend genome/breeding ↔ bud visuals |
| `grow-tent-rules.md` | chamber/grow-tent scene + climate bands |
| `procedural-generation.md` | end-to-end pipeline + determinism |
| `whole-plant-architecture.md` | **next phase** — DNA-driven whole-plant view, silhouette, motion, launch loop |

## Code map (where the spec lives in the repo)
- Macro generator + renderer: `web/src/components/viz/GrowChamber.tsx` (`buildMacro`, `drawMacro`, `calyxPath`).
- Strain DNA presets + palette + env: `web/src/lib/chamber/budDna.ts`.
- Per-strain bud colour: `web/src/lib/chamber/strainVisuals.ts`.
- Morphology archetypes + growth: `web/src/lib/chamber/morphology.ts`.
- Backend genome/breeding/catalog: `src/growpodempire/genetics/`, `src/growpodempire/data/strains.yaml`, `strain_knowledge.yaml`.
