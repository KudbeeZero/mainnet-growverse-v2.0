# 3D Quality Rubric — the binding standard for plant/asset realism

> Owner directive (2026-07-02): *"a very strict set of rules for 3D so that getting an 8/10 is
> not as easy — our quality is going to be high."* Every 3D iteration loop (PlantGL, trichomes,
> future strain assets) MUST score itself with THIS rubric. Generous self-scoring is the failure
> mode this doc exists to kill. An 8 here means "a stranger would believe it's a high-end
> real-time render of a real plant" — not "good for a browser game."

## The two hard rules that make 8 expensive

1. **Overall = the MINIMUM of the axis scores, never the average.** One weak axis caps the whole
   asset. A plant with a gorgeous silhouette (9) but faceted crystal calyxes (4) scores **4**,
   not 6.5. You cannot average your way to a good grade.
2. **Hard caps — these looks cannot exceed the cap no matter what else is good:**
   - Faceted / angular / crystalline calyxes (visible flat polygon facets on organic surfaces) →
     **calyx axis capped at 4.**
   - Sparse frost that reads as scattered specks rather than a resin coat → **frost axis capped
     at 5.**
   - Flat sprite-only trichomes at close range (no real stalk+gland geometry) → **frost axis
     capped at 5.**
   - Pistils absent or not clearly orange/woven → **pistil axis capped at 4.**
   - Wrong colour identity (not the data-driven strain palette) → **colour axis capped at 3.**
   - Visible hard polygon edges on any surface meant to read organic (stem, leaf, calyx) at the
     asset's intended viewing distance → **that axis capped at 6.**

## The anchored 1–10 scale (same meaning on every axis)

- **1–2 Broken:** wrong shape, z-fighting, missing layer, cartoon.
- **3–4 Blocky/stylized-low-poly:** reads as "video-game plant," obvious facets, flat materials.
  *This is where "first stab" low-poly lands. It is NOT a passing grade.*
- **5–6 Competent stylized:** clean shapes, believable structure, but clearly non-photoreal —
  a knowledgeable viewer instantly clocks it as CG/game art. **Default ceiling for stylized work.**
- **7 Good realtime asset:** organic forms, proper materials (roughness/translucency), reads as a
  real plant at a glance; minor tells on close inspection. **Genuinely hard to reach.**
- **8 High-end realtime:** would pass as a AAA/marketing real-time render; caking frost, plump
  organic calyxes, woven pistils, correct light response. A layperson would not assume it's fake.
  **Requires EVERY axis ≥ 7 and ZERO hard-cap violations.**
- **9 Reference-grade:** side-by-side with the owner's reference photo it holds up at normal
  viewing; only an expert finds the tells.
- **10 Indistinguishable / exceeds** the reference photo.

## The axes (score every one, with a one-line evidence note)

1. **Silhouette & structure** — spear/branch proportion, apical dominance, natural branching.
2. **Calyx form** — plump, rounded, overlapping, organic (NOT faceted/crystalline); dense packing.
3. **Trichome frost** — capitate stalk+gland caking that reads as a silvery resin COAT; correct
   LOD (real geometry close, shader far).
4. **Pistils** — orange/amber, curled, clearly woven out from between calyxes.
5. **Sugar & fan leaves** — serrated, naturally angled/curled, correct density, deep waxy tone.
6. **Material & shading** — PBR believability: roughness/translucency/subsurface softness, no
   plastic look, correct ambient occlusion in the crevices.
7. **Colour identity** — matches the data-driven strain palette (Blue Dream = blue-teal + orange
   pistils + silver frost); no hardcoded cheats.
8. **Lighting & composition** — studio light reads the form; real contact shadow; centered clean.
9. **Cohesion & realism** — does it read as ONE living plant, or a pile of assembled parts?
10. **Performance honesty** — hits the LOD tri budget without faking away the close-up detail
    that earns the grade (you can't score close-LOD realism on a mid-LOD screenshot).

## How a loop must report (no shortcuts)

Every iteration: regenerate → screenshot BOTH a full-plant and a tight close-up → Read them →
score all 10 axes 1–10 with a one-line evidence note each → apply the hard caps → **overall =
min(axes)**. Change the single lowest axis. Repeat. Do NOT report an average. Do NOT claim a
score a screenshot doesn't prove. Target: **overall ≥ 8** (i.e. every axis ≥ 7, no cap hit) — and
because overall is the min, that is deliberately hard. Stylized low-poly plateaus at ~5–6 here by
design; reaching 8 requires organic geometry + caked frost + real materials, not parameter nudges.

## Standing rule

This rubric is binding on all current and future 3D asset loops. When a loop reports "8/10," it
must show the per-axis breakdown and the min-gating, or the score is not accepted.
