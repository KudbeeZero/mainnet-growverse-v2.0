# Design Codex 12 — Arcade Animation System (juice with a purpose)

> **Owner directive (2026-07-03):** *"Create a design system set of rules for
> animating — looping dynamically to polish the plant, and animations for
> trimming/boosting. On a boost the plant shrinks a teeny bit, then pops bigger,
> then bounces back. Trimming has to have a purpose. Everything we add — that
> arcade aspect — needs to be layered in."*

This codex is the **rulebook for GrowVerse's arcade feel**: how every action gets
a reaction, what the motions are, how long they take, and the one law that keeps
it from becoming a fireworks show — **every animation must earn its place by
communicating something true about the game state.** Juice is not decoration; it
is feedback.

---

## The five laws

1. **Juice with a purpose.** An animation exists to answer a question the player
   is already asking: *did that work? what changed? is this good or bad?* If a
   motion doesn't answer one of those, cut it. (Trimming shrinks the canopy
   *because pruning removed mass*; a boost bounces the plant *because it just
   surged forward*. The motion is the receipt.)
2. **One canonical motion per meaning.** A positive plant event = the
   **squash-stretch bounce** (`gpe-plant-bounce`). Care landing on a zone = the
   **zone reaction** (`CARE_REACTIONS`, `PlantReactionLayer`). Don't invent a
   second bounce; reuse the one so the language stays legible.
3. **Anticipation → action → settle.** Every discrete motion has three beats: a
   small wind-up (squash/dip), the payoff (pop/overshoot), and a settle
   (recoil to rest, optionally a tiny overshoot). Skipping the wind-up is what
   makes an animation feel cheap.
4. **Layer, don't block.** Arcade motion is an **additive layer** over the
   server-authoritative sim — it never gates a tap, never changes what the sim
   computes, and never delays the mutation. Fire the feedback the instant the
   button is pressed (optimistic), before the network round-trip.
5. **Reduced-motion is not optional.** Every animated class is listed in the
   `prefers-reduced-motion: reduce` kill-switch in `globals.css`. Under reduced
   motion the *information* still lands (a state change, a color, a static glow)
   but the movement stops. No exceptions.

---

## Timing tiers (pick one; don't freelance durations)

| Tier | Duration | Easing | Use for |
|------|----------|--------|---------|
| **Tap** | 90–140 ms | `ease-out` | the instant press feedback on a button (tile flash, scale-down) |
| **Reaction** | 300–700 ms | spring / `cubic-bezier(0.34,1.56,0.64,1)` | the plant/zone responding to an action (the **boost bounce = 720 ms**) |
| **Celebration** | 800–1800 ms | ease-in-out + particles | harvest, level-up, cup win — the big moments only |
| **Ambient loop** | 3–8 s, infinite, `alternate` | `ease-in-out` | the always-on life of the scene (sway, glow breathe, drift) |

Ambient loops must be **cheap and calm** — they are the resting heartbeat, not an
event. If two ambient loops fight for the eye, one of them is wrong.

---

## The canonical motions (and where they live)

| Motion | Meaning | Impl |
|--------|---------|------|
| **Squash-stretch bounce** | a positive plant event (boost, big care win) | `@keyframes gpe-plant-bounce` (globals.css) + `usePlantBounce(ref)` — scales the plant `<canvas>` from the **pot base** (`transform-origin: 50% 88%`): dip `0.95` → pop `1.06/1.11` → recoil → settle |
| **Zone reaction** | care landed *here* (roots/stem/canopy) | `CARE_REACTIONS` (`careReactionsData.ts`) → `PlantReactionLayer` (pulse/rise/sparkle/guide/sweep/aura) |
| **Electric surge** | the ⚡ growth-boost fast-forwarded time | `gpe-electric-flash`/`gpe-electric-bolt` over the stage |
| **Boost aura + ring** | a boost multiplier is *active* (state, not event) | `BoostAmbientLayer` looped ring + sparkles, tinted from `BOOST_COLORS` |
| **Tile tap** | a care button was pressed | `gpe-tile-tap` + the `useCareFeedback` burst |
| **Ambient sway/glow** | the plant is alive | `gpe-anim-sway` / chamber glow (breathing rim) |

**Firing rule:** boosts dispatch `BOOST_APPLIED_EVENT` (`boostEngine`);
`usePlantBounce` listens and plays the bounce, and returns a `bounce()` so
non-arcade boosts (the ⚡ growth boost) reuse the exact same motion. Mount the
hook anywhere a plant canvas + boosts coexist so the feel is identical across the
chamber and the dashboard command center.

---

## Trimming has a purpose (worked example of Law 1)

Pruning is not a cosmetic sparkle. Its **purpose** is real and must read on screen:
- **Gameplay purpose (already live):** prune is once-per-stage, clears a slice of
  pest/disease pressure, and gives a small health nudge (`careAvailability.ts`
  gating + `game_service` prune effect). The UI already states the benefit
  ("Free — trims pests/disease, small health boost").
- **Animation purpose (the receipt):** the trim reaction should *show the removed
  mass* — a quick canopy sparkle **plus** the plant settling a touch lighter (a
  small inverse of the bounce: a brief relax, not a grow). The motion says
  "leaves came off," not just "something happened." Anything that only sparkles
  without communicating the trim is decoration and violates Law 1.

Apply the same test to every new arcade addition: **name the question the motion
answers before you build it.** If you can't, it doesn't ship.

---

## Adding a new arcade animation (checklist)

1. **State the purpose** — the one player question this motion answers.
2. **Pick a timing tier** (above). Don't invent a duration.
3. **Reuse a canonical motion** if the meaning already has one. Only add a new
   keyframe for a genuinely new meaning.
4. **Fire it optimistically** (on tap), decoupled via a window event — never
   thread a ref through the sim.
5. **Add the class to the reduced-motion kill-switch** in `globals.css`.
6. **Keep it additive** — no sim/economy change rides along with a visual.
7. Prove it: a screenshot/interaction check; the animation must not regress the
   care-loop e2e.

---

## Code map

- `web/src/app/globals.css` — all `@keyframes gpe-*` + the reduced-motion kill list.
- `web/src/hooks/usePlantBounce.ts` — the boost squash-stretch trigger.
- `web/src/components/plant/careReactionsData.ts` + `PlantReactionLayer.tsx` — zone reactions.
- `web/src/lib/arcade/boostEngine.ts` — `BOOST_APPLIED_EVENT`, boost state, cooldowns, `BOOST_COLORS`.
- `web/src/components/plant/BoostAmbientLayer.tsx` — the active-boost ambient loop.
- `web/src/components/plant/careFeedbackData.ts` + `CareFeedback.tsx` — the tap burst.
