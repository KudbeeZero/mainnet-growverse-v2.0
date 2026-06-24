# 3D Immersive Classroom & Plant Explorer — Architecture Decision (A1)

> **Records/Research only** (UNI-011 freeze-safe). A decision doc, not an implementation. It
> recommends the rendering stack for the immersive university so the **owner approves the
> architecture before any 3D code is written**. Part of the Immersive University build pass
> (`docs/research/university/IMMERSIVE_UNIVERSITY_MASTER_PLAN.md`, Track A). Status: **draft for
> owner review**.

## 1. The decision in one paragraph
**Adopt a hybrid renderer.** Keep the existing **2D Canvas macro-bud engine** for the dashboard
hero and card pipeline (it's deterministic, tuned, cheap, and already shipping). Add **true 3D via
React-Three-Fiber** — which is *already a dependency* (`three@0.171`, `@react-three/fiber@9.6`,
`@react-three/drei@10.7`) — for exactly two new university surfaces: **(a)** the **Plant Anatomy
Explorer** (orbit/zoom from whole-plant → cola → calyx → trichome, the "learn every detail" goal)
and **(b)** the **virtual lecture hall** shell. **Procedural-first geometry** (extend the existing
seeded `mulberry32`/`seedForPlant` pipeline into 3D), with **authored GLTF** only for fixed set
dressing (the room, lab benches, equipment). This reuses the determinism, anatomy model, and
performance instincts already in the repo instead of forking them.

## 2. What already exists (the foundation we extend)
- **Deterministic procedural bud** (`web/src/lib/chamber/morphology.ts`, `budDna.ts`,
  `strainVisuals.ts`): seeded `mulberry32` PRNG, `seedForPlant(id)` via FNV-1a → *same strain/plant
  id always renders the same bud*. **Hard rule: never `Math.random()` in generation**
  (`knowledge/procedural-generation.md`).
- **A botanically real anatomy model** the 3D explorer must reproduce
  (`knowledge/plant-anatomy-reference.md`): calyx teardrop/oval/spear/foxtail with center seam +
  2–4 ridge "vertebrae"; pistils white→cream→orange→amber→pink; trichomes clear→cloudy→amber as a
  frost coating (not snow dots); sugar leaves; an invisible cola spine with nodes. **The geometry is
  already specified** — we're changing the *renderer*, not inventing the plant.
- **Build/draw split + perf instincts already documented**: offscreen-canvas caching keyed on (DNA
  signature + dev bucket), `IntersectionObserver` RAF gating for the always-mounted hero
  (`procedural-generation.md` §Extending). These map 1:1 onto R3F best practice (below).
- **R3F already installed** but not yet used for plants — so this is *not* a new heavy dependency or
  an architecture fork; it's activating a stack the team already chose.

## 3. Why hybrid, not "all-in 3D"
- The 2D macro-bud hero is **tuned, deterministic, and cheap**; rebuilding it in 3D would be pure
  risk with no player-visible win and would re-open art direction that's already settled.
- 3D earns its cost **only** where rotation/zoom/scale-traversal is the actual feature — the anatomy
  explorer and the room. That's where "feel like you're really in class / inspect every detail"
  lives.
- A clean seam (2D for cards/hero, 3D for explorer/hall) keeps the dashboard's perf budget intact
  and lets the 3D work ship as an additive, lazy-loaded route.

## 4. Procedural vs. authored geometry — recommendation: **procedural-first**
| | Procedural (recommended for the plant) | Authored GLTF |
|---|---|---|
| Determinism | ✅ reuses `seedForPlant`→same plant every time | ❌ static, one look |
| Per-strain variety | ✅ free from existing `BudDNA` presets | ❌ needs an artist per strain |
| Growth stages | ✅ parameter-driven (reuse `budDev`/`ripe`/`trich`) | ❌ many baked models |
| Botanical truth | ✅ encodes the anatomy reference directly | ⚠️ artist interpretation |
| Set dressing (room, benches, tools) | ⚠️ overkill | ✅ **use GLTF here** |
| Perf control | ✅ instancing of repeated calyxes/trichomes | ⚠️ depends on export |

**Approach:** generate the cola spine as a 3D curve; place **instanced calyx meshes** along nodes
(one low-poly teardrop mesh, per-instance transform + color from the existing palette logic);
**instanced trichomes** as a density-scaled GPU layer; pistils as cheap curved ribbons; sugar leaves
as alpha-mapped cards. This is the proven web pattern for "real geometry that still performs"
(proctree.js / ez-tree / Florasynth all instance repeated botanical parts on the GPU). The repo's
ring-packing + golden-angle logic ports directly to 3D node placement.

## 5. Performance budget (mobile is the gate)
Targets drawn from current R3F/Three.js guidance (2026):
- **< 50 draw calls on mobile** → mandatory **instancing** for calyxes & trichomes; Drei
  `<Instances>`. Instancing cuts draw calls 90%+.
- **LOD** via Drei `<Detailed distances={[…]}>` (whole-plant → cola → single-calyx tiers); ~30–40%
  FPS win in dense scenes. The explorer's zoom levels *are* the LOD tiers — natural fit.
- **Compressed assets**: KTX2/Basis textures (4–8× less GPU memory) + Draco for any authored GLTF
  set dressing; ~40% faster mobile load in cited cases.
- **Reuse existing instincts**: `IntersectionObserver` to gate the RAF (already done for the 2D
  hero); offscreen render targets keyed on (DNA signature + stage); dispose on unmount (top cause of
  WebGL leaks). Consider `OffscreenCanvas` for the explorer to hold 60fps.
- **Frame budget**: 60fps desktop / 30–45fps floor on mid mobile; **must degrade, never crash**.

## 6. Accessibility (ship gate — non-negotiable, mirrors Phase-2 §10)
- **`prefers-reduced-motion`**: auto-rotate off, no idle sway, instant transitions; honor OS setting.
- **`react-three-a11y`**: focusable meshes, keyboard traversal of anatomy parts, contrast options.
- **2D graceful fallback**: no-WebGL / low-end / reduced-motion users get the **existing 2D Canvas
  macro-bud** + a labeled static diagram — *no information is 3D-only*.
- **Screen reader**: each focused part updates live alt-text ("Calyx — teardrop, center seam,
  trichome frost cloudy"); the explorer's labels double as the lesson transcript (parity with
  Phase-2 §10/§11).
- **No audio-only or motion-only information.**

## 7. Determinism & invariants preserved
- Same `seedForPlant(id)` → same 3D plant (carry the `mulberry32`/FNV-1a seeds straight into the 3D
  generator; **never `Math.random()`**).
- Pure, DOM-free generation logic stays unit-testable (the R3F components only *consume* it), mirroring
  today's `morphology.ts`/`GrowChamber.tsx` split.
- The 3D explorer is a **read-only teaching sandbox** — it visualizes sim/anatomy state, it does not
  add gameplay logic (consistent with Phase-2 §6 "labs call the engine, no new logic in the engine").

## 8. Recommended stack (for owner approval)
- **Renderer**: React-Three-Fiber (installed) + Drei (`<Instances>`, `<Detailed>`, `<OrbitControls>`,
  `<Environment>`, `<Html>` labels) + `react-three-a11y`.
- **Plant geometry**: procedural, seeded, instanced — extends `morphology.ts`/`budDna.ts` into a new
  pure `web/src/lib/chamber3d/` module (no edits to the 2D path).
- **Set dressing**: a small set of Draco-compressed GLTF props (room, bench, lamp) — authored once.
- **Loading**: lazy route (`/university/explorer`, `/university/hall`), code-split off the main bundle.
- **Fallback**: existing 2D Canvas engine.

## 9. Open questions for the owner (decide before 3D code)
1. **Fidelity ceiling**: stylized-botanical (recommended — readable, performant, matches the card art)
   vs. photoreal (heavy, mobile-risky)?
2. **Set-dressing source**: commission GLTF props, buy a stock pack, or generate? (Affects budget/timeline.)
3. **Scope of "every detail"**: how deep does zoom go — to trichome gland heads (microscope view) or
   stop at calyx surface? (Drives the deepest LOD tier + a possible microscope "lab" mode.)
4. **Lecture hall realism**: a stylized room shell (cheap, fast) vs. a richly modeled hall (immersive,
   costly)? Ties to the B-track avatar-presenter placement.

## 10. Recommendation summary
Ship the **hybrid**: keep 2D where it's already excellent, add **procedural-first R3F** for the
anatomy explorer + lecture hall, instance the repeated botany, hold a hard mobile draw-call budget,
and make the 2D engine the accessibility fallback. **No 3D code until §9 is answered.**

## Sources
- [100 Three.js Tips That Actually Improve Performance (2026) — utsubo](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- [Scaling performance — React Three Fiber docs](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- [Boosting R3F Mobile Performance in 2026 — Krapton](https://www.krapton.com/blog/boosting-react-three-fiber-mobile-performance-in-2026-a-deep-dive-d6105c)
- [Three.js vs R3F vs Babylon.js 2026 — PkgPulse](https://www.pkgpulse.com/guides/threejs-vs-react-three-fiber-vs-babylonjs-3d-webgl-2026)
- [Fractals to Forests: Realistic 3D Trees with Three.js — Codrops](https://tympanus.net/codrops/2025/01/27/fractals-to-forests-creating-realistic-3d-trees-with-three-js/)
- [glTF Procedural Trees — donmccurdy](https://gltf-trees.donmccurdy.com/) · [ez-tree](https://github.com/dgreenheck/ez-tree) · [Florasynth](https://discourse.threejs.org/t/florasynth-procedural-tree-generator/58740)
- [Procedural Instanced Forest — three.js forum](https://discourse.threejs.org/t/procedural-instanced-forest-high-performance-real-trees/88610)
- [Three.js & Accessibility — Pip Lev](https://medium.com/@piplev/three-js-accessibility-c4f45d83f2c6) · [Accessible WebGL — Anneka Goss](https://annekagoss.medium.com/accessible-webgl-43d15f9caa21)
- Repo: `knowledge/procedural-generation.md` · `knowledge/plant-anatomy-reference.md` · `web/package.json` · `docs/memory/design/07-university-phase-2.md`
