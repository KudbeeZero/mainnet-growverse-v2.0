// Lifecycle tripwires for Constellation.tsx.
//
// The component is a hand-rolled Canvas 2D effect (RAF loop, pointer capture,
// ResizeObserver) that can't be rendered under the node test environment, so
// these tests pin the *source contracts* that the lifecycle depends on:
//
//   1. Listener symmetry — every canvas event type that is addEventListener'd
//      is also removeEventListener'd in the effect cleanup. An asymmetric edit
//      leaks a handler across effect re-runs (graphKey/strain navigation).
//   2. Single-RAF contract — every requestAnimationFrame call assigns to the
//      one `raf` handle that the cleanup cancels. An unassigned schedule is an
//      uncancellable second loop: double-stepped physics on every re-init.
//   3. Cleanup contract — the effect tears down the RAF, the ResizeObserver,
//      and its listeners.
//   4. Sacred-render hash — the geometry/physics/render functions
//      (leafParticles, graphParticles, step, draw) are pinned by content hash.
//      Lifecycle/safety fixes must not change a pixel of the look; if you are
//      *intentionally* changing the visuals, update the hashes below in the
//      same commit and say so in the commit body.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "Constellation.tsx"),
  "utf8",
);

/** All event names passed to canvas.add/removeEventListener("<name>", ...). */
function listenerNames(kind: "addEventListener" | "removeEventListener"): string[] {
  return [...SRC.matchAll(new RegExp(`\\.${kind}\\("([a-z]+)"`, "g"))].map((m) => m[1]).sort();
}

/** Extract a top-level function body by brace matching (no strings with stray braces in these). */
function functionBody(name: string): string {
  const idx = SRC.indexOf(`function ${name}`);
  expect(idx, `function ${name} should exist`).toBeGreaterThanOrEqual(0);
  const open = SRC.indexOf("{", idx);
  let depth = 0;
  let i = open;
  for (; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = SRC.slice(open, i + 1);
  expect(body.length, `extracted ${name} body should be non-trivial`).toBeGreaterThan(100);
  return body;
}

describe("Constellation lifecycle contracts", () => {
  it("removes every listener it adds (no leaks across effect re-runs)", () => {
    const added = listenerNames("addEventListener");
    const removed = listenerNames("removeEventListener");
    expect(added.length).toBeGreaterThanOrEqual(6);
    expect(removed).toEqual(added);
  });

  it("handles pointercancel so an interrupted drag cannot strand `dragging`", () => {
    // Without this, a browser-hijacked pointer (touch scroll takeover, pen out
    // of range) on an engine that skips the post-cancel pointerleave leaves
    // dragging=true: every later buttonless hover pans and injects velocity.
    expect(listenerNames("addEventListener")).toContain("pointercancel");
  });

  it("every requestAnimationFrame assigns the cancellable `raf` handle", () => {
    const schedules = [...SRC.matchAll(/(\S+\s*=\s*)?requestAnimationFrame\(/g)];
    expect(schedules.length).toBeGreaterThanOrEqual(1);
    for (const m of schedules) {
      expect(m[1]?.trim(), `unassigned schedule at …${SRC.slice(m.index! - 20, m.index! + 30)}…`).toBe(
        "raf =",
      );
    }
  });

  it("cleanup cancels the RAF and disconnects the ResizeObserver", () => {
    expect(SRC).toContain("cancelAnimationFrame(raf)");
    expect(SRC).toContain("ro.disconnect()");
  });

  it("resize repaints the static frame in reduced-motion mode", () => {
    // Setting canvas.width clears the backing store; ResizeObserver.observe()
    // always fires an initial async callback after the one reduced-motion
    // draw. Without a synchronous repaint, reduced-motion users get a
    // permanently blank canvas.
    expect(functionBody("resize")).toContain("if (reduced) draw()");
  });

  it("does not touch the sacred geometry/physics/render functions", () => {
    // draw() hash intentionally updated (owner: mobile particles read as
    // "huge" and the effect "ran very slow"): the per-particle draw now blits
    // a cached glow+core sprite (getGlowSprite) instead of rebuilding a
    // createRadialGradient every frame, and scales the blit by `sizeScale`
    // (viewport-proportional, was a fixed pixel size regardless of screen
    // width — the actual cause of the mobile "huge blobs" read) with a
    // gradient fallback for headless/unsupported canvases. Pixel output is
    // the same shape/color, just computed differently and now correctly
    // proportional — leafParticles/graphParticles/step are untouched.
    const expected: Record<string, string> = {
      leafParticles: "4730224577faa700724cae8f16b880dc6697b8c947670cc7a302d01b48a66d21",
      graphParticles: "17e3fc14e098d0f3f1a68f938252cedcc274dd1d8ee72d74abbfbbfd03e5a0de",
      step: "7ea722e92cc4757851cb0f61ce3927cd3d3da0a0c2671c8c190a352b8ab332cf",
      draw: "6bf9e53a37040adf47c09cf49c3c9c51e95f7fba11f6ea32c088c30f92d5f80e",
    };
    for (const [name, hash] of Object.entries(expected)) {
      expect(
        createHash("sha256").update(functionBody(name)).digest("hex"),
        `${name} body changed — the look is sacred; see file header`,
      ).toBe(hash);
    }
  });
});
