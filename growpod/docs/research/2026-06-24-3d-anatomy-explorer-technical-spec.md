# 3D Plant Anatomy Explorer — Technical Spec (F1)

> **Records/Research only** (UNI-011 freeze-safe). A **buildable** technical design for the
> "learn every detail" 3D Anatomy Explorer (A2), grounded in the generation code that **already
> exists**. Turns the A1/A2 *design* into a Build-Phase-3 *spec*. Status: **draft for owner review.**

## 1. The key realization
The plant-generation layer is **already deterministic and already shaped as 3D instance arrays**. The
Explorer does **not** need new geometry math — it's a **renderer + interaction layer** over existing
*pure, unit-tested* modules. This honors the CLAUDE.md invariant (no new logic in the pure core) and
collapses the risk of Build-Phase 3.

### What already exists (reuse verbatim)
| Module | Engine | Emits | Tier it feeds |
|---|---|---|---|
| `chamber/apicalDominance.ts` | E1/E2 | `ColaTops` (1–4 competing tops, mass share) | T1 whole plant |
| `chamber/phyllotaxy.ts` | E3 | per-node **azimuth** (decussate → golden-angle 137.5° spiral) | T1 node/leaf/branch placement |
| `chamber/morphology.ts` | core | silhouette from `indica_ratio` (internode/branch/stretch), seeded `mulberry32` + `seedForPlant` | T1 |
| `chamber/bud3d/cola.ts` | — | `buildCola(dna, seed, opts) → ColaInstance[]` (+ `hslToRgb`, `widthCurve`) | T2 cola |
| `chamber/bud3d/detail.ts` | — | `buildPistils() → PistilInstance[]` (`pistilColor(ripe,brown,magenta)`), `buildFrost() → FrostInstance[]` (`FrostMat 0\|1\|2` = clear/cloudy/amber) | T3 calyx / T4 trichome |
| `chamber/bud3d/serverBud.ts` | — | `budParamsFromTrichomes(telemetry) → {ripe, trich}` (**server-authoritative** ripeness) | T4 maturity |
| `chamber/trichomes.ts` | E7 | maturity mix clear→cloudy→amber | T4 |

**These already return instance arrays** — exactly the input an R3F `InstancedMesh` wants. The work is
rendering them in true 3D and wiring interaction, not generating them.

## 2. Architecture (module boundary)
```
web/src/lib/chamber/*        ← PURE generators (EXIST, unchanged) — emit instance arrays
        │  (consumed, never modified)
        ▼
web/src/lib/chamber3d/explorer/   ← NEW: R3F components that RENDER those arrays
   ├─ ExplorerCanvas.tsx     (R3F <Canvas>, lazy route /university/explorer)
   ├─ WholePlant.tsx         (T1: branches/leaves from apicalDominance+phyllotaxy+morphology)
   ├─ ColaMesh.tsx           (T2: <Instances> over ColaInstance[])
   ├─ CalyxMesh.tsx          (T3: calyx detail + <Instances> over PistilInstance[])
   ├─ TrichomeField.tsx      (T4: <Instances> over FrostInstance[], color by FrostMat)
   ├─ TierController.tsx     (zoom ↔ LOD tier; OrbitControls; reduced-motion)
   ├─ PartPicker.tsx         (raycast → PartLabel + live alt-text)
   └─ Fallback2D.tsx         (reuse chamberCore.ts macro-bud — a11y/no-WebGL)
```
**Invariant:** `chamber3d/` only *imports* `chamber/` — zero edits to the pure core (CLAUDE.md). New
3D code is itself split pure-vs-render so the geometry mapping stays unit-testable.

## 3. The four LOD tiers (zoom = LOD = lesson stop)
- **T1 Whole plant** — `ColaTops` decides 1–4 upright colas; `phyllotaxy` gives each node an azimuth
  so branches wrap the stalk and leaves face away (true 3D, not billboards); `morphology` sets the
  silhouette from `indica_ratio`. Branch + fan-leaf instances. Teaches morphology / apical dominance /
  phyllotaxy.
- **T2 Cola** — `buildCola(dna, seed)` → `ColaInstance[]` rendered as one `InstancedMesh` (per-instance
  transform + `hslToRgb` color). Teaches flower/node structure.
- **T3 Calyx** — per-calyx detail mesh (teardrop/oval/spear/foxtail with center seam + ridges, from
  `plant-anatomy-reference.md`) + `buildPistils()` instances colored by `pistilColor(ripe,brown,
  magenta)`. Teaches the building block + pistil aging white→amber→pink.
