# 🏛️🌿 Immersive Classroom & Plant Anatomy Explorer — design codex (08)

> The design for the **"really in class"** layer of GrowPod University: a **virtual lecture hall**
> where an AI faculty presenter delivers a lecture, and a **Plant Anatomy Explorer** that lets a
> student orbit/zoom from whole-plant → cola → calyx → trichome to *learn every detail of the plant*.
> This is the visual/spatial companion to the credential machinery (`06-university.md`) and the
> content standards (`07-university-phase-2.md`). **Records/design only** — UNI-011 freeze: no code
> until the owner opens the University Build Phase. Architecture grounding:
> `docs/research/2026-06-23-3d-classroom-architecture.md` (A1). Tags: ✅ built · 🔨 partial · ⬜ planned.
> **All items here are ⬜ planned.**

## Why this exists
Phase-2 §2 demands "active participation, not slides." A lecture *reader* (shipped) is the floor;
the moat-grade version is **spatial**: you sit in a hall, a named professor presents, and the thing
being taught — the plant — is a manipulable 3D object you can take apart. The university already
*teaches* real botany (`knowledge/plant-anatomy-reference.md`, `whole-plant-architecture.md`); this
turns that knowledge into something you **inspect**, not just read.

## Renderer (settled by A1)
Hybrid: **R3F (already installed) for the two new 3D surfaces**, the existing **2D Canvas macro-bud
engine as the accessibility fallback**, procedural-first geometry that **reuses the deterministic
`seedForPlant`/`mulberry32` pipeline** (never `Math.random()`). See A1 §8 for the stack; A1 §9 lists
4 open owner questions (fidelity ceiling, set-dressing source, zoom depth, hall realism) that gate
any build.

## Surface 1 — The Lecture Hall ⬜
A stylized 3D hall shell (cheap, fast — not a photoreal room) framing a presentation:
- **Stage + presenter**: the AI faculty avatar (Track B) stands at a lectern; lecture video/audio
  plays on the presenter and a **slide/diagram surface** beside them. Persona-specific set dressing
  per faculty (Flora=plant-bio greenhouse motif, genetics=lab, commercial=grow bay, etc.).
- **Lecture-player UI** (overlay, 2D HUD): play/pause, scrubber, captions toggle, transcript panel,
  speed, "open the Explorer" CTA when the lesson references anatomy.
- **Seating/ambience**: subtle, optional; reduced-motion disables ambient sway. The hall is *framing*,
  never information — all teaching content is in the audio+caption+slide, which are the transcript.
- **Why a room at all**: presence. The "really in class" feeling is the lectern + presenter + the
  plant-on-a-pedestal you can walk up to and inspect, not a fullscreen video.

## Surface 2 — The Plant Anatomy Explorer ⬜ (the showcase)
A read-only teaching sandbox: one plant on a pedestal, **orbit + zoom traversal** through four detail
tiers. Each tier is a **LOD level** (A1 §5) *and* a lesson stop with interactive labels.

| Tier | What you see | Grounded in | Teaches |
|------|--------------|-------------|---------|
| **T1 Whole plant** | silhouette, branching, fan leaves, droop | `whole-plant-architecture.md` (PlantDNA: internode, branchAngle, apicalDominance, stretch) | strain recognition, morphology, apical dominance, phyllotaxy (golden-angle 137.5°) |
| **T2 Cola / branch** | a flowering top: nodes, sugar leaves, bud structure | `whole-plant-architecture.md`, `plant-anatomy-reference.md` (cola spine + nodes) | flower formation, node spacing, bud density |
| **T3 Calyx** | teardrop/oval/spear/foxtail calyx: center seam, 2–4 ridge "vertebrae", swollen base, pistils | `plant-anatomy-reference.md` (calyx + pistils) | the building block of bud; pistil colour age white→cream→orange→amber→pink |
| **T4 Trichome (microscope)** | resin gland heads as frost coating; clear→cloudy→amber maturity | `plant-anatomy-reference.md` (trichomes) | ripeness/harvest-window reading by trichome colour |

- **Interactivity primitives used** (≥2 per Phase-2 §2): *clickable diagram* (tap a part → label +
  description, alt-text updates), *parameter sim* (drag a PlantDNA slider — internode, stretch,
  trichomeDensity — and watch the plant change, reusing `applyEnvironmentToBudDNA` semantics),
  *before/after* (ripeness slider sweeps pistil/trichome colour), and a *guided experiment* hook
  for labs.
- **Environmental reactions** (read-only, from `whole-plant-architecture.md` §Env): toggle light /
  cool nights / high UV / airflow / humidity and see compact-vs-stretch, purple, frost, stem
  thickness, mold-risk — the visual basis of the Stress Diagnosis lab.
- **Motion**: delayed-physics airflow (top→middle→bottom) + subtle circadian pray/droop; **all off
  under reduced-motion**.

## Mapping to the 5 canonical labs (Phase-2 §6 / Master Report §8.2)
The Explorer is the shared engine for all five — each lab is a *mode* on the same scene, never a new
renderer:
1. **Cell ID** → T4 microscope tier + labeled callouts.
2. **Photosynthesis Sim** → T1/T2 leaf focus + a light/CO₂ parameter sim driving a teaching readout.
3. **Environmental Variables** → the env-toggle panel on the whole plant (reads, doesn't write, the
   sim — labs *call* `simulation/engine.py` in teaching mode per Phase-2 §6).
4. **Stress Diagnosis** → present a stressed plant; student identifies cause from visual cues; graded
   deterministically against an authored answer key (no live AI to grade).
5. **Virtual Grow Room** → the Lecture Hall shell reused as a mini grow space; place/observe a plant
   across stages (Seed→Veg→Flower→Harvest).

## Accessibility (ship gate — mirrors Phase-2 §10, A1 §6)
2D Canvas fallback carries the same labels; `prefers-reduced-motion` kills all motion + auto-orbit;
`react-three-a11y` makes every anatomy part keyboard-focusable with live alt-text; **labels ARE the
transcript** (parity with narration); contrast ≥ 4.5:1; **no 3D-only or motion-only information**.

## Invariants honored
- **Read-only teaching sandbox** — visualizes anatomy/sim state, adds **no gameplay/economy logic**
  (labs call the pure engine in teaching mode; Phase-2 §6, CLAUDE.md engine purity).
- **Deterministic** — same plant id → same 3D plant (`seedForPlant`/`mulberry32`; never `Math.random()`).
- **Earned, never bought** — the Explorer teaches; it grants no power and posts nothing to the ledger.
- **Freeze-safe** — design only; no renderer/code/curriculum changes pending the University Build Phase.

## Open questions (owner) — inherits A1 §9
Fidelity ceiling (stylized vs photoreal) · set-dressing source · max zoom depth (stop at calyx vs.
trichome microscope) · hall realism. Plus: **does the Explorer ship inside courses only, or also as a
standalone "study any strain" feature** (ties to the encyclopedia, 29 strains)?

## Cross-links
- Architecture decision: `docs/research/2026-06-23-3d-classroom-architecture.md` (A1)
- Content standards & the 5 labs: `docs/memory/design/07-university-phase-2.md` · credential machinery:
  `06-university.md`
- Anatomy/morphology truth: `knowledge/plant-anatomy-reference.md` · `knowledge/whole-plant-architecture.md`
  · `knowledge/procedural-generation.md`
- Faculty presenter & lecture video: Track B (`docs/research/2026-06-23-ai-presenter-lecture-pipeline.md`)
- Master plan/ledger: `docs/research/university/IMMERSIVE_UNIVERSITY_MASTER_PLAN.md`
