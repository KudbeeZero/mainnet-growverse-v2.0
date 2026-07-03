# Chamber renderer — architecture strategy (2026-07-03)

> Deep-research deliverable (owner-requested): *"find a strategy/architecture to get the
> chamber plant to look exactly like the 3D-rendered model."* 104-agent fan-out, 22 sources,
> 25 claims adversarially verified (3-vote, 2/3-to-refute), 22 confirmed / 3 refuted. This is
> a **decision doc**, not a task — nothing here is committed to build yet.

## The decision: stay on Canvas 2D. Do NOT migrate to a 3D/WebGL engine (yet).

The gap between our vector Canvas-2D plant and the painterly 3D-rendered reference is
closable with a small set of well-documented Canvas techniques. Migrating to WebGL/PixiJS/
Three.js is a **genuine tradeoff, not a guaranteed win**, and is only justified if we
specifically need dynamic per-pixel normal-mapped surface lighting + cast shadows — which a
*fixed backlit chamber* (one light, not interactive) largely does not.

## The four load-bearing techniques (ranked by leverage)

1. **Pre-render + cache to offscreen canvases, blit with `drawImage`.** *(highest leverage)*
   `drawImage` of a cached canvas is a hardware-accelerated GPU texture copy; re-executing
   anti-aliased path fills every frame is CPU-bound (Skia has no GPU rasterization for
   anti-aliased concave paths). Bake every static/repeated element — the chamber shell, and
   especially a single trichome/bract/pistil **stamp** — once, then blit it thousands of
   times. *Caveat: the offscreen buffer must fit snugly around its content or the copy
   overhead eats the gain.* (MDN Optimizing-canvas; Chrome for Developers.)

2. **Layer the scene into 3–5 stacked `<canvas>` elements.** Static backlit-chamber
   background on its own canvas that never redraws; the animated plant/foreground on
   another; UI on a third. Only the dynamic layer repaints each frame. *Caveat: keep to
   ~3–5 layers — more adds compositing overhead.* (MDN; Konva perf docs.)

3. **Fake glow / backlight / frost with composite modes.** `globalCompositeOperation`:
   - `'lighter'` (additive) → punchy rim/backlight "pop" and light-beam buildup.
   - `'screen'` (`1-(1-a)(1-b)`, always lightens, asymptotes to white without hard clip) →
     the diffuse frost *sugar-coat* without blowing highlights to flat white.
   - **Rim/edge light without normal maps:** drive an outer-glow pass from the sprite's
     **alpha** silhouette with a *tight falloff* (reads as an edge, not a halo) and composite
     with `'lighter'`/`'screen'`. *Caveat: alpha-driven glow is uniform, not truly
     directional — true directional rim light needs normals.* (MDN compositing; Godot/Unity
     rim-light shaders as corroboration.)

4. **Drive the thousands of organic elements with Perlin-noise flow fields.** Curling
   tapered pistil filaments and frost trails read as natural growth (not random noise) when
   each canvas point assigns a force direction that stamped particles follow — locally
   continuous flow. Combine with the cached stamp from #1: one pre-rendered pistil/trichome
   sprite blitted thousands of times along noise-field trajectories, cheap enough for real
   time. (Shiffman *Nature of Code*; sighack flow-field.)

> We already use pieces of this: the glow layer (#124/#133) uses `'lighter'`; the frost pass
> (#133) uses cheap sub-pixel arcs. The research validates that direction and says the next
> wins are **offscreen-stamp caching** + **canvas layering** + **flow-field pistils/frost**.

## When migrating to GPU (PixiJS + `pixi-lights`, or a WebGL shader pass) IS justified

Only if the target look genuinely requires **dynamic per-pixel normal-mapped surface
lighting and cast shadows** on the buds. That is the *one* thing Canvas 2D cannot do at
mobile framerates (it has no programmable per-pixel shader stage; the CPU `ImageData`
equivalent won't hit frame budget). If we want the frosted-bud surface to relight as a
light moves, or true cast shadows between colas → PixiJS + the `pixi-lights` deferred plugin
(3-layer G-buffer: diffuse + normal map → per-pixel lighting), or Phaser (normal-mapped
sprites in core via `Light2D`).

**But the tradeoff is real:**
- WebGL is **not reliably faster** than Canvas 2D for flat 2D sprite workloads (documented
  Canvas-wins benchmarks; crossover only around ~3k–5k elements).
- Deferred lighting is **slower than a normal renderer for just a few lights** — it only
  wins with *many* lights. Our chamber is "a few lights."
- Bundle-size + Next.js SSR/hydration cost of PixiJS is unquantified in the sources.

## Refuted claims (do NOT rely on these)
- ❌ "Normal-mapped 2D lighting *cannot* work on Canvas 2D." — It can, via slow `ImageData`
  CPU loops; just not at mobile framerates. (vendor marketing page, 0–3 refuted.)
- ❌ A specific "10k-sprite: Babylon 56 / Pixi 47 / Phaser 43 FPS" leaderboard — benchmark
  numbers are hardware/version specific and did not survive verification.
- ❌ The exact RGB-encoding-of-normals example — imprecise, refuted.
- Treat *all* specific FPS figures as illustrative, not predictive for our phones.

## Open questions → validate with a device prototype before any migration
1. Can thousands of cached sprite-atlas stamps + `'lighter'`/`'screen'` hold 30–60fps on
   **mid-range Android/iOS**, or does additive-overlay **fill-rate** become the bottleneck
   before draw-call count does? (No source benchmarked our exact load on real phones.)
2. Does the fixed backlit-chamber look actually *need* dynamic normal-mapped lighting, or
   can a **pre-baked lightmap + composite glow** in Canvas 2D reproduce it convincingly
   (the light isn't interactive)?
3. Concrete PixiJS + `pixi-lights` bundle weight + Next.js integration cost vs. a minimal
   hand-written `regl`/WebGL lighting pass vs. staying Canvas 2D?
4. Would `OffscreenCanvas` + a Web Worker move the trichome/flow-field generation off the
   main thread on mobile, and what's its real device support?

## Recommended sequencing
1. **Now (Canvas 2D):** offscreen-stamp caching for trichomes/pistils → canvas layering →
   flow-field pistils/frost → refine the `'lighter'`/`'screen'` glow + alpha rim-light.
2. **Prototype gate:** measure #1 on a real mid-range phone. If it holds framerate and looks
   right, **stop here** — no engine migration needed.
3. **Only if the look demands relightable normal-mapped buds / cast shadows:** spike PixiJS +
   `pixi-lights` behind a flag, measure bundle + FPS on device, then decide.

### Key sources
MDN *Optimizing canvas* + *globalCompositeOperation* (primary) · Chrome for Developers
(cached-blit = GPU texture copy) · `pixijs-userland/lights`, `dobrado76/pixi-lights-and-shadows`,
Matt Greer *Dynamic lighting & shadows*, Chad Engler *Pixi deferred lighting* (GPU path) ·
Shiffman *Nature of Code* + sighack (flow fields) · PixiJS issue #7565 + `js-game-rendering-benchmark`
(Canvas-vs-WebGL tradeoff).
