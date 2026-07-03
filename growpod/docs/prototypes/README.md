# Prototypes — reference artifacts, not shipped code

Self-contained proof-of-concept builds kept in the repo as **design targets**. Nothing
here is wired into the app or the build; these are reference implementations a coding
agent studies before improving the real thing.

## `grow-chamber-3d-reference.html`

**Owner-authored Three.js grow-chamber prototype (2026-07-03).** A single-file build
(`three@0.161.0` via CDN import map) that grows a procedural cannabis plant seed →
harvest in real 3D inside the GROVERS pod: ring light + volumetric light cone, glowing
platform with radial spokes, floating motes, and a full plant built to the "Top Cola
Tip" / "Pistil Hair" breakdown guides — spear silhouette, phyllotaxy-spiralled nodes
(137.5°), layered lathe-teardrop bracts (green→purple as it ripens), sugar-leaf crown,
curved tube-geometry pistils from the seams (cream→orange), and additive-blended
trichome "frost" point clouds. A growth slider (`g ∈ [0,1]`) drives everything
statelessly/reversibly; drag-orbit + pinch-zoom.

Open it directly in a browser (needs network for the CDN import map).

### Why it's here
This is the **reference target for the Lab's 3D section** — the strain page's "3D Model"
tab (`web/src/app/lab/strains/[strainId]/page.tsx`), which today renders `StrainBud3D`
(`components/viz/StrainBud3D.tsx`, the bud/frost/pistil close-up) and `PlantGL`
(`components/viz/PlantGL.tsx`, the whole plant). The prototype's `CONFIG` block is a
clean, self-documenting tuning surface (`nodeHeights`, `apexColaScale`, the `col_*`
palette, the `g*` growth-timeline thresholds) worth mirroring when the lab 3D pipeline
gets its next pass. The bud-geometry approach also cross-references the existing
`web/src/lib/chamber/bud3d/` modules (`cola.ts`, `detail.ts`, `serverBud.ts`).

### Owner improvement notes (verbatim intent, 2026-07-03) — the punch list for the next pass
1. **Furrier pistil hairs.** The pistils currently read as smooth tubes
   (`makePistil` → `TubeGeometry`, radius `0.012`, 5 radial segments). They need to read
   as fine, fuzzy filaments — more of them, thinner, with a soft/fibrous look rather than
   clean glossy tubes.
2. **Better trichomes — there are thousands of them.** The frost is currently a sparse
   additive point cloud (~3 points per calyx, `matTri` size ~0.03–0.06). Real trichomes
   number in the thousands per bud; the render needs far denser, finer frost that reads as
   a sugar-coating over the whole cola surface, not scattered sparkles. (Watch perf —
   thousands of points/instances per bud is the whole challenge; this is why it belongs in
   the Lab's zoomed 3D view, not the live whole-plant chamber, which is deliberately
   lower-detail for phone readability.)
3. **A little more lighting.** Push the chamber lighting a touch — the plant should
   "pop" more (rim/back light, canopy glow), matching the arcade-layer glow direction
   already landed in the live 2D chamber (PR #124).

Overall owner verdict: *"I think it's pretty cool… I think we're onto something here."*
Keep the prototype as the north star for the Lab 3D bud viewer; the three notes above are
the concrete gap list.
