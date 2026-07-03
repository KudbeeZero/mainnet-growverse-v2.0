// Offscreen-canvas stamp cache (Round 8 — "furrier pistils + denser frost").
//
// WHY: `ctx.drawImage()` of a pre-rendered canvas is a hardware-accelerated
// texture copy; re-running `createRadialGradient` + anti-aliased path fills
// every frame is CPU-bound. The pistil-hair and trichome-frost loops used to
// rebuild a gradient / fill a tapered path PER element PER frame — the exact
// cost that capped how many we could afford. So we pre-render ONE small sprite
// per (visual key, dpr) ONCE (built lazily on first use, module-level cache)
// and blit it many times. That lets the caller multiply the pistil count
// (furrier) and trichome count (denser sugar-coat) several-fold at a fraction
// of the old per-frame cost — "more detail should NOT cost more per frame".
//
// Two invariants from the research findings:
//   1. The offscreen buffer must fit SNUGLY around its content, or the copy
//      overhead eats the gain — each builder computes a tight bounding box.
//   2. Respect device-pixel-ratio — sprites are rendered at `dpr` resolution
//      and blitted at CSS size so they stay crisp on retina/mobile.
//
// Framework-agnostic: prefers `OffscreenCanvas`, falls back to a DOM
// `<canvas>`. In a headless env with neither (the @napi-rs/canvas PNG-gen
// script) `createBuffer` returns null and the blit helpers return false, so the
// caller cleanly falls back to its original direct-draw path.

import { TAU } from "./morphology";

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx2D = CanvasRenderingContext2D;

interface FilamentSprite {
  cv: AnyCanvas;
  cssW: number; // sprite width in CSS px (buffer px / dpr)
  cssH: number;
  rootX: number; // filament root anchor, in CSS px within the sprite
  rootY: number;
  len: number; // canonical filament length in CSS px (root→tip)
}
interface FrostSprite {
  cv: AnyCanvas;
  r0: number; // canonical radius in CSS px (blit scales to the real radius)
}

const filamentCache = new Map<string, FilamentSprite | null>();
const frostCache = new Map<string, FrostSprite | null>();

/** Drop every cached sprite (e.g. if the render surface / dpr changes wholesale). */
export function resetStampCache(): void {
  filamentCache.clear();
  frostCache.clear();
}

function createBuffer(wPx: number, hPx: number): { cv: AnyCanvas; cx: Ctx2D } | null {
  const w = Math.max(1, Math.ceil(wPx));
  const h = Math.max(1, Math.ceil(hPx));
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const cv = new OffscreenCanvas(w, h);
      const cx = cv.getContext("2d") as unknown as Ctx2D | null;
      return cx ? { cv, cx } : null;
    }
    if (typeof document !== "undefined") {
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const cx = cv.getContext("2d");
      return cx ? { cv, cx } : null;
    }
  } catch {
    /* headless / unsupported — caller direct-draws */
  }
  return null;
}

// ---- Tapered pistil filament ------------------------------------------------
// Canonical filament points UP (root at bottom-centre → fine tip at top), with
// a baked curl of `curlK` (fraction of length) so the blit only needs to rotate
// + scale + optionally mirror-X for the opposite curl direction. Shape mirrors
// the original per-frame tapered-wedge quadratic so the look is unchanged.

const FIL_LEN = 46; // canonical length in CSS px (hairs downscale from here → crisp)
const FIL_ROOT_HW = 1.35; // root half-width, CSS px
const FIL_BALL = 1.0; // tip ball radius, CSS px (fine tip, not a bead)

function buildFilament(fiberCol: string, ballCol: string, curlK: number, dpr: number): FilamentSprite | null {
  const tipDX = curlK * FIL_LEN;
  const pad = 2 + FIL_BALL;
  const cssW = 2 * (FIL_ROOT_HW + Math.abs(tipDX)) + 2 * pad;
  const cssH = FIL_LEN + 2 * pad;
  const buf = createBuffer(cssW * dpr, cssH * dpr);
  if (!buf) return null;
  const { cv, cx } = buf;
  cx.scale(dpr, dpr);

  const rootX = cssW / 2;
  const rootY = cssH - pad;
  const tipX = rootX + tipDX;
  const tipY = pad + FIL_BALL;
  // curved centreline control point (bows toward the curl side)
  const mx = (rootX + tipX) / 2 + tipDX * 0.55;
  const my = (rootY + tipY) / 2;
  // root half-width vector, perpendicular to the root→tip axis
  const dx = tipX - rootX, dy = tipY - rootY;
  const dl = Math.max(0.001, Math.hypot(dx, dy));
  const perpX = (-dy / dl) * FIL_ROOT_HW, perpY = (dx / dl) * FIL_ROOT_HW;

  cx.fillStyle = fiberCol;
  cx.beginPath();
  cx.moveTo(rootX - perpX, rootY - perpY);
  cx.quadraticCurveTo(mx - perpX * 0.35, my - perpY * 0.35, tipX, tipY);
  cx.quadraticCurveTo(mx + perpX * 0.35, my + perpY * 0.35, rootX + perpX, rootY + perpY);
  cx.closePath();
  cx.fill();
  // tiny pale tip ball (kept subtle — a fine amber thread, not a bead)
  cx.fillStyle = ballCol;
  cx.beginPath();
  cx.arc(tipX, tipY, FIL_BALL, 0, TAU);
  cx.fill();

  return { cv, cssW, cssH, rootX, rootY, len: FIL_LEN };
}

