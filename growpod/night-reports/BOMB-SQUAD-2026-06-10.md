# BOMB SQUAD REPORT — 2026-06-10

## 🗺️ SITUATION NOTE (read first)

No `night-reports/NIGHT-AUDIT-*.md` exists — this is the first night shift, so targets
came from the standing known-scary list. **The standing list describes code that does not
exist in this repo**: there is no `buildPlant`/`buildFlowerSite`, no strain day-slider,
no climate math anywhere (`grep` confirms). The one real device matching the list's
mechanisms is `web/src/components/viz/Constellation.tsx` — the signature canvas viz with
a hand-rolled RAF loop, force physics, pointer capture, and dpr/resize handling, used on
6 call sites across 4 pages (breed, strain detail, genbank, onboarding). The standing
list was mapped onto it:

| Standing item | Maps to | Status |
|---|---|---|
| 1. RAF loop stacking / re-init | Constellation RAF lifecycle | Recon'd — **inert**, tripwired |
| 2. Physics ↔ plant array desync | No analog (rebuild = full effect re-run; `eList`/`particles` rebuilt together, no mid-frame path) | Inert by construction |
| 3. Pointer capture lifecycle | Constellation `dragging` flag | **DEFUSED** |
| 4. dpr/resize transform corruption | Constellation `resize()` backing-store wipe | **DEFUSED** (reduced-motion blank canvas) |
| 5. Seeded RNG consumption order | No seeded RNG exists (only `Math.random` cosmetic jitter) | N/A |
| 6. Day-scrub allocation storm | No day slider exists | N/A |

Test-infrastructure reality: `web/vitest.config.ts` and two test files exist, but vitest
is not a dependency, `npm test` is a stub, and CI runs only typecheck/lint/build for web.
Tripwires were therefore written as **source-contract tests** (node env, zero new
dependencies, repo's existing `src/**/__tests__/*.test.ts` convention) and executed
locally via `npm install --no-save vitest@2.1.9` (nothing added to package.json/lockfile).
Component-level DOM tripwires (firing real pointer events through a rendered component)
are impossible here without adding jsdom — flagged in long-term fixes.

## 💣 DEFUSED

### 1. Reduced-motion blank canvas (`Constellation.tsx` `resize()`) — commit `53f7941`

**Device diagram.** The `prefers-reduced-motion` path settles physics off-screen and
draws exactly ONE static frame — no loop. `resize()` sets `canvas.width`, which per the
HTML spec erases the backing store. `ResizeObserver.observe()` always delivers an initial
**async** callback. Sequence: effect → `resize()` → `observe()` → settle ×220 → `draw()`
→ *(async)* RO initial callback → `resize()` → backing store wiped → nothing ever draws
again. **Every reduced-motion user saw a permanently blank canvas** on all 6 call sites;
any later container resize (orientation change, sidebar) re-wiped it. Scary because it
sits in the dpr/transform/resize nexus where a wrong cut produces one-frame-wrong-scale
artifacts in the animated path.

**The cut.** One guarded line at the end of `resize()`: `if (reduced) draw();` —
synchronous repaint after the backing-store reset. Animated path byte-identical (guard
false; next RAF repaints as before).

**Proof of inert.** `draw` is a hoisted function declaration; every closure variable it
reads (`ctx, w, h, dpr, particles, eList, hovered, userScale, panX, panY`) is initialized
before the first `resize()` call; run-to-completion means the intermediate first-call
draw never paints. Tripwires (incl. sacred-render hashes over `leafParticles` /
`graphParticles` / `step` / `draw`) green; typecheck/lint/build green. Regression sensor:
`resize repaints the static frame in reduced-motion mode`.

### 2. Stranded drag on pointercancel (`Constellation.tsx`) — commit `5443853`

**Device diagram.** `dragging=true` set on pointerdown with capture; reset only by
`pointerup`/`pointerleave`. When the browser hijacks the pointer mid-drag (touch scroll
takeover, system gesture, pen out of range) it fires `pointercancel` — unhandled. The
spec mandates pointerleave after cancel, but engines (Safari, older Chromium) have
skipped it under active capture. A stranded flag makes every later buttonless hover pan
the view and, in leaf mode, inject velocity into nearby particles indefinitely — the
"plant won't stop shaking" failure, invisible until it happens. Recon revised risk
HIGH → MEDIUM (spec-compliant engines self-heal via the existing pointerleave handler).

**The cut.** Wire `pointercancel` → existing `onUp` + symmetric removal in cleanup.
Purely additive: an event that previously had no handler. `onUp`'s
`releasePointerCapture` is already try/caught for the post-cancel implicit release.

**Proof of inert.** Listener-symmetry tripwire (added set == removed set) green; sacred
hashes green; all CI web gates green. Regression sensor: `handles pointercancel…`.

### 3. RAF loop stacking — recon verdict: **INERT, no cut** (tripwired in `3b2c583`)

Both `requestAnimationFrame(loop)` sites assign the single `raf` handle synchronously in
the scheduling callback; cleanup cannot interleave mid-callback (run-to-completion), so
`cancelAnimationFrame(raf)` always cancels the genuinely-pending frame. Effect re-runs
(strain→strain `graphKey` changes) run old cleanup before the new body — no second loop.
Strict-mode double-invoke pairs correctly. Reduced path schedules nothing
(`cancelAnimationFrame(0)` is a no-op). Tripwire now enforces: every RAF schedule must
assign the cancellable `raf` handle, and cleanup must cancel + disconnect.

## 🧨 ATTEMPTED — REVERTED

None. All cuts held on first attempt; no tripwire fired.

## 🚧 STILL ARMED (updated risk read after recon)

- **None of the original 🔴 list remains live in this repo** (see situation table).
- 🟡 `reduced` (prefers-reduced-motion) is sampled once per effect mount; toggling the OS
  preference mid-session isn't honored until remount. Stale preference, not a stacking
  risk. Needs a `matchMedia` change listener — new trigger path, not a minimal cut.
- 🟡 In reduced-motion mode, wheel-zoom and pan mutate `userScale`/`panX/panY` without a
  repaint (now repaints only on resize). Pre-existing; interactions in reduced mode
  should either repaint on demand or be disabled.
- 🟡 Graph-mode particles have no position clamp (leaf mode clamps ±2.5). Gravity +
  damping bound them in practice; a NaN in input weights would propagate silently.

## 📐 LONG-TERM FIXES RECOMMENDED

1. **Make web tests real**: add `vitest` (+ `jsdom` + `@testing-library/react`) as web
   devDependencies and a CI step — three test files now exist that CI never executes.
   With jsdom, replace the source-contract tripwires with behavioral ones (dispatch real
   `pointercancel`, assert pan stops; mock RO, assert redraw).
2. **Reduced-motion as a live signal**: subscribe to the `matchMedia` change event and
   re-init, replacing the per-mount snapshot.
3. **Repaint-on-demand for reduced mode** instead of repaint-on-resize-only (cover
   hover/zoom/pan), or disable interactions when static.
4. The sacred-render hash tripwire is intentionally brittle: an *intentional* visual
   change must update the hashes in the same commit. That's the sensor working, but once
   jsdom tests exist, pixel/geometry snapshots are the better instrument.