- **T4 Trichome (microscope)** — `buildFrost()` → `FrostInstance[]` as a GPU-instanced field; color
  per `FrostMat` (0 clear / 1 cloudy / 2 amber). **Ripeness from `budParamsFromTrichomes()` (server
  truth)**, not client drift. Teaches harvest-window reading.

## 4. Rendering plan (meets the mobile draw-call budget)
- **One `InstancedMesh` per primitive type** (cola units, pistils, trichomes, leaves) → a handful of
  draw calls total, well under the **< 50 mobile** target (A1 §5). Instance count scales with LOD tier
  (don't render trichomes at T1).
- **Per-instance attributes** come straight from the existing structs (transform, color, `FrostMat`).
- **LOD via Drei `<Detailed>`** keyed to the zoom tier; only the active tier's instances mount.
- **Materials:** lit standard material for cola/calyx; cheap shader/sprite for trichome shimmer
  ("micro-shimmer, never strobe" — `trichomes.ts`); KTX2 textures if any.

## 5. Determinism & server-authority (preserved)
- `seedForPlant(id)` → `buildCola(dna, seed)` → **same plant id renders the same 3D plant**, every
  device, forever. Never `Math.random()`.
- Maturity/ripeness reads **server telemetry** via `budParamsFromTrichomes()` (the 🔬 readout's truth),
  so the Explorer's harvest-window lesson matches the live sim — no teaching a different plant than the
  game simulates.

## 6. Interaction
- **OrbitControls** (orbit + zoom); zoom thresholds drive `TierController` transitions (T1↔T4).
- **PartPicker** raycasts the instanced meshes → `PartLabel` (`<Html>`): name + 2–3 sentence fact +
  **live alt-text** (the label text doubles as transcript). Keyboard tab-through via `react-three-a11y`.
- **Param sliders** (PlantDNA: internode/stretch/trichomeDensity; env: light/UV/nights) **re-run the
  pure generators** (cheap, deterministic) and the instances update — this is the "parameter sim"
  primitive (Phase-2 §2) for free.

## 7. Accessibility & performance (ship gates)
- `prefers-reduced-motion` → no auto-orbit/shimmer; `Fallback2D` (the shipped `chamberCore` macro-bud)
  for no-WebGL/low-end; labels = transcript; contrast ≥ 4.5:1; no 3D-only or color-only info.
- `IntersectionObserver` RAF gating (already the pattern); dispose meshes/materials on unmount; cap
  trichome instance count on mobile; `OffscreenCanvas` optional for steady 60fps.

## 8. Build steps (Phase-3, when freeze lifts; after A1 §9 answered)
1. Scaffold `chamber3d/explorer/` + lazy route; render T2 `ColaMesh` from `buildCola` (proves the
   instance→InstancedMesh path).
2. Add T3/T4 (`buildPistils`/`buildFrost`, server ripeness). 3. Add T1 whole-plant from
   apicalDominance+phyllotaxy+morphology. 4. TierController + PartPicker + labels. 5. Param sliders.
   6. Fallback2D + a11y + reduced-motion. 7. Wire the 5 labs as Explorer modes (A2).

## 9. Acceptance criteria
Same plant id → identical 3D plant (snapshot test on the pure mapping) · < 50 draw calls on mid mobile
· 30–45fps floor, degrades never crashes · ripeness matches server telemetry · keyboard + SR + reduced-
motion + 2D fallback all pass · **zero edits to `chamber/` pure modules**.

## 10. Open questions (owner) — inherits A1 §9
Fidelity ceiling (stylized recommended) · calyx mesh authored vs. procedurally lathed from the seam/
ridge spec · how deep T4 goes (gland heads vs. surface) · whether the Explorer is its own route or
embedded in the Lecture Hall.

## Cross-links
- Design: `docs/memory/design/08-immersive-classroom.md` (A2) · arch: `docs/research/2026-06-23-3d-classroom-architecture.md` (A1)
- Code reused: `web/src/lib/chamber/{apicalDominance,phyllotaxy,morphology,trichomes}.ts` · `chamber/bud3d/{cola,detail,serverBud}.ts` · `chamber/chamberCore.ts`
- Anatomy truth: `knowledge/plant-anatomy-reference.md` · `knowledge/procedural-generation.md` · `whole-plant-architecture.md`
- Master plan/ledger: `docs/research/university/IMMERSIVE_UNIVERSITY_MASTER_PLAN.md`