function getFilament(fiberCol: string, ballCol: string, curlBucket: number, dpr: number): FilamentSprite | null {
  const dq = Math.round(dpr * 4) / 4;
  const key = `${fiberCol}~${ballCol}~${curlBucket}~${dq}`;
  let spr = filamentCache.get(key);
  if (spr === undefined) {
    const curlK = curlBucket === 0 ? 0.08 : 0.2; // gentle vs fuller curl
    spr = buildFilament(fiberCol, ballCol, curlK, dq);
    filamentCache.set(key, spr);
  }
  return spr;
}

/**
 * Blit one tapered pistil filament. `angle` is the emergence direction (world),
 * `len` its length in CSS px, `bend` its signed curl (sign → curl side, |bend|
 * → curl amount). Returns false if no offscreen surface is available (headless)
 * so the caller can direct-draw instead.
 */
export function blitFilament(
  ctx: Ctx2D,
  x0: number,
  y0: number,
  angle: number,
  len: number,
  bend: number,
  fiberCol: string,
  ballCol: string,
  dpr: number,
): boolean {
  const curlBucket = Math.abs(bend) > 0.9 ? 1 : 0;
  const spr = getFilament(fiberCol, ballCol, curlBucket, dpr);
  if (!spr) return false;
  const s = len / spr.len;
  const sign = bend < 0 ? -1 : 1;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(angle + Math.PI / 2); // canonical points up (−Y) → align to angle
  ctx.scale(sign * s, s);
  ctx.drawImage(spr.cv, -spr.rootX, -spr.rootY, spr.cssW, spr.cssH);
  ctx.restore();
  return true;
}

// ---- Trichome frost glint ---------------------------------------------------
// A soft radial glint baked at full opacity; the caller supplies the per-spark
// alpha via ctx.globalAlpha at blit time (shimmer / density fade). One sprite
// per quantised core colour (a few maturity × purple buckets), reused for every
// spark — the whole point of the "thousands of trichomes" density lift.

const FROST_R = 22; // canonical radius, CSS px (sparks are small → downscale, crisp)

function parseRgb(col: string): string {
  // Accepts "rgb(r,g,b)" / "rgba(r,g,b,a)" → "r,g,b"
  const m = col.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  return m ? `${Math.round(+m[1])},${Math.round(+m[2])},${Math.round(+m[3])}` : "248,250,244";
}

function buildFrost(coreRgb: string, dpr: number): FrostSprite | null {
  const d = FROST_R * 2;
  const buf = createBuffer(d * dpr, d * dpr);
  if (!buf) return null;
  const { cv, cx } = buf;
  cx.scale(dpr, dpr);
  const g = cx.createRadialGradient(FROST_R, FROST_R, 0, FROST_R, FROST_R, FROST_R);
  // bright crystalline core, quick falloff (a resin glint, not a smoke ball)
  g.addColorStop(0, `rgba(${coreRgb},1)`);
  g.addColorStop(0.28, `rgba(${coreRgb},0.82)`);
  g.addColorStop(0.6, `rgba(${coreRgb},0.18)`);
  g.addColorStop(1, `rgba(${coreRgb},0)`);
  cx.fillStyle = g;
  cx.beginPath();
  cx.arc(FROST_R, FROST_R, FROST_R, 0, TAU);
  cx.fill();
  return { cv, r0: FROST_R };
}

function getFrost(coreRgb: string, dpr: number): FrostSprite | null {
  const dq = Math.round(dpr * 4) / 4;
  const key = `${coreRgb}~${dq}`;
  let spr = frostCache.get(key);
  if (spr === undefined) {
    spr = buildFrost(coreRgb, dq);
    frostCache.set(key, spr);
  }
  return spr;
}

/**
 * Blit one frost glint of radius `r` centred at (x,y) with opacity `alpha`.
 * `core` is any rgb/rgba colour string (the resin-head colour). Returns false
 * when no offscreen surface exists (headless) so the caller can direct-draw.
 */
export function blitFrost(
  ctx: Ctx2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
  core: string,
  dpr: number,
): boolean {
  const spr = getFrost(parseRgb(core), dpr);
  if (!spr) return false;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(spr.cv, x - r, y - r, r * 2, r * 2);
  ctx.restore();
  return true;
}

// ---- Perlin-ish value-noise flow field --------------------------------------
// Drives pistil emergence direction (and frost drift) along a smoothly-varying
// field so filaments read as coherent local growth — curling in the same
// direction as their neighbours — instead of confetti. Cheap seeded 1D value
// noise over the emergence angle, smoothstep-interpolated and wrapped so it's
// continuous around the cluster. Deterministic per seed → no frame-to-frame
// shimmer (the field is baked into the geometry at build time).

/**
 * Build an angular flow field from a mulberry32-style unit RNG. Returns a
 * sampler `(theta) => v` with v in [-1,1] varying smoothly (and continuously)
 * as theta sweeps 0..2π.
 */
export function makeFlowField(rnd: () => number, cells = 14): (theta: number) => number {
  const g = new Float64Array(cells + 1);
  for (let i = 0; i < cells; i++) g[i] = rnd() * 2 - 1;
  g[cells] = g[0]; // wrap for angular continuity
  return (theta: number) => {
    const t = ((((theta % TAU) + TAU) % TAU) / TAU) * cells;
    const i = Math.floor(t);
    const f = t - i;
    const s = f * f * (3 - 2 * f); // smoothstep
    return g[i] + (g[i + 1] - g[i]) * s;
  };
}
