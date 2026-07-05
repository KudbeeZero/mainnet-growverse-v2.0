// GROVERS Grow Chamber core — framework-agnostic Canvas 2D renderer extracted
// VERBATIM from the GrowChamber React component's effect closure so the same
// rendering/build/physics logic can be driven by the browser component AND by a
// headless Node script (e.g. @napi-rs/canvas). This is a faithful relocation:
// no drawing math, constants, colors, or geometry has changed.
//
// The caller owns the canvas + DPR transform; this core only stores W/H (via
// setSize) and draws into the provided 2D context.

import {
  TAU,
  lerp,
  clamp,
  smooth,
  mulberry32,
  climateModel,
  type ClimateInput,
  type DevParams,
  type Morphology,
  type BudColor,
  type Silhouette,
} from "./morphology";
import { pickPaletteColor, dominantPaletteColor, type BudDNA } from "./budDna";
import { phyllotaxis, foreshorten, depthShade } from "./phyllotaxy";
import {
  maturityMix,
  maturityFor,
  trichHeadColor,
  shimmer,
  budSiteDensity,
  SHIMMER_MAX_AMP,
} from "./trichomes";
import { colaTops } from "./apicalDominance";
import { calyxShapeFor, type CalyxShape } from "./calyxShape";
import { earlyStageBoost } from "./earlyStage";
import { CONDITION_VISUALS, SEVERITY_SCALE, dominantFlag } from "../conditionVisuals";
import {
  branchFlex as branchFlexFor,
  branchDroop,
  colaLean,
  flowerStageMultiplier,
  airflowWeighting,
} from "./budPhysics";
import type { ConditionFlag, GrowthStage } from "../types";

export type ChamberView = "chamber" | "macro" | "plant3d";

export interface LiveState {
  climate: ClimateInput;
  dev: DevParams;
  flags: ConditionFlag[];
  budColor: BudColor;
  budDna: BudDNA;
}

interface Cluster {
  yf: number;
  along: number;
  lateral: number;
  fat: number;
  tipTaper: number;
  centerBias: number;
  pods: Array<{ ring: number; a: number; rad: number; k: number; sz: number; dl: number; dh: number; blushK: number; parity: number; shape: CalyxShape }>;
  // `seam`: the grouped calyx-seam root angle this hair emerges from
  // (reference "Pistil Hair Breakdown" items 1-2 — grouped origin points,
  // never floating); several hairs per cluster share the same seam.
  // `curl`: secondary tip-hook offset layered on top of `bend`'s mid-length
  // arch so the filament reads as an organic S/curl rather than a single arc
  // (item 4). `mat`: per-hair maturity roll driving the pale-cream→orange
  // colour spread so one bud shows a MIX of young and ripe strands (item 8).
  hairs: Array<{ a: number; seam: number; len: number; bend: number; curl: number; ball: number; k: number; mat: number }>;
  tris: Array<{ a: number; r: number; v: number; sz: number; k: number; mat: number; spk: number }>;
  ph: number;
  leaf: boolean;
  leafSide: number;
}
interface FlowerSite {
  axisLen: number;
  baseW: number;
  clusters: Cluster[];
  pat: string;
}

// Macro ("Detailed Bud View") cola: a dense stack of small, overlapping calyxes
// arranged in layered rows around a central spine, rather than a few large
// teardrops. Painter's-algorithm depth (0 back → 1 front) gives the cola volume.
// shape: 0 teardrop · 1 oval · 2 pointed bract · 3 foxtail
interface MacroCalyx {
  x: number; y: number; w: number; h: number; rot: number;
  depth: number; hue: number; sat: number; lit: number; shape: number; phase: number;
}
interface MacroPistil { x: number; y: number; a: number; len: number; bend: number; k: number }
interface MacroTrich { x: number; y: number; r: number; k: number; mat: number; depth: number }
interface MacroLeaf { x: number; y: number; sz: number; rot: number }
interface MacroBud {
  centerX: number; baseY: number; topY: number; budH: number; budW: number;
  coreHue: number; coreSat: number;
  calyxes: MacroCalyx[]; pistils: MacroPistil[]; trichs: MacroTrich[]; sugar: MacroLeaf[];
}

export interface ChamberCoreOpts {
  ctx: CanvasRenderingContext2D;
  motionOK: boolean;
  seed: number;
  day: number;
  stage: GrowthStage;
  morphology: Morphology;
  silhouette: Silhouette;
  view: ChamberView;
  live: { current: LiveState };
}

export interface ChamberCore {
  setSize(w: number, h: number): void;
  draw(tt: number): void;
  step(dt: number): void;
  pointerDown(x: number, y: number): void;
  pointerMove(x: number, y: number, nowMs: number): void;
  pointerUp(): void;
}

// Pure, exported so the "black blob" clamp fix (2026-07-04) has a real
// regression test — see __tests__/chamberCore.test.ts. Pods and leaf fans
// each sum several independent darkening terms (ring depth/tip-blend/parity
// for pods; litBias/topBoost/depth for leaves) that can land in the same
// direction at once and push lightness at or below 0, which canvas silently
// clips to solid black instead of a dark shade. These bound the final sum to
// a safe range before it reaches any hsl() call.
export function clampPodLightness(raw: number): number {
  return clamp(raw, 26, 58);
}
export function clampLeafLightness(raw: number): number {
  return clamp(raw, 10, 78);
}

export function createChamberCore(opts: ChamberCoreOpts): ChamberCore {
  const ctx = opts.ctx;
  const motionOK = opts.motionOK;
  const S = opts.morphology;
  const SK = opts.silhouette;
  const seed = opts.seed;
  const day = opts.day;
  const stage = opts.stage;
  const view = opts.view;
  const live = opts.live;
  let W = 0;
  let H = 0;

  // ---- fan-leaf tone ----
  // Base foliage colour is the strain morphology; in flower it deepens (mature
  // fans darken) and, for strains whose bud identity is cool/desaturated teal
  // (e.g. Blue Dream, calyxHue ≳ 140), the fans shift toward a deep blue-green
  // to match the reference. Green strains (calyxHue ≈ 100–128) are unchanged.
  // Recomputed once per draw from the live bud colour + development.
  const leafTone = { hue: S.hue, sat: S.sat, litBias: 0, arch: 0 };
  function refreshLeafTone() {
    const bc = live.current.budColor;
    const mature = clamp(live.current.dev.budDev, 0, 1);
    const teal = clamp(((bc?.calyxHue ?? S.hue) - 130) / 40, 0, 1);
    // Deep mature-fan tone (owner reference: harvest fans are a DEEP, muted
    // blue-green, not bright saturated grass). Teal strains shift furthest and
    // DESATURATE toward sage; green strains only pick up the mature darkening.
    // Round 3 (owner mockup): richer, deeper canopy green for everyone — a
    // flat +sat/−lit shift in the RENDERER (strain hues untouched, so Blue
    // Dream / G13 / White Rhino keep their identities); the mockup's fans are
    // a deep saturated green, ours read a touch bright and washed.
    leafTone.hue = S.hue + teal * 52;
    leafTone.sat = Math.min(70, S.sat + 7 - teal * 8);
    leafTone.litBias = -3 - mature * 9 - teal * 9;
    // Mature fans arch over; deeper for the flowering canopy.
    leafTone.arch = 0.1 + mature * 0.16;
  }

  // ---- leaflet outline (pure shape) ----
  const LEAF_OUT: Array<[number, number]> = (() => {
    const pts: Array<[number, number]> = [];
    const SEG = 13;
    for (let i = 1; i < SEG; i++) {
      const t = i / SEG;
      const env = Math.sin(Math.PI * Math.pow(t, 0.85));
      // Mockup pass: deeper serration (0.68 → 0.62) so the sawtooth edge that
      // says "cannabis fan leaf" survives at phone size.
      const serr = t > 0.1 && t < 0.94 ? (i % 2 ? 1 : 0.62) : 1;
      pts.push([env * serr * 0.5, t]);
    }
    return pts;
  })();
  // `curl` bows the blade downward (tip pulled back toward the base plane) so a
  // fan leaf arches over instead of standing as a flat spike — real mature fan
  // leaves droop under their own weight. 0 = straight blade.
  function leafletPath(L: number, Wd: number, curl = 0) {
    const bow = (t: number) => curl * L * t * t; // droop grows toward the tip
    ctx!.beginPath();
    ctx!.moveTo(0, 0);
    for (const [hw, t] of LEAF_OUT) ctx!.lineTo(hw * Wd, -t * L + bow(t));
    ctx!.lineTo(0, -L + bow(1));
    for (let i = LEAF_OUT.length - 1; i >= 0; i--) {
      const [hw, t] = LEAF_OUT[i];
      ctx!.lineTo(-hw * Wd, -t * L + bow(t));
    }
    ctx!.closePath();
  }

  // ---- bract pod: pointed elongated teardrop/diamond (Engine: cola construction
  // v2, reference "Bract/Calyx Scale Breakdown" item 1) ----
  // Round 6 and earlier used a wide, rounded bulb (max width ~0.92w at the
  // vertical MIDPOINT, gentle bezier curve to a blunt tip) — at chamber scale
  // that read as a round berry, not a bract. Real cannabis bracts are a
  // narrow-based, pointed elongated diamond: a rounded base widens quickly to
  // a shoulder about a third of the way up, then tapers in a long straight
  // run to a sharp needle tip. Shoulder pulled up (was mid-height, now ~30%
  // up from the base) and the tip extended/sharpened (was a rounded -0.6h
  // bulb, now a true point at -0.86h) so the silhouette reads as a scale, not
  // a berry — this is the single highest-leverage fix for the "spiky
  // separated fingers / floating blob" complaint from prior rounds.
  function podPath(w: number, h: number) {
    ctx!.beginPath();
    ctx!.moveTo(0, h * 0.5); // rounded base
    ctx!.bezierCurveTo(-w * 0.78, h * 0.32, -w * 0.98, -h * 0.06, -w * 0.52, -h * 0.44); // shoulder
    ctx!.quadraticCurveTo(-w * 0.14, -h * 0.74, 0, -h * 0.86); // sharp tip (left run)
    ctx!.quadraticCurveTo(w * 0.14, -h * 0.74, w * 0.52, -h * 0.44); // sharp tip (right run)
    ctx!.bezierCurveTo(w * 0.98, -h * 0.06, w * 0.78, h * 0.32, 0, h * 0.5); // shoulder back to base
    ctx!.closePath();
  }
  // Calyx body by sprite type: 0 teardrop · 1 oval · 2 pointed bract · 3 foxtail.
  function calyxPath(shape: number, w: number, h: number) {
    if (shape === 1) {
      ctx!.beginPath();
      ctx!.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, TAU);
      return;
    }
    if (shape === 2) {
      // pointed bract — sharper tip
      ctx!.beginPath();
      ctx!.moveTo(0, h * 0.5);
      ctx!.bezierCurveTo(-w * 0.8, h * 0.25, -w * 0.5, -h * 0.5, 0, -h * 0.72);
      ctx!.bezierCurveTo(w * 0.5, -h * 0.5, w * 0.8, h * 0.25, 0, h * 0.5);
      ctx!.closePath();
      return;
    }
    podPath(w, h); // teardrop (0) and foxtail (3, already elongated via h)
  }
  function drawPod(x: number, y: number, rot: number, w: number, h: number, hue: number, sat: number, litIn: number, capA: number, shape: CalyxShape = 0) {
    // Enforced here, not just at the call site (code-review fix, 2026-07-04):
    // the gradient stops below push lit further in both directions (+8/-16 at
    // the 0/1 stops), so a caller passing an already-safe value can still get
    // crushed toward black by this function's own math. Clamping the input
    // once, right where the unguarded hsl() calls actually live, means any
    // future caller is protected by construction instead of by convention.
    const lit = clampPodLightness(litIn);
    ctx!.save();
    ctx!.translate(x, y);
    ctx!.rotate(rot);
    // Round 8c (owner: "the layering in the texture" — the cola read as a
    // smooth blended blob, not a stack of individually lit scales). The old
    // `w > 4.2` gate meant almost every pod took the flat single-hsl() fill
    // below (podW is CLAMPED to a 4.2 ceiling, so only a rare oversized-jitter
    // pod ever cleared it) — the volumetric gradient this file's own comments
    // describe as "the single highest-leverage fix" was effectively dead code
    // at real render sizes. Every pod now gets the gradient.
    const g = ctx!.createRadialGradient(-w * 0.22, -h * 0.24, w * 0.08, 0, 0, w * 1.15);
    g.addColorStop(0, `hsl(${hue}, ${Math.min(80, sat + 6)}%, ${Math.min(64, lit + 8)}%)`);
    g.addColorStop(0.55, `hsl(${hue}, ${sat}%, ${lit}%)`);
    g.addColorStop(1, `hsl(${hue}, ${Math.min(88, sat + 16)}%, ${Math.max(10, lit - 16)}%)`);
    ctx!.fillStyle = g;
    calyxPath(shape, w, h);
    ctx!.fill();
    // Shingle "undercut" shadow — the base third of every bract tucks under
    // the tier above it in the stack (see the tip-first/base-last paint order
    // in drawFlowerSite). A soft dark wash there, independent of the radial
    // gradient above (which shades by LIGHT DIRECTION, not stack position), is
    // what makes overlapping bracts read as physically layered scales instead
    // of blending into one smooth mass — the read the reference calls a
    // shingled/scaled surface, not a teardrop gradient.
    const undercut = ctx!.createLinearGradient(0, h * 0.06, 0, h * 0.5);
    undercut.addColorStop(0, `hsla(${hue}, ${sat}%, ${Math.max(6, lit - 8)}%, 0)`);
    undercut.addColorStop(1, `hsla(${hue}, ${Math.min(90, sat + 10)}%, ${Math.max(4, lit - 22)}%, 0.5)`);
    ctx!.fillStyle = undercut;
    calyxPath(shape, w, h);
    ctx!.fill();
    ctx!.strokeStyle = "rgba(0,0,0,0.24)";
    ctx!.lineWidth = Math.max(0.4, w * 0.05);
    ctx!.stroke();
    // Inner cap — the lighter, younger calyx tip peeking out (kept subtle/matte).
    ctx!.translate(0, -h * 0.14);
    ctx!.scale(0.55, 0.48);
    ctx!.fillStyle = `hsla(${hue}, ${sat * 0.9}%, ${Math.min(64, lit + 8)}%, ${capA})`;
    calyxPath(shape, w, h);
    ctx!.fill();
    ctx!.restore();
    // Round 8c: gate lowered 2.2 → 1.2 — podW's own ceiling is 4.2 and most
    // pods render well under 2.2 once size jitter (p.sz) and reveal (g) scale
    // it down, so the old gate silently skipped this layer (tip brightening +
    // ridge vein) on the majority of bracts, leaving only the undercut shadow
    // above to carry any per-pod depth. Only the smallest slivers (w<1.2) skip
    // it now, where a linear gradient + stroke would be sub-pixel noise anyway.
    if (w > 1.2) {
      // Reference "Bract/Calyx Scale Breakdown" items 4 & 7: a faint central
      // ridge/vein tip→base (not a flat colour fill), and the bract's OWN
      // surface intensifying — brighter/more saturated toward its tip,
      // muted toward its base — reinforcing the whole-cola purple gradient
      // (see drawFlowerSite's per-pod tipBlend) at single-bract granularity.
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.rotate(rot);
      const tipGlow = ctx!.createLinearGradient(0, h * 0.5, 0, -h * 0.86);
      tipGlow.addColorStop(0, `hsla(${hue}, ${sat * 0.4}%, ${Math.max(8, lit - 8)}%, 0)`);
      tipGlow.addColorStop(1, `hsla(${hue}, ${Math.min(92, sat + 20)}%, ${Math.min(74, lit + 16)}%, 0.3)`);
      ctx!.fillStyle = tipGlow;
      calyxPath(shape, w, h);
      ctx!.fill();
      ctx!.strokeStyle = `hsla(${hue}, ${Math.max(10, sat - 22)}%, ${Math.max(5, lit - 24)}%, 0.4)`;
      ctx!.lineWidth = Math.max(0.4, w * 0.045);
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(0, h * 0.44);
      ctx!.lineTo(0, -h * 0.78);
      ctx!.stroke();
      ctx!.restore();
    }
  }
  // Pistil colour (reference "Pistil Hair Breakdown" item 8 — pale/cream when
  // young, shifting to orange-pink as maturity progresses). `w` is now a
  // PER-HAIR maturity (0 = fresh cream stigma, 1 = ripe orange) rather than a
  // single per-cluster ripeness, so a mature cola renders a MIX of pale and
  // orange strands. Endpoints tuned toward a warmer orange target (was a
  // muddier amber): young 248/242/222 cream → ripe 235/118/44 orange. `brown`
  // deepens over-ripe strands; `mag` blends toward orange-pink for the rare
  // strains that express pistilMagenta (independent of anthocyanin).
  function pistilFiber(w: number, brown: number, mag: number) {
    let r = lerp(248, 235, w), g = lerp(242, 118, w), b = lerp(222, 44, w);
    r = lerp(r, 150, brown); g = lerp(g, 86, brown); b = lerp(b, 46, brown);
    r = lerp(r, 234, mag); g = lerp(g, 82, mag); b = lerp(b, 150, mag);
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  function pistilBall(w: number, brown: number, mag: number) {
    let r = lerp(252, 248, w), g = lerp(246, 156, w), b = lerp(232, 74, w);
    r = lerp(r, 186, brown); g = lerp(g, 114, brown); b = lerp(b, 58, brown);
    r = lerp(r, 246, mag); g = lerp(g, 124, mag); b = lerp(b, 178, mag);
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  // Hue/sat blend for the base→tip purple gradient (see drawFlowerSite's
  // per-pod tipBlend), done in RGB space rather than HSL degree-space.
  // Interpolating the hue ANGLE directly (green ~130° toward magenta ~292°)
  // necessarily sweeps through a fully-saturated intermediate hue — either
  // blue (~short way) or a hot, neon red/orange (~long way) — because a flat
  // hsl() fill has no way to "mix pigments". Real anthocyanin transitions
  // read as a muted, DESATURATED dusty maroon in between (chlorophyll green
  // fading as anthocyanin rises, not a rainbow sweep), which is what
  // blending in RGB space naturally produces (the same reason the fused-mass
  // canvas gradient — built from hsl() colour-stops the browser resolves to
  // RGB before interpolating — already reads correctly).
  function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
    const S = s / 100, L = l / 100;
    const c = (1 - Math.abs(2 * L - 1)) * S;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = L - c / 2;
    let r = 0, g = 0, b = 0;
    const hh = ((h % 360) + 360) % 360;
    if (hh < 60) { r = c; g = x; b = 0; }
    else if (hh < 120) { r = x; g = c; b = 0; }
    else if (hh < 180) { r = 0; g = c; b = x; }
    else if (hh < 240) { r = 0; g = x; b = c; }
    else if (hh < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  function rgb2hueSat(r: number, g: number, b: number): [number, number] {
    const R = r / 255, G = g / 255, B = b / 255;
    const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min, l = (max + min) / 2;
    if (d === 0) return [0, 0];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h: number;
    if (max === R) h = 60 * (((G - B) / d) % 6);
    else if (max === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
    if (h < 0) h += 360;
    return [h, s * 100];
  }
  function blendHueSat(h0: number, s0: number, h1: number, s1: number, t: number): [number, number] {
    if (t <= 0) return [h0, s0];
    if (t >= 1) return [h1, s1];
    const [r0, g0, b0] = hsl2rgb(h0, s0, 50);
    const [r1, g1, b1] = hsl2rgb(h1, s1, 50);
    return rgb2hueSat(lerp(r0, r1, t), lerp(g0, g1, t), lerp(b0, b1, t));
  }
  // ---- tapered branch stroke (round 9 pass 2, "branches render as flat,
  // uniform-width ribbons" complaint) ----
  // Canvas has no native variable-width stroke; the main STEM already fakes
  // one by walking its pre-built multi-point spine and giving each short
  // segment its own interpolated lineWidth (see the p.spine loop in
  // drawPlant). Branches aren't a pre-built polyline, though — each is one
  // cubic bezier evaluated fresh every frame — so this samples that same
  // bezier into short straight segments and applies the same "own lineWidth
  // per segment" trick, thick at the trunk-facing root (t=0) easing down to a
  // thin bud-facing tip (t=1). Width is lerp(w0,w1,t^exp) with w0>w1, so the
  // *rate* of narrowing follows t^exp's derivative: an exponent >1 is shallow
  // near t=0 and steep near t=1 (code-review fix, 2026-07-04 — the original
  // 0.72 exponent was <1, which does the opposite: steep near the root, flat
  // near the tip, thinning out immediately after the trunk instead of
  // holding width through the middle). 1.4 keeps most of the width through
  // the branch's middle, narrowing hardest only in the last stretch, so it
  // reads as a tapering woody limb rather than thinning evenly like a
  // deflating balloon.
  // Shared with the STEM's own segment-taper loop below (code-review fix,
  // 2026-07-04 — both used to hand-roll the identical lerp(w0,w1,t^exp)
  // one-liner independently, which could silently drift out of sync on a
  // future retune). Each site keeps its own exponent/width inputs; only the
  // formula itself is shared.
  function taperWidth(t: number, w0: number, w1: number, exp: number): number {
    return lerp(w0, w1, Math.pow(t, exp));
  }
  function bezierAt(
    p0x: number, p0y: number, p1x: number, p1y: number,
    p2x: number, p2y: number, p3x: number, p3y: number, t: number,
  ): [number, number] {
    const mt = 1 - t;
    const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return [a * p0x + b * p1x + c * p2x + d * p3x, a * p0y + b * p1y + c * p2y + d * p3y];
  }
  // Samples a bezier into `steps+1` points (including the start point) so a
  // caller that needs the SAME curve twice (e.g. a branch and its rim, offset
  // by a constant) can sample once and reuse the points, instead of
  // re-evaluating the cubic formula a second time (code-review fix,
  // 2026-07-04 — the rim previously called strokeTaperedBezier fresh with
  // control points that were just the body's shifted by (0,-ro); since a
  // bezier is an affine combination of its control points, its sampled
  // points are exactly the body's points shifted the same way, so the rim
  // can reuse them for free instead of recomputing).
  function sampleBezier(
    p0x: number, p0y: number, p1x: number, p1y: number,
    p2x: number, p2y: number, p3x: number, p3y: number, steps = 8,
  ): Array<[number, number]> {
    const pts: Array<[number, number]> = [[p0x, p0y]];
    for (let s = 1; s <= steps; s++) pts.push(bezierAt(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, s / steps));
    return pts;
  }
  function strokeTaperedPoints(pts: Array<[number, number]>, w0: number, w1: number) {
    const steps = pts.length - 1;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const tMid = (t + (s - 1) / steps) / 2;
      ctx!.lineWidth = taperWidth(tMid, w0, w1, 1.4);
      ctx!.beginPath();
      ctx!.moveTo(pts[s - 1][0], pts[s - 1][1]);
      ctx!.lineTo(pts[s][0], pts[s][1]);
      ctx!.stroke();
    }
  }
  function strokeTaperedBezier(
    p0x: number, p0y: number, p1x: number, p1y: number,
    p2x: number, p2y: number, p3x: number, p3y: number,
    w0: number, w1: number, steps = 8,
  ) {
    strokeTaperedPoints(sampleBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, steps), w0, w1);
  }
  function buildFlowerSite(
    rnd: () => number,
    axisLen: number,
    baseW: number,
    opt: { pattern: string; nClusters: number; bracts: number; fatMul: number; lush?: number },
  ): FlowerSite {
    const pat = opt.pattern;
    const nClusters = opt.nClusters;
    const lush = opt.lush ?? 1;
    const clusters: Cluster[] = [];
    for (let i = 0; i < nClusters; i++) {
      const yf = nClusters === 1 ? 0.5 : i / (nClusters - 1);
      let along: number, lateral: number, fat: number;
      if (pat === "spiral") {
        along = yf;
        lateral = Math.sin(i * 2.39) * baseW * 0.55;
        fat = 0.7 + 0.3 * Math.sin(Math.PI * yf);
      } else if (pat === "nodal") {
        along = Math.pow(yf, 0.85) * 0.74;
        lateral = (rnd() - 0.5) * baseW * 0.22;
        fat = 1.0 * (0.8 + 0.4 * (1 - Math.abs(yf - 0.4) * 1.3));
      } else {
        along = yf * 0.92;
        lateral = Math.sin(i * 1.7) * baseW * 0.3 + (rnd() - 0.5) * baseW * 0.12;
        fat = 0.85 + 0.3 * Math.sin(Math.PI * yf);
      }
      const tipTaper = 1 - 0.55 * smooth(clamp((yf - 0.68) / 0.32, 0, 1));
      const centerBias = 1 - Math.abs(yf - (pat === "spiral" ? 0.45 : 0.5)) * 1.2;
      // Mobile readability: FEWER, BIGGER calyx pods — at real phone size, a
      // dozen-plus tiny overlapping calyxes per cluster read as speckled moss
      // noise, not a bud. A handful of bold "layered bract marks" per cluster,
      // sized up so each is individually legible, reads as cannabis at a glance.
      // The fused mass silhouette (drawn separately, unchanged) still carries the
      // spear/cone shape — these pods are surface texture riding on top of it.
      // Round 2 (owner mockup): a couple more pods per cluster — the mockup bud
      // surface is a dense stack of visible calyx bumps, and at the old count
      // the fused mass read as smooth jelly with a few floating dots.
      // Round 3 (owner mockup): finer/juicier calyx grain — MORE pods per
      // cluster in an extra ring, each a notch smaller (podW below), so the bud
      // surface reads as stacked calyxes rather than a few blobby grapes. Still
      // whole-pod marks (no per-gland noise) so phone readability holds.
      // Blob-complaint fix (pass 2): trim the baseW contribution so wider colas
      // don't keep piling on ever more pods on top of the now-bigger podW above
      // (pass 2's whole point is fewer, bigger, more distinguishable pods).
      const nPods = Math.max(7, Math.round((opt.bracts + 8) * 0.62 + baseW * 0.08));
      const pods = [];
      // Round 8 (owner: "each area has to be populated with a stacking
      // pattern — 12 in one ring, 8 stacked inside, every other one purple,
      // then the top stacks with a different colour"). A botanical-research
      // pass confirmed real cola bract growth IS nodal/whorled (not a free
      // scatter) and that this file's own `buildMacro` — the "Detailed Bud
      // View" a few hundred lines down — already implements a proper
      // deterministic golden-angle ring-pack for exactly this. The angle/
      // radius placement below is that same golden-angle idea in its purer
      // continuous form (`j * 2.399` ≈ 137.5°/step across the WHOLE pod set,
      // not just within one ring), which already avoids the "column-up"
      // problem ring-local resets need an offset trick to fix — round 7
      // tuned that placement/ring-size split (2/3/3/rest) across several
      // passes, so it's left untouched here to avoid re-litigating it.
      // What WAS still missing: colour was a random `blushK` roll per pod,
      // not the deterministic "every other one" alternation the owner
      // described. `ringIdx` (a pod's position within its own ring, tracked
      // via `ringCounts` below) now drives that: pods sitting at odd ringIdx
      // within a ring differ from even ones, layered under the existing
      // base→tip gradient in the colour block below.
      const ringCounts = [0, 0, 0, 0];
      // Pod shape variety (blob-complaint fix, pass 1): every pod used to be an
      // identical mono-taper capsule (`podPath` unconditionally). Give each pod
      // a `shape` roll the same way `buildMacro`'s detailed bud view already
      // does — `topness` mirrors that function's own derivation
      // (`clamp((0.4-progress)/0.4,0,1)`, progress 0=top→1=bottom) but `yf` runs
      // the opposite way here (0=base→1=tip), so `1-yf` stands in for `progress`.
      const topness = clamp((yf - 0.6) / 0.4, 0, 1);
      const foxCut = 0.85 - (S.foxtail ?? 0) * 0.2 - topness * 0.15;
      const ovalCut = Math.min(0.7 - topness * 0.2, foxCut - 0.04);
      for (let j = 0; j < nPods; j++) {
        const ring = j < 2 ? 0 : j < 5 ? 1 : j < 8 ? 2 : 3;
        const ringIdx = ringCounts[ring]++;
        const a = (j * 2.399) % TAU;
        const rad = ring * 0.27 + rnd() * 0.1;
        pods.push({
          ring, a, rad,
          parity: ringIdx % 2,
          k: ring / 3 + rnd() * 0.26,
          sz: (ring === 0 ? 1.02 : ring === 1 ? 0.92 : ring === 2 ? 0.82 : 0.72) * (0.85 + rnd() * 0.25),
          // Round 2 (owner mockup): calmer per-pod lightness/hue jitter (±12/±8 →
          // ±7/±5) — the old spread made neighbouring calyxes read as separate
          // polka dots instead of one layered bud surface.
          // Round 8: blushK's role is now secondary texture jitter, not the
          // primary colour driver — see `parity` above for the deterministic
          // "every other one" alternation itself.
          dl: (rnd() - 0.5) * 7, dh: (rnd() - 0.5) * 5, blushK: rnd(),
          shape: calyxShapeFor(rnd(), ovalCut, foxCut),
        });
      }
      pods.sort((p, q) => p.ring - q.ring);
      const hairs: Cluster["hairs"] = [];
      // Sparse, bold pistil strokes (owner: "sparse orange pistil strokes, not
      // noisy"). Round 2 (owner mockup): fewer + shorter still — the mockup's
      // pistils are quiet amber accents peeking from the calyx layers, and at
      // the old count they dominated the bud as orange confetti.
      // Round 5 (specialist code review, 2026-07-03): cut ~40% further (×0.6) —
      // the specialist read the render as "orange speckle, not sparse amber
      // accent"; the mockup shows a handful of hairs per cola, not a haze.
      // Round 7 (structure-first, "Pistil Hair Breakdown" reference): hairs
      // now emerge from a small set of GROUPED calyx-seam root points per
      // cluster (never an independent floating root — items 1/2/9) and
      // density scales with tier position — more hairs near the tip/active
      // upper sites, fewer near the base (item 7).
      // Round 8 ("Pistil Hair Breakdown" macro re-read): the prior round read
      // as too few / too straight / too uniform vs. the macro photo (abundant
      // curling orange filaments). Four pushes toward the reference:
      //  • Density (item 7): more seams + more hairs, steeper tip weighting so
      //    the active upper bud sites carry a proper tuft while the base stays
      //    sparse — grouped from seams, so it reads as fans not confetti.
      //  • Length (item 6): explicit short/medium/long tiers, not one band.
      //  • Curve (item 4): each hair carries a `curl` (tip hook) layered on
      //    `bend` (mid-length arch) in the draw block — an organic S, not an arc.
      //  • Colour (item 8): a per-hair `mat` maturity roll, tip-weighted, so a
      //    ripe cola shows pale-cream young strands mixed with orange ripe ones.
      const tierDensity = 0.5 + 1.35 * Math.pow(clamp(yf, 0, 1), 0.85);
      const nSeams = Math.max(1, Math.round(1 + 2.6 * yf + rnd() * 0.7));
      const seams: number[] = [];
      for (let s = 0; s < nSeams; s++) seams.push(rnd() * TAU);
      const nH = Math.max(1, Math.round((pat === "spiral" ? 3 : 4) * lush * 0.72 * tierDensity));
      for (let j = 0; j < nH; j++) {
        const seam = seams[j % seams.length];
        // Directional fan: mostly upward, biased slightly toward the seam's
        // own outward direction, with slight per-hair randomness (item 5).
        const dir = seam * 0.3 + -Math.PI / 2 * 0.7 + (rnd() - 0.5) * 1.05;
        // Length variation (item 6): short / medium / long tiers so the tuft
        // has a natural ragged silhouette instead of one uniform length.
        const lr = rnd();
        const len = lr < 0.42 ? 0.34 + rnd() * 0.22 : lr < 0.8 ? 0.58 + rnd() * 0.3 : 0.92 + rnd() * 0.42;
        // Per-hair maturity (item 8): tip clusters trend riper/oranger, base
        // paler, plus a wide random term so pale and orange strands coexist.
        const mat = clamp(0.34 * yf + rnd() * 0.92, 0, 1);
        hairs.push({
          a: dir,
          seam,
          len,
          bend: (rnd() - 0.5) * 1.5,
          curl: (rnd() - 0.5) * 1.15,
          // Round 5: small tip balls so each pistil reads as a fine thread.
          ball: 0.5 + rnd() * 0.22,
          k: rnd() * 0.85,
          mat,
        });
      }
      // Trichome "frost" — the crystalline "sugar coat" of a real bud is
      // THOUSANDS of fine resin glands (owner macro reference: "the trichomes
      // are tiny — there's thousands of them"), not a handful of soft blobs.
      // Round 8 (macro-photo reference, 2026-07-03): rounds 5/7 read as sparse
      // sparkles because the count was tiny (~1.5×lush) and each spark was a
      // big soft glow. We now carry MANY MORE, much FINER glint points per
      // cluster — each drawn as a ~1px solid dot anchored to a bract's own face
      // (see draw block) so the surface reads caked in frost rather than dotted.
      // Cost stays phone-safe: bulk glints are cheap solid fills (no per-glint
      // gradient); only a rare `spk` catch-light and one soft per-cluster sheen
      // wash use a gradient. Tip-concentration still comes from the draw-time
      // `frostGate`; `r`/`v` scatter each glint across a bract face, `sz` gives
      // size variety, `spk` flags the few brightest sparkles.
      const tris = [];
      // Density budget: ~18×lush glints/cluster reads as the dense sugar-coat
      // while keeping the per-frame fill cost modest — each is a sub-pixel solid
      // arc, and the draw-time frostGate skips most on lower (base) clusters, so
      // the literal glint count on screen is a few hundred, not thousands.
      const nT = Math.max(8, Math.round(18 * lush));
      for (let j = 0; j < nT; j++)
        tris.push({ a: rnd() * TAU, r: rnd(), v: rnd(), sz: rnd(), k: rnd(), mat: rnd(), spk: rnd() });
      clusters.push({
        yf, along, lateral, fat: fat * opt.fatMul, tipTaper, centerBias, pods, hairs, tris,
        ph: rnd() * TAU,
        // Round 8 (owner "10/10" hero render): bright green serrated sugar-leaf
        // sepals poke OUT through the purple bud on EVERY cola, giving each a
        // spiky green star/sunburst outline (the render's defining feature).
        // Fire on ~every other cluster, all patterns (nodal included — the hero
        // shows green sepals on indica colas too), the full length of the cola
        // (up to the tip). Was: spiral/hybrid only, every 3rd cluster, yf<0.75.
        leaf: i % 2 === 0 && yf < 0.94,
        leafSide: i % 2 ? 1 : -1,
      });
    }
    return { axisLen, baseW, clusters, pat };
  }

  function clusterDev(cl: Cluster, budDev: number) {
    return clamp(budDev * (0.4 + 0.9 * Math.max(0, cl.centerBias)), 0, 1) * (budDev > 0.02 ? 1 : 0);
  }

  // Node attachment collar (owner blueprint 2026-07-03: "buds look pasted on;
  // no clear attachment → attach every bud to a visible branch joint / node").
  // Drawn in the flower-site's local space (base at origin, cola growing up -y)
  // right BEFORE the cola, so each bud visibly sockets onto a tapered stem neck
  // with a small calyx-green leaf collar at the junction instead of floating.
  // Draw-path only — no build-time RNG, so pinned determinism tests are intact.
  function drawBudCollar(site: FlowerSite, litAdj: number) {
    const w = Math.max(3, site.baseW * 0.5); // socket half-width at the branch
    const h = Math.max(6, site.baseW * 0.9); // neck height into the cola base
    ctx!.save();
    // Tapered stem "socket" the cola sits on — wide at the branch, narrowing up
    // into the bud base so the join reads as continuous stem, not a seam.
    const g = ctx!.createLinearGradient(0, h * 0.5, 0, -h);
    g.addColorStop(0, `hsl(${S.hue - 8}, 36%, ${clamp(24 + litAdj, 14, 40)}%)`);
    g.addColorStop(1, `hsl(${S.hue - 6}, 42%, ${clamp(33 + litAdj, 20, 48)}%)`);
    ctx!.fillStyle = g;
    ctx!.beginPath();
    ctx!.moveTo(-w, h * 0.4);
    ctx!.quadraticCurveTo(-w * 0.5, -h * 0.25, -w * 0.26, -h);
    ctx!.lineTo(w * 0.26, -h);
    ctx!.quadraticCurveTo(w * 0.5, -h * 0.25, w, h * 0.4);
    ctx!.closePath();
    ctx!.fill();
    // Collar band — a small darker ellipse at the node junction (the "visible
    // node joint + slight ring" of the target reference).
    ctx!.strokeStyle = `hsl(${S.hue - 14}, 30%, ${clamp(18 + litAdj, 10, 32)}%)`;
    ctx!.lineWidth = Math.max(1, w * 0.22);
    ctx!.beginPath();
    ctx!.ellipse(0, h * 0.06, w * 0.7, w * 0.26, 0, 0, Math.PI * 2);
    ctx!.stroke();
    // Two small sugar-leaf blades cupping the base up-and-out — the "small leaf
    // collar / sugar leaf ring" that supports the bud and hides the seam.
    ctx!.fillStyle = `hsl(${S.hue - 4}, 44%, ${clamp(30 + litAdj, 18, 46)}%)`;
    for (const s of [-1, 1]) {
      ctx!.beginPath();
      ctx!.moveTo(s * w * 0.3, h * 0.1);
      ctx!.quadraticCurveTo(s * w * 1.5, -h * 0.15, s * w * 1.7, -h * 0.75);
      ctx!.quadraticCurveTo(s * w * 0.9, -h * 0.2, s * w * 0.15, h * 0.05);
      ctx!.closePath();
      ctx!.fill();
    }
    ctx!.restore();
  }

  function drawFlowerSite(
    site: FlowerSite,
    P: DevParams,
    jig: number,
    tt: number,
    trichScale = 1,
  ) {
    // Plant rework pass 4 (owner blueprint: "glow boundary — a soft emissive edge
    // that SEPARATES the bud from the foliage behind it"; "buds stay readable").
    // A soft dark halo behind the cola silhouette so the bright bud reads as a
    // distinct foreground object instead of fusing into the leaf mass — pure
    // depth/readability, additive, removes no foliage. Drawn first so the stem,
    // mass, calyxes and frost all layer on top of it.
    {
      // Blob-complaint fix (pass 8): the halo was large/dark enough to read as
      // its own soft blob behind the cola, adding to the "one repeated blob
      // shape" complaint. Shrunk and lightened so it still separates the bud
      // from the foliage without becoming a visible shape of its own.
      const bw = site.baseW * 1.1;
      const bh = site.axisLen * 0.42;
      const cy = -site.axisLen * 0.5;
      const halo = ctx!.createRadialGradient(0, cy, 0, 0, cy, Math.max(bw, bh));
      halo.addColorStop(0, "rgba(3,9,7,0.28)");
      halo.addColorStop(0.7, "rgba(3,9,7,0.14)");
      halo.addColorStop(1, "rgba(3,9,7,0)");
      ctx!.save();
      ctx!.fillStyle = halo;
      ctx!.beginPath();
      ctx!.ellipse(0, cy, bw, bh, 0, 0, TAU);
      ctx!.fill();
      ctx!.restore();
    }
    ctx!.strokeStyle = `hsl(${S.hue - 12}, 32%, 30%)`;
    ctx!.lineWidth = Math.max(1.8, site.baseW * 0.07);
    ctx!.lineCap = "round";
    ctx!.beginPath();
    ctx!.moveTo(0, 0);
    ctx!.lineTo(0, -site.axisLen * 0.98);
    ctx!.stroke();

    // ---- Purple/pink flower accents (owner mockup: purple-pink accents on
    // green buds). Authored accents (accentHue/accentFrac) pass through; any
    // strain expressing anthocyanin but with no authored accent derives one, so
    // even mid-anthocyanin phenotypes show a visible purple tip. The accent
    // strengthens through flowering into late flower (ripeness-gated) and is
    // weighted toward the cluster TIPS — anthocyanin expresses at the top of
    // the bud first. Zero-anthocyanin strains (G13, Blue Dream) are unchanged.
    const bcA = live.current.budColor;
    const anth = clamp(bcA.anthocyanin, 0, 1);
    const accHue = bcA.accentHue ?? (anth > 0.05 ? 288 : null);
    const accFrac = bcA.accentFrac ?? (anth > 0.05 ? clamp(0.12 + anth * 0.4, 0, 0.5) : 0);
    const accGate = 0.55 + 0.45 * P.ripe; // mid-flower subtle → late-flower full

    // Per-cluster placement, computed once so the continuous bud-mass
    // silhouette and the calyx texture that rides on it stay in lock-step.
    const geo: Array<{ cx: number; cy: number; cw: number; podW: number; d: number } | null> = [];
    for (let i = 0; i < site.clusters.length; i++) {
      const cl = site.clusters[i];
      const d = clusterDev(cl, P.budDev);
      if (d <= 0.01) { geo.push(null); continue; }
      const cyc = jig ? Math.sin(tt * 30 + cl.ph) * jig : 0;
      // Lateral damped to 0.65: the cluster spiral gives the TEXTURE variety,
      // but the anchors must hug the axis so pods stay inside the smooth
      // spear envelope drawn below (they poked out as loose bubbles otherwise).
      const cx = cl.lateral * (0.4 + 0.6 * d) * 0.65 + cyc * 0.5;
      const cy = -cl.along * site.axisLen + (jig ? Math.cos(tt * 26 + cl.ph) * jig * 0.5 : 0);
      const cw = site.baseW * cl.fat * cl.tipTaper * (0.55 + 0.45 * d);
      // Sublinear pod size: a wide cola keeps near-constant calyx grain (more
      // pods, via nPods above) instead of ballooning each pod into a grape. Bolder
      // floor + multiplier than before — fewer pods (see nPods) means each one
      // must read clearly on its own at phone size.
      // Round 2: absolute cap too — on the widest (leader) clusters the sublinear
      // curve still produced grape-sized pods that read as purple marbles.
      // Round 3 (owner mockup): finer grain — pods a notch smaller (cap 5.2 →
      // 4.2, floor 1.9 → 1.7) now that each cluster carries MORE of them (see
      // nPods); the mockup's bud surface is a fine calyx stack, not marbles.
      // Blob-complaint fix (pass 2): the old exponent/ceiling made pods scale
      // down as colas grew, so the biggest cola carried the densest cluster of
      // tiny beads — backwards. Steeper exponent + higher ceiling let pods grow
      // more in step with cola width.
      const podW = clamp(Math.pow(cw, 0.95) * 0.27, 1.7, 6.5);
      geo.push({ cx, cy, cw, podW, d });
    }

    // ---- De-grape: continuous bud-mass silhouette (ported from PR #25) ----
    // At chamber distance the calyx pods are too small to overlap on their own,
    // so a flower site read as a handful of loose circles (grapes). Round 2
    // fused the clusters behind them with unioned ellipses, but each blob still
    // bulged — the cola read as a lumpy peanut. Round 3: draw the mass as ONE
    // smooth tapered outline instead — a closed midpoint-quadratic spline
    // through the cluster envelope (rounded base → pointed tip), with the calyx
    // texture riding inside it. Width still follows the per-cluster `cw`, so
    // the silhouette stays strain-recognisable (G13 spiral = slim spear cola;
    // PDP/Animal Mints = chunky stacked mass).
    // `ph` (each cluster's own build-time `rnd() * TAU` phase, already used to
    // jiggle pod motion elsewhere) is reused here as the per-site seed for the
    // pass-5 centreline wobble below — deterministic, no new RNG source.
    const mass = geo
      .map((g, i) => (g && g.d > 0.06 ? { ...g, ph: site.clusters[i].ph } : null))
      .filter((g): g is NonNullable<typeof g> => !!g);
    if (mass.length) {
      mass.sort((a, b) => a.cy - b.cy); // tip (most negative cy) → base
      const bc = live.current.budColor;
      const n = mass.length;
      // Per-cluster half-width and centreline, 3-tap smoothed across neighbours
      // so fat/lateral jitter can't lobe the outline into a peanut. The jitter
      // still lives in the calyx texture — only the envelope is calmed.
      // Round 6 (secondary, cheap win): a touch wider per-cola envelope
      // (1.25→1.4, 0.56→0.62) — round 5 flagged individual colas still
      // reading as separated, spiky "fingers" rather than the reference's
      // chunkier, more fused stacked-diamond mass. Widening the mass outline
      // itself (not branch spacing — that's a bigger whole-plant layout
      // change, out of scope for this round) plumps each cola without
      // touching the taper/single-leader architecture from round 5.
      const raw = mass.map((m) => Math.max(m.podW * 1.4, m.cw * 0.62) * (0.66 + 0.34 * m.d));
      const hw = raw.map((r, i) => (raw[Math.max(0, i - 1)] + 2 * r + raw[Math.min(n - 1, i + 1)]) / 4);
      // Clean spear taper: width may mostly only shrink toward the tip (a wide
      // bulge above a waist is what made the old outline read as stacked
      // lobes), but pass 5 (blob-complaint fix) loosens the strictly-monotonic
      // constraint by 10% — a little controlled irregularity per cola instead
      // of every cola tapering identically smooth.
      for (let i = n - 2; i >= 0; i--) hw[i] = Math.min(hw[i], hw[i + 1] * 1.1);
      // Centreline: 3-tap smoothed so the envelope leans gently instead of
      // zigzagging cluster-to-cluster (the anchors themselves are already
      // damped toward the axis above, keeping texture and mass in lock-step).
      // Pass 5 (blob-complaint fix) adds a small deterministic sinusoidal
      // wobble on top, keyed off each cluster's own build-time `ph` seed, so
      // colas on the same plant/render lean subtly differently instead of
      // every cola sharing one identical, perfectly smooth taper curve.
      const cxs = mass.map(
        (m, i) =>
          (mass[Math.max(0, i - 1)].cx + 2 * m.cx + mass[Math.min(n - 1, i + 1)].cx) / 4 +
          Math.sin(m.ph * 2 + i * 0.9) * hw[i] * 0.15,
      );
      const tipY = mass[0].cy - Math.min(hw[0] * 1.7, hw[n - 1] * 1.1); // spear point (capped so it can't spike)
      const botY = mass[n - 1].cy + hw[n - 1] * 1.05; // rounded base below the last
      // Outline vertices, clockwise: tip → right edge down → base → left edge up.
      const pts: Array<[number, number]> = [[cxs[0], tipY]];
      for (let i = 0; i < n; i++) pts.push([cxs[i] + hw[i], mass[i].cy]);
      pts.push([cxs[n - 1], botY]);
      for (let i = n - 1; i >= 0; i--) pts.push([cxs[i] - hw[i], mass[i].cy]);
      // Round 3 (owner mockup): deeper base tone (37 → 33) — the mockup's bud
      // green is a rich mid-dark green, ours read a shade too bright/flat.
      const massLit = 33 + bc.anthocyanin * 2;
      const mg = ctx!.createLinearGradient(0, tipY, 0, botY);
      // Purple/pink tip on the fused bud mass (mockup): accent-capable strains
      // blend the top of the silhouette into the accent hue, deepest in late
      // flower. The stop position scales with accent strength so a light-accent
      // strain gets a small tip kiss, a heavy one a broad glow.
      // Round 2 (owner mockup): stronger, deeper purple tip on the fused mass —
      // the accent cap rises to 0.6 and the blend reaches further down the cola,
      // and the tip stop is a mid-dark dusty violet (massLit+4, not +10) so the
      // purple reads as pigment in the calyxes, not a lavender glow.
      // Round 6 (close-up + full-plant reference photos): round 5's single
      // point-stop at the very tip meant the gradient interpolated hue
      // accHue→calyxHue over a short span near the apex only — at chamber
      // scale that read as a pale purple kiss, not the references'
      // purple-DOMINANT cola (purple is the majority surface colour; green is
      // a minority base/edge role, mostly carried by separate leaf blades —
      // see cl.leaf below — not blended into the bud mass itself). Three
      // changes vs round 5: (1) accAmt's gain raised ×2.0 and its cap raised
      // 0.6→0.98 so accent-capable strains (Gelato accentFrac 0.5) push much
      // further down the cola; (2) a HELD purple plateau — two stops at the
      // same hue before the transition to green — so the top of the cola
      // stays solidly violet instead of instantly blending toward green;
      // (3) the transition point itself now reaches up to ~97% down the cola
      // at max strength (was capped at 50%), so only a thin base band stays
      // green. Saturation/lightness kept modest (not neon) to stay a dusty
      // violet like the references, not a bright magenta glow.
      const accAmt = accHue != null ? clamp(accFrac * accGate * 2.0, 0, 0.98) : 0;
      if (accHue != null && accAmt > 0.06) {
        const purpleEnd = clamp(0.42 + accAmt * 0.58, 0.42, 0.97);
        mg.addColorStop(0, `hsl(${accHue}, ${Math.min(74, bc.calyxSat + 18)}%, ${massLit + 6}%)`);
        mg.addColorStop(clamp(purpleEnd * 0.55, 0.15, 0.5), `hsl(${accHue}, ${Math.min(70, bc.calyxSat + 12)}%, ${massLit + 1}%)`);
        mg.addColorStop(purpleEnd, `hsl(${bc.calyxHue + 4}, ${bc.calyxSat}%, ${massLit + 7}%)`);
      } else {
        mg.addColorStop(0, `hsl(${bc.calyxHue + 4}, ${bc.calyxSat}%, ${massLit + 7}%)`);
      }
      mg.addColorStop(1, `hsl(${bc.calyxHue}, ${Math.min(88, bc.calyxSat + 12)}%, ${Math.max(10, massLit - 14)}%)`);
      ctx!.fillStyle = mg;
      // Closed midpoint-quadratic spline: each vertex is a control point, so the
      // outline is C1-smooth all the way round; the extended tip vertex keeps a
      // gently pointed apex instead of a bulb.
      ctx!.beginPath();
      ctx!.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
      for (let i = 1; i <= pts.length; i++) {
        const p = pts[i % pts.length], q = pts[(i + 1) % pts.length];
        ctx!.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      ctx!.closePath();
      ctx!.fill();
    }

    // Shingled paint order (reference "Bract/Calyx Scale Breakdown" item 2:
    // "adjacent bracts stack like roof shingles, each covering the base of
    // the one above"). Clusters are tiers along the spine from base (yf≈0)
    // to tip (yf≈1); painting base→tip (the array's natural order) put the
    // TIP tiers in front, burying each tier's base under the tip above it —
    // the opposite of a shingled cola and a likely contributor to the
    // "spiky separated fingers" read (each tier looked like a separate
    // floating tuft instead of an overlapping stack). Painting tip-first
    // (background) and base-last (foreground) makes each lower tier's
    // bracts lay forward over the base of the tier above it, closing the
    // seams between tiers into one continuous overlapping surface.
    const shingleOrder = site.clusters.map((_, idx) => idx).sort((a, b) => site.clusters[b].yf - site.clusters[a].yf);
    for (const i of shingleOrder) {
      const cl = site.clusters[i];
      const gi = geo[i];
      if (!gi) continue;
      const { cx, cy, cw, podW, d } = gi;
      // Round 3: slightly taller pods (1.5 → 1.6) — pointier stacked bracts.
      // Round 7: taller again (1.6 → 1.85) — the sharper, more pointed bract
      // shape (see podPath) concentrates fill mass toward its own centre and
      // tapers away hard at its edges, which left visible dark chamber-
      // background valleys between adjacent tiers where the old rounder
      // bract used to bridge the gap with its own width. A taller bract
      // reaches further along the shingle direction and closes those seams
      // without changing its footprint (podW, and therefore the cluster
      // taper/silhouette from round 5, is untouched).
      const podH = podW * 1.85;
      const bc = live.current.budColor;
      const calyxHue = bc.calyxHue + 3;
      const calyxSat = bc.calyxSat;
      // Round 3 (owner mockup): pods a shade deeper too (38 → 35), tracking the
      // deepened fused-mass tone so the texture stays embedded in the bud.
      const baseLit = 35 - (1 - cl.yf) * 5 + bc.anthocyanin * 3;
      const detailed = podW > 1.8;

      if (cl.leaf && d > 0.22 && detailed) {
        // Round 8 (owner "10/10" hero render): the hero's signature is bright
        // green, SERRATED sugar-leaf blades poking OUT through the purple-
        // magenta bud, so each cola reads as a spiky green star/sunburst rather
        // than a smooth teardrop. Prior rounds drew a tiny 2-blade sprig that
        // barely cleared the calyx surface (ls≈0.4·cw, mid-green) — invisible at
        // chamber scale. Now: a small fan of thin serrated blades radiating up-
        // and-outward from the cola flank, LONG enough that their tips clear the
        // bud silhouette (hw≈0.62·cw), in a vivid lime green. Drawn BEFORE the
        // pods so each blade's base tucks between the calyxes (botanically the
        // sepals emerge from the bract seams) and only the outer serrated tip
        // pokes through — keeping the bud purple-DOMINANT with green spikes.
        // Round 8b (owner combined-preview verify): the first pass overshot —
        // long neon-lime blades read as a spiky cactus/thistle and fought the
        // purple. The hero shows green sepal TIPS peeking through a
        // purple-DOMINANT bud, not green spikes dominating it. Shortened so
        // only the tips clear the silhouette (0.72+0.42 → 0.40+0.26) and
        // thinned slightly.
        const ls = cw * (0.40 + 0.26 * d);
        const wd = ls * 0.10 * S.leafW;
        const base = cl.leafSide;
        // One slender serrated blade out each side (up-and-outward) — alternating
        // tiers build a symmetric spiky outline up the cola while the purple
        // calyx mass stays the dominant surface between the spikes. Per-blade
        // lightness/hue jitter keeps the sepals reading as varied natural
        // foliage (as in the hero render) rather than a flat neon slab.
        const blades: Array<[number, number, number]> = [
          [base * (0.78 + 0.14 * Math.sin(cl.ph)), 1.0, 0.5 + 0.5 * Math.sin(cl.ph * 3.1)],
          [-base * (0.72 + 0.12 * Math.sin(cl.ph * 1.7)), 0.86, 0.5 + 0.5 * Math.cos(cl.ph * 2.3)],
        ];
        ctx!.save();
        ctx!.translate(cx, cy);
        for (const [ang, sc, jit] of blades) {
          // Muted natural sugar-leaf green (round 8b): a notch above the
          // fan-leaf tone so the tips read as green against the purple, but
          // NOT the neon lime that fought the bud in the first pass. Hue nudged
          // back toward true green (was -8, which pushed yellow-lime), sat/lit
          // pulled in so purple stays the dominant surface.
          ctx!.fillStyle = `hsl(${S.hue + 2 + jit * 8}, ${clamp(S.sat + 12, 0, 70)}%, ${clamp(S.lit + 6 + jit * 10, 0, 50)}%)`;
          ctx!.save();
          ctx!.rotate(ang);
          leafletPath(ls * sc, wd * sc, 0.14);
          ctx!.fill();
          ctx!.restore();
        }
        ctx!.restore();
      }

      const reveal = clamp((d - 0.05) / 0.95, 0, 1);
      let drawn = 0;
      for (const p of cl.pods) {
        if (p.k > reveal) continue;
        const g = 0.5 + 0.5 * d;
        const px = cx + Math.cos(p.a) * p.rad * cw * 0.55;
        const py = cy + Math.sin(p.a) * p.rad * cw * 0.35 + p.ring * podH * 0.18;
        // Some calyxes can render in an accent hue (e.g. purple accents on a
        // green bud) — chosen deterministically per pod via its blushK roll.
        // Round 2 (owner mockup): the accents are TIP-CONCENTRATED, not spread —
        // a steep yf curve zeroes the share on the lower half of the cola and
        // saturates it near the tip, so the bud reads "purple-tipped over green"
        // instead of purple polka dots all over. Ripening (accGate) still fades
        // the whole effect in through flower.
        // Round 3 (owner mockup): steeper tip concentration (exp 1.4 → 2.1,
        // gain 1.7 → 2.4) — near the tip most pods flip to the accent hue so
        // the purple reads as a continuous cap, not dots sprinkled mid-bud.
        // Round 5 (specialist code review, 2026-07-03): gain 2.4 → 1.4 — the
        // fused-mass gradient cap (drawn above, unchanged) already carries the
        // purple identity; per-pod accents on top of it at 2.4x read as violet
        // confetti sprinkled over an already-purple tip. 1.4x keeps a handful of
        // accent pods as texture without fighting the mass gradient for the
        // "where's the purple" read.
        // Round 6 (close-up + full-plant reference photos): round 5
        // over-corrected — the references show the calyx PODS themselves
        // (not just the mass gradient underneath) reading purple across
        // nearly all of the cola, with green confined to a thin base band and
        // to separate leaf blades (drawn above via cl.leaf, not these pods),
        // not "sparse purple flecks on green". The pods sit ON TOP of the
        // fused-mass gradient and cover most of its visible area, so
        // pod-level accent density is what the eye actually reads as the
        // dominant colour.
        // Round 7 (structure-first, "Bract/Calyx Scale Breakdown" item 7):
        // round 6's per-pod colour was a COIN-FLIP between two flat hues
        // (fully green or fully accent), gated by a steep tip-weighted
        // probability — that reads as scattered flecks/confetti once you
        // look past the mass gradient, not the reference's smooth, explicit
        // base→tip intensification. Replaced with a continuous blend
        // (`tipBlend`) driven directly by the pod's tier position (cl.yf):
        // muted/green at the base, ramping smoothly to fully saturated
        // purple-magenta near the tip, with only a small jitter (not a hard
        // random gate) so the transition band isn't a razor edge. Blended in
        // RGB space (blendHueSat) so the middle of the transition reads as a
        // muted dusty maroon, not a hot saturated red/blue passthrough.
        const tipW = smooth(clamp((cl.yf - 0.02) / 0.98, 0, 1));
        const active = tipW * accFrac * accGate;
        const tipBlend = accHue != null ? clamp(active * 2.6 + (p.blushK - 0.5) * 0.12, 0, 1) : 0;
        const [hueP0, satP0] =
          accHue != null
            ? blendHueSat(calyxHue, calyxSat, accHue, Math.min(70, calyxSat + 18), tipBlend)
            : [calyxHue, calyxSat];
        // Round 8: deterministic "every other one" stacking alternation
        // (owner: "12 in one ring, 8 stacked inside, every other one purple,
        // then the top stacks with a different colour"). Folding this into
        // `tipBlend` above didn't work — that fraction clamps to 1.0 well
        // before the tip (fully accent-coloured), swallowing any additive
        // term exactly where the pattern needs to stay visible. Instead it's
        // a direct hue/lightness/saturation offset applied AFTER the blend,
        // so it reads even at full saturation: `parityHue`/`parityLit`
        // alternate WITHIN a ring, `ringLit` gives a whole ring a distinct
        // step from its neighbour ("the one that stacks inside"). A same-run
        // side-by-side screenshot check (before this pass, the alternation
        // was folded into `tipBlend` and was nearly invisible against the
        // fully-ripe cola's existing vein/frost/pistil texture) is why the
        // hue term and the amplitudes below exist — lit/sat alone at a
        // subtler amplitude didn't read. Lit alternation is unconditional
        // (reads as a light/dark stacking texture on green-only strains
        // too); hue/extra-saturation only swing once there's an accent hue.
        const parityHue = accHue != null ? (p.parity ? 1 : -1) * 7 : 0;
        const parityLit = (p.parity ? 1 : -1) * 6;
        const ringLit = (p.ring % 2 ? 1 : -1) * 3;
        const satP = accHue != null ? clamp(satP0 + (p.parity ? 1 : -1) * 9 * (0.3 + 0.7 * active), 0, 100) : satP0;
        const hueP = hueP0 + p.dh + parityHue + (accHue == null && p.blushK < P.blush ? 18 : 0);
        // Pods splay outward from the cola axis (rotation follows their ring
        // position) so the surface reads as layered bract scales rather than
        // loose bubbles.
        // Bug fix (2026-07-04, "black blob" glitch — Gelato late-flower):
        // ring depth (-2), tipBlend (-3), parityLit (±6) and ringLit (±3) are
        // all independent per-pod darkening terms that can land in the SAME
        // direction at once (worst case ring 2, odd parity, full tip-accent:
        // -2-3-6-3 ≈ -14 on top of dl's own -3.5). On strains with a high
        // accentFrac + anthocyanin (Gelato 0.5/0.6 — the highest of any
        // authored strain), that pushes a whole neighbourhood of adjacent
        // pods near the cola tip to ~L10 at once; drawPod's own gradient then
        // darkens its outer stop by a further -16 (undercut -22), crushing
        // the shared corner of many overlapping pods to near-black
        // simultaneously — the fused mass reads as a solid black clump
        // instead of individually-shaded dark-violet bracts. `drawPod` itself
        // clamps its `lit` input to [26,58] (floor raised from 20, pass 3 —
        // that floor/ceiling now lives in the one place with the unguarded
        // hsl() calls, not just here), so this sum is passed through raw; the
        // per-pod ring/parity/tip texture (the "every other one" stacking +
        // shingle read this round built) still comes through unclamped up to
        // that point.
        // Blob-complaint fix (pass 3): the tip used to be the DARKEST part of
        // the render (the ring-depth bonus was fully subtracted by tipBlend,
        // and tipBlend itself was a further flat -3), when the cola tip/crown
        // should read as the frostiest/brightest part of the bud. Tapering the
        // ring-depth term toward the tip (instead of letting tipBlend cancel
        // it outright) and flipping tipBlend's own contribution to a small
        // positive lift makes the tip end up lighter, not darker.
        const podLit = baseLit + p.dl + (2 - p.ring) * 2 * (1 - tipBlend * 0.6) + tipBlend * 1.2 + parityLit + ringLit;
        drawPod(
          px, py, Math.cos(p.a) * (0.32 + p.rad * 0.45), podW * p.sz * g, podH * p.sz * g,
          hueP, satP, podLit, 0.42, p.shape,
        );
        drawn++;
      }
      if (drawn === 0) continue;

      // Round 7 (structure-first, "Pistil Hair Breakdown" reference): the
      // root now sits ON the bract-ring surface at the hair's grouped SEAM
      // point (never an independent floating radius — items 1/2/9), and the
      // filament is a filled TAPERED wedge (thicker at the root, fine at the
      // tip — item 3) instead of a constant-width stroke, which at chamber
      // scale read as a rigid uniform spike rather than a delicate hair.
      // Round 8: the wedge was a single quadratic arc (one bend) — the macro
      // shows filaments that arch AND hook. The centreline is now sampled as a
      // curved polyline carrying `bend` (a mid-length sin arch) plus `curl` (a
      // t^1.9 tip hook), and the tapered ribbon is built by offsetting each
      // sample along its LOCAL normal — so the curl reads cleanly and the width
      // still tapers to a fine tip (item 3/4). Colour is resolved PER HAIR from
      // its own maturity so the tuft is a pale→orange mix, not one flat tone
      // (item 8); tip stigma bead stays small so each hair reads as a thread.
      const bw0 = Math.max(0.85, cw * 0.02); // root half-width
      const STEPS = 7;
      for (const h of cl.hairs) {
        if (h.k > d) continue;
        const stretch = clamp((d - h.k * 0.5) / 0.6, 0.35, 1);
        const L = cw * 0.24 * h.len * stretch;
        const seamR = 0.6 + 0.22 * Math.sin(h.seam * 3.1);
        const x0 = cx + Math.cos(h.seam) * seamR * cw * 0.5, y0 = cy + Math.sin(h.seam) * seamR * cw * 0.32 - podH * 0.22;
        const x1 = x0 + Math.cos(h.a) * L, y1 = y0 + Math.sin(h.a) * L;
        const dx = x1 - x0, dy = y1 - y0, dlen = Math.max(0.001, Math.hypot(dx, dy));
        const nX = -dy / dlen, nY = dx / dlen; // chord normal (unit)
        const bendAmp = h.bend * (1.5 + P.ripe * 2.0); // mid-length arch
        const curlAmp = h.curl * (2.2 + P.ripe * 3.4); // tip hook, ripens stronger
        // Sample the curved centreline once (root → tip).
        const pts: Array<[number, number]> = [];
        for (let s = 0; s <= STEPS; s++) {
          const t = s / STEPS;
          const off = bendAmp * Math.sin(Math.PI * t) + curlAmp * Math.pow(t, 1.9);
          pts.push([x0 + dx * t + nX * off, y0 + dy * t + nY * off]);
        }
        // Build a tapered ribbon: offset each sample by its LOCAL normal so the
        // width follows the curl, shrinking from bw0 at the root to ~0 at tip.
        const left: Array<[number, number]> = [], right: Array<[number, number]> = [];
        for (let s = 0; s <= STEPS; s++) {
          const a = pts[Math.max(0, s - 1)], b = pts[Math.min(STEPS, s + 1)];
          const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.max(0.001, Math.hypot(tx, ty));
          const lnX = -ty / tl, lnY = tx / tl;
          const hw = bw0 * Math.pow(1 - s / STEPS, 0.85);
          left.push([pts[s][0] + lnX * hw, pts[s][1] + lnY * hw]);
          right.push([pts[s][0] - lnX * hw, pts[s][1] - lnY * hw]);
        }
        // Per-hair maturity → pale-cream (young) ⇢ orange (ripe). Floor keeps a
        // few strands pale even on a ripe cola; mag rides pistilMagenta only.
        const hairMat = clamp(P.ripe * (0.15 + 0.95 * h.mat), 0, 1);
        const magH = bc.pistilMagenta * (0.4 + 0.6 * h.mat);
        ctx!.fillStyle = pistilFiber(hairMat, P.brown, magH);
        ctx!.beginPath();
        ctx!.moveTo(left[0][0], left[0][1]);
        for (let s = 1; s <= STEPS; s++) ctx!.lineTo(left[s][0], left[s][1]);
        for (let s = STEPS; s >= 0; s--) ctx!.lineTo(right[s][0], right[s][1]);
        ctx!.closePath();
        ctx!.fill();
        const tip = pts[STEPS];
        ctx!.fillStyle = pistilBall(hairMat, P.brown, magH);
        ctx!.beginPath();
        ctx!.arc(tip[0], tip[1], h.ball * Math.max(0.5, cw * 0.012), 0, TAU);
        ctx!.fill();
      }
      // Trichome frost (Engine 7, simplified for chamber scale) — a few CLUSTERED
      // soft mint/blue-white glow blobs near the cluster's outer face, instead of
      // dozens of individual stalk+gland glyphs. The fine per-gland detail (still
      // driven by the same maturity model) lives in View Bud / Lab; at whole-plant
      // size it only ever read as speckled noise ("moss/caterpillar" — owner).
      // Round 5 (specialist code review, 2026-07-03): gate frost to the top
      // third of each cola (cl.yf > 0.66) — the specialist noted frost blobs
      // fired on every cluster top to bottom, but the mockup's frost is subtle
      // and concentrated near the tips, not spread the full length of the bud.
      // Round 7 (structure-first, "Bract/Calyx Scale Breakdown" item 6):
      // two refinements. (1) A smooth taper (`frostGate`) replaces the hard
      // cl.yf>0.66 cutoff — frost now thins gradually toward the base rather
      // than switching off at a razor line, still heaviest near the tip.
      // (2) Each spark now anchors to a specific bract's own tip/ridge
      // (picked deterministically from the spark's angle) instead of a free
      // polar offset from the cluster centre — frost "follows the surface"
      // of a raised bract rather than floating over the cluster as a haze.
      if (P.trich > 0) {
        const frostGate = smooth(clamp((cl.yf - 0.32) / 0.5, 0, 1));
        if (frostGate > 0.02) {
          const purple = clamp(live.current.budColor?.anthocyanin ?? 0, 0, 1);
          const mix = maturityMix(clamp(P.ripe * 0.7 + P.brown * 0.6, 0, 1), purple * 0.4);
          const dens = P.trich * clamp(trichScale, 0, 1) * frostGate;
          // (A) Frost SHEEN wash — the macro reference reads as a CONTINUOUS
          // crystalline coating catching the light, which a field of discrete
          // glints alone can't convey. One cool milky radial per cluster,
          // biased to the upper (tip) face and kept very low-alpha, lays down
          // that sheen for the cost of a single gradient fill.
          const shy = cy - podH * 0.5;
          const shR = Math.max(4, cw * 1.35);
          const sa = 0.07 * dens;
          if (sa > 0.006) {
            const sheen = ctx!.createRadialGradient(cx, shy, 0, cx, shy, shR);
            sheen.addColorStop(0, `rgba(233,245,247,${sa})`);
            sheen.addColorStop(0.4, `rgba(226,241,240,${sa * 0.4})`);
            sheen.addColorStop(1, "rgba(220,238,236,0)");
            ctx!.fillStyle = sheen;
            ctx!.beginPath();
            ctx!.arc(cx, shy, shR, 0, TAU);
            ctx!.fill();
          }
          // (B) Dense fine glint field — each is a tiny solid dot anchored to a
          // bract's own face and scattered across it (tr.r across the width,
          // tr.v from mid-bract up toward the tip), so the whole surface reads
          // sugar-coated. Solid fills keep the bulk cheap; only the rare `spk`
          // sparkle spends a gradient on a hot catch-light.
          for (const tr of cl.tris) {
            if (tr.k > dens) continue;
            // Pick the source bract from a hash DECORRELATED from tr.a (which
            // drives the scatter angle + shimmer phase below) so glints don't
            // pile onto the same few pods — they spread evenly over the surface.
            const srcPod = cl.pods.length
              ? cl.pods[Math.floor((((tr.r * 5.0 + tr.sz * 2.7) % 1) + 1) % 1 * cl.pods.length) % cl.pods.length]
              : null;
            let bx: number, by: number;
            if (srcPod) {
              const ppx = cx + Math.cos(srcPod.a) * srcPod.rad * cw * 0.55;
              const ppy = cy + Math.sin(srcPod.a) * srcPod.rad * cw * 0.35 + srcPod.ring * podH * 0.18;
              // Scatter across the bract face in a small upward-biased disc so
              // frost dusts the whole raised scale (heavier toward its tip),
              // matching the macro's continuous coat rather than dotting centres.
              const spread = podW * srcPod.sz;
              bx = ppx + Math.cos(tr.a) * spread * (0.2 + 0.75 * tr.sz);
              by = ppy - podH * (0.02 + 0.52 * tr.v) + Math.sin(tr.a) * spread * 0.35;
            } else {
              const rad = cw * (0.1 + 0.5 * tr.r);
              bx = cx + Math.cos(tr.a) * rad;
              by = cy + Math.sin(tr.a) * rad - podH * 0.14;
            }
            const m = maturityFor(tr.mat, mix);
            const sh = motionOK
              ? shimmer(tt, tr.a * 7.13, 0.6 + tr.sz * 1.2, SHIMMER_MAX_AMP * 0.6)
              : 1;
            // Fine grain: most glints sit near a pixel — a fine crystalline dust,
            // not beads. Slightly brighter so each catches the light like resin.
            const gr = Math.max(0.6, cw * (0.008 + 0.013 * tr.sz));
            ctx!.fillStyle = trichHeadColor(m, clamp(0.5 * sh, 0, 0.9), purple);
            ctx!.beginPath();
            ctx!.arc(bx, by, gr, 0, TAU);
            ctx!.fill();
            // The brightest ~6% of glints get a hot white catch-light + halo —
            // this is the "sparkle" that sells wet resin without gilding the
            // whole field with expensive gradients.
            if (tr.spk > 0.95) {
              const hr = gr * 1.9;
              const halo = ctx!.createRadialGradient(bx, by, 0, bx, by, hr);
              halo.addColorStop(0, `rgba(255,255,255,${clamp(0.42 * sh, 0, 0.8)})`);
              halo.addColorStop(1, "rgba(240,250,250,0)");
              ctx!.fillStyle = halo;
              ctx!.beginPath();
              ctx!.arc(bx, by, hr, 0, TAU);
              ctx!.fill();
            }
          }
        }
      }
    }
  }

  // ---- plant + scene physics ----
  interface PhysNode { ao: number; av: number }
  const phys = {
    nodes: [] as PhysNode[],
    cola: { ao: 0, av: 0 } as PhysNode,
    bud: { ao: 0, av: 0 } as PhysNode,
  };
  const SPRING_K = 30, SPRING_C = 5.2;
  interface Dust { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; gold: boolean }
  const dust: Dust[] = [];
  const DUST_MAX = 90;
  const ptr = { x: -999, y: -999, vx: 0, active: false, lastT: 0 };
  let windPhase = 0;

  interface SceneCap { x: number; w: number; y: number; h: number; cx: number; floorY: number; haloY: number }
  interface Scene {
    stars: Array<{ x: number; y: number; r: number; a: number }>;
    links: Array<[number, number]>;
    cap: SceneCap;
    ringR: number;
    soilR: number;
    cracks: Array<{ a: number; r0: number; r1: number; al: number; wob: number }>;
  }
  // A secondary branchlet sprouting off a main branch — carries its own small
  // leaf cluster and (in flower) a small bud at its tip. This is the biggest
  // "fullness" lever: it breaks the one-branch-per-node diagram look.
  interface Branchlet {
    along: number; // 0..1 position along the parent branch
    side: number; // +1/-1 which way it forks off
    len: number; tilt: number; curve: number;
    leafSize: number; leaflets: number; phase: number;
    site: FlowerSite | null; // small bud at the branchlet tip
  }
  interface Node {
    x: number; y: number; f: number; side: number; tilt: number; len: number;
    leafSize: number; leaflets: number; phase: number; tipX: number; tipY: number;
    site: FlowerSite | null; budRot: number;
    curve: number; // branch upward bend (bezier), 0.1–0.4
    weight: number; // bud load on this branch → how much it droops
    spread: number; // lateral reach multiplier (wide skirt low, tucked up top)
    branchlets: Branchlet[]; // secondary forks
    nodeLeafSize: number; // leaf cluster hugging the stem at this node
    nodeBud: FlowerSite | null; // bud forming at the node intersection (upper)
    // ---- Engine 3 (phyllotaxy) / Engine 4 (leaf orientation) ----
    depth: number; // sin(azimuth) ∈ [-1,1]; +1 toward camera (front), -1 back
    litAdj: number; // atmospheric depth shade (HSL lightness delta)
    leafYaw: number; // horizontal squash of the tip fan (1 = face-on, →0 edge-on)
    leafRoll: number; // small per-node leaf roll so no two fans align
    skirt: number; // 0..1 lower-canopy fullness (high-nodeLeaf strains, low nodes)
  }
  interface Plant {
    P: DevParams; CL: ReturnType<typeof climateModel>; stage: string;
    cx: number; baseY: number; A: number; stemH: number;
    spine: Array<{ x: number; y: number; t: number }>; nodes: Node[];
    cola: { site: FlowerSite; x: number; y: number } | null;
  }
  let scene: Scene | null = null;
  let plant: Plant | null = null;
  let macroBud: MacroBud | null = null;
  // Precomputed-once macro backdrop (deterministic from seed + canvas size) so
  // the per-frame draw never re-seeds PRNGs or re-allocates gradients.
  let macroBokeh: Array<{ x: number; y: number; r: number; grad: CanvasGradient }> = [];
  let macroLeaves: Array<{ lx: number; ly: number; lsz: number; rot: number }> = [];

  function stageOf(): string {
    return stage; // authoritative server stage drives discrete features
  }

  function buildScene() {
    const rnd = mulberry32(777);
    const stars = [];
    const n = 24;
    for (let i = 0; i < n; i++) stars.push({ x: rnd() * W, y: rnd() * H * 0.9, r: 0.8 + rnd() * 1.4, a: 0.05 + rnd() * 0.09 });
    const links: Array<[number, number]> = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y;
        if (dx * dx + dy * dy < 110 * 110 && rnd() < 0.5) links.push([i, j]);
      }
    const cw = Math.min(W * 0.9, 480);
    const cap: SceneCap = { x: (W - cw) / 2, w: cw, y: H * 0.012, h: H * 0.94, cx: 0, floorY: 0, haloY: 0 };
    cap.cx = cap.x + cap.w / 2;
    cap.floorY = cap.y + cap.h * 0.875;
    cap.haloY = cap.y + cap.h * 0.1;
    const ringR = cap.w * 0.33, soilR = cap.w * 0.135;
    const cracks = [];
    for (let i = 0; i < 46; i++) {
      const a = rnd() * TAU;
      cracks.push({ a, r0: soilR * 1.06, r1: soilR * 1.1 + rnd() * (ringR - soilR) * 0.95, al: 0.15 + rnd() * 0.4, wob: (rnd() - 0.5) * 0.3 });
    }
    scene = { stars, links, cap, ringR, soilR, cracks };
  }

  function buildPlant() {
    const CL = climateModel(live.current.climate);
    const rnd = mulberry32(seed * 7919 + 13);
    const P = live.current.dev;
    const cap = scene!.cap, cx = cap.cx, baseY = cap.floorY - 6;
    const ceil = cap.haloY + cap.h * 0.1, A = baseY - ceil;
    const d = day;

    // Stretch animation: the flowering stretch ramps over ~4 weeks (not a few
    // days), driven by the strain's stretchFactor (S.stretch) — sativas explode
    // upward, indicas barely move. Animates as `day` advances.
    let hN: number;
    if (d <= 10) hN = lerp(0.05, 0.13, smooth(d / 10));
    else if (d <= 34) hN = lerp(0.13, 0.55, Math.pow((d - 10) / 24, 0.75));
    else hN = lerp(0.55, clamp(0.6 * S.stretch, 0, 0.97), smooth(clamp((d - 34) / 28, 0, 1)));
    hN = clamp(hN * S.heightMul * (0.85 + 0.15 * CL.growthMult), 0.05, 0.97);
    const stemH = A * hN;

    // Main stem: tapered (drawn thick→thin) with gentle noise so it isn't a
    // straight line.
    const wob1 = (rnd() - 0.5) * stemH * 0.15, wob2 = (rnd() - 0.5) * stemH * 0.09;
    const spine = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const segNoise = (rnd() - 0.5) * stemH * 0.012; // small per-segment kink
      spine.push({ x: cx + wob1 * Math.sin(Math.PI * t) + wob2 * Math.sin(TAU * t) * 0.5 + segNoise * Math.sin(t * 9), y: baseY - stemH * t, t });
    }

    const nodes: Node[] = [];
    const flowering = stageOf() === "flowering" || stageOf() === "late_flower" || stageOf() === "harvest";
    // Node density: the strain silhouette sets the canopy fill, and flowering
    // packs a few more nodes in to close the gaps the bare skeleton left. Established
    // vegetative growth (past the first couple weeks) gets a milder boost too — a
    // mature veg plant should read leafy and branchy, not leggy, before it ever
    // flowers (owner: "vegetative stage should look leafy and branchy").
    // Round 2 (owner mockup): denser flowering canopy — the mockup plant carries
    // colas + fans at every tier with almost no empty space inside the outline,
    // so flowering packs more nodes (1.18 → 1.32) and the hard cap rises 18 → 20.
    // Round 8 (owner "10/10" hero render — airier candelabra): the round-2..7
    // density push overshot — the live plant read as a solid fir-tree mass with
    // colas crowding into one another, no dark air between them. The hero shows
    // FEWER, more vertically-separated tiers so each cola reads as a distinct
    // spear. Pack cut (1.42 → 1.16) and the hard cap lowered (20 → 16): fewer
    // flowering tiers over the same stem height = a visible vertical gap between
    // each cola. Foliage per node is untouched (fans still fill the interior),
    // so the plant stays leaf-full/airy — not bare.
    const flowerPack = flowering ? 1.16 : d > 14 ? 1.1 : 1;
    const nodeTarget = Math.floor((hN / S.internode) * SK.nodeDensity * SK.vertStack * flowerPack);
    const maxNodes = Math.min(16, Math.max(d <= 10 ? 1 : 2, nodeTarget));
    const grow = smooth(clamp((d - 8) / 22, 0, 1));
    // Engine 3 — phyllotaxy: azimuths winding around the stem (decussate at the
    // base → 137.5° golden spiral toward the apex). Veg keeps a gentle spiral
    // (the maturity floor); flowering winds it the rest of the way. A per-plant
    // phase rotates the whole pattern so two plants of a strain never line up —
    // this is the biggest single "no two plants look identical" lever.
    const maturity = clamp(
      lerp(0.42, 1, smooth(clamp((d - 12) / 40, 0, 1))) + (flowering ? 0.14 : 0),
      0.42, 1,
    );
    const phase = mulberry32((seed * 2246822519) >>> 0)() * TAU;
    const azi = phyllotaxis(maxNodes, maturity, phase);
    // Engines 1 & 2 — apical dominance: how many co-dominant tops compete with
    // the leader. High dominance → 1 cola (spear); low → several upright tops
    // (bush). Only the highest nodes are promoted, and only in flower (a veg
    // plant has no colas yet), so veg/seedling silhouettes are unchanged.
    const tops = colaTops(SK.apicalDominance);
    const nTop = flowering ? Math.min(tops.count - 1, Math.max(0, maxNodes - 2)) : 0;
    const topFromIdx = maxNodes - nTop; // nodes at index >= this become co-colas
    for (let i = 0; i < maxNodes; i++) {
      // Genetic/organic internode spacing: tighter toward the apex (more so for
      // spear strains, via vertStack), plus per-node jitter so nodes aren't
      // perfectly even (real plants vary).
      const fBase = (i + 1) / (maxNodes + 1);
      const stackExp = lerp(1.0, 1.22, clamp(SK.vertStack - 0.96, 0, 0.3) / 0.3);
      const f = clamp(Math.pow(fBase, stackExp) + (rnd() - 0.5) * 0.045, 0.04, 0.96);
      const p = spine[Math.round(f * 24)];
      const low = Math.pow(1 - f, 0.75); // 1 at the base → 0 at the apex
      // Round 4 (owner harvest reference): the near-apex flowering side-colas
      // used to sit almost flush against the leader (spread≈1, same as any
      // upper node), so their bud spikes overlapped it. Widen their lateral
      // reach too — not just their tilt (below) — so the top 2-3 colas read
      // as a clearly separated candelabra instead of one fused column.
      // Round 8 (hero render): the splay band starts lower (0.58 → 0.46) and is
      // wider so more of the upper-half side branches — not just the top 2-3 —
      // fan away from the spine, opening the crowded upper column into a
      // separated candelabra.
      const apexSplay = smooth(clamp((f - 0.46) / 0.36, 0, 1));
      // Round 5 (specialist code review, 2026-07-03): 1.8x was actively WIDENING
      // the f≈0.58-0.88 band — exactly the zone that should be narrowing toward
      // a cone apex — producing the "shoulders/flare" the mockup doesn't have.
      // Tamed to 1.25x: enough to keep genuinely multi-cola strains (White
      // Rhino, Purple Diddy Punch — their own high-`lowerSpread`/low-
      // `apicalDominance` identity carries the candelabra look) visibly
      // separated, without flaring a single-leader cone's shoulders.
      // Lower branches splay wide (skirt); upper branches tuck in and shorten.
      // Round 8 (hero render): apex-splay reach widened (1.25 → 1.5) so the
      // upper side colas are held clearly OUT from the leader — distinct
      // separated spears with dark air between, not a fused vertical column.
      const spread = lerp(1, SK.lowerSpread, low) * lerp(1, 1.5, apexSplay);
      const shorten = 1 - SK.upperShorten * f;
      // Engine 3/4: azimuth → signed-and-foreshortened horizontal projection
      // (lateral) + front/back depth. `side` keeps its legacy ±1 meaning for the
      // sign-dependent geometry below; `lateral` carries the foreshortening so a
      // branch winding toward/away from the camera reads narrower.
      const az = azi[i];
      const side = az.side;
      const lateral = az.lateral;
      // Engines 1&2: is this node a co-dominant top (one of the highest `nTop`)?
      const topK = nTop > 0 && i >= topFromIdx ? i - topFromIdx : -1;
      // Splay the near-apex flowering side-colas outward (see `apexSplay`
      // above) so they visibly lean away from the leader instead of tucking
      // in parallel to it — this is what actually separates the spike tips,
      // not just their attachment point.
      // Round 5 (specialist code review, 2026-07-03): the tilt term scales down
      // proportionally with the spread cut above (0.55 * 1.25/1.8 ≈ 0.17) so the
      // upper-middle stops flaring outward on both axes at once, not just one.
      // Round 8 (hero render): more branch angle away from vertical, especially
      // in the splay band (0.17 → 0.28) and low skirt (1.12 → 1.18) — a branch
      // that reaches out sideways carries its cola away from the spine, which is
      // what actually separates the spears (their attachment points AND their
      // tips), instead of a column of near-parallel upright colas.
      let tilt = (0.98 + rnd() * 0.3) * (1 - f * 0.2 + apexSplay * 0.28) * lerp(1, 1.18, low);
      // Round 2 (owner mockup): back to 0.27 — with the mid-branch fans and
      // extra branchlets filling the arcs, the wider reach buys the fuller
      // pine-tree silhouette without the "floating buds" regression.
      // Round 5 (specialist code review, 2026-07-03): taper steepened
      // (0.35 + 0.65*low) → (0.24 + 0.76*low) — branch length now falls off
      // faster toward the apex for a crisper, straighter cone silhouette.
      // Round 8 (hero render): longer branches (0.27 → 0.31 base) with a lifted
      // apex floor (0.24 → 0.30) so even the upper branches reach out far enough
      // to hold their cola clear of the leader — the "held further OUT" ask.
      let len = A * 0.31 * S.branchMul * (0.3 + 0.7 * low) * grow * shorten;
      if (topK >= 0) {
        // A released top straightens toward vertical and extends up to race the
        // leader to the canopy — turning a side branch into a competing cola.
        tilt *= lerp(1, 0.42, tops.release);
        len *= lerp(1, 2.6, tops.release);
      }
      // Back branches read a touch smaller as well as darker (aerial perspective).
      const depthSize = lerp(0.86, 1.06, (az.depth + 1) / 2);
      // Lower-canopy skirt (scaling law, not a strain branch): broad-leaf
      // canopies (nodeLeaf ≳ 1.1 — Blue Dream 1.18, White Rhino 1.2) carry a
      // full skirt of LARGE fans low on the plant; spear strains (G13 0.95)
      // stay tidy. Scales with lowness so the upper canopy is unchanged.
      // Round 4: `low` alone decays quickly above the base, leaving a bare
      // stretch of naked stem between the skirt and the flowering top on tall
      // strains (owner harvest reference shows full foliage all the way up
      // to the colas) — a bump centered on the mid-canopy band fills it in,
      // additive to the base-driven skirt so the true skirt is unchanged.
      const midFill = smooth(clamp(1 - Math.abs(f - 0.5) / 0.38, 0, 1));
      const skirt = clamp(low + midFill * 0.55, 0, 1) * clamp((SK.nodeLeaf - 1) / 0.2, 0, 1);
      const nd: Node = {
        x: p.x, y: p.y, f, side, tilt, len, spread,
        // Pass 10 (plant render): fan-leaf demotion — raise budDev suppression
        // 0.25→0.40 and trim skirt bonus 0.40→0.28 so leaves recede behind
        // buds in full flower instead of competing for the same visual real estate.
        leafSize: A * (0.08 + 0.05 * low) * (0.55 + 0.45 * grow) * (1 - 0.40 * P.budDev * f) * depthSize * (1 + skirt * 0.28),
        leaflets: Math.min(S.leafletMax, 3 + 2 * Math.floor(d / 14)),
        phase: rnd() * TAU,
        tipX: 0, tipY: 0, site: null, budRot: 0,
        // Mockup pass: 0.14–0.36 read as exaggerated arced wires at phone size
        // (deferred backlog item from the mobile-readability PR) — steadier,
        // shallower arcs make the plant read sturdy instead of spindly.
        curve: 0.1 + rnd() * 0.14, // upward bend
        weight: 0,
        branchlets: [],
        // Pass 10: node leaf suppression up 0.22→0.35, skirt bonus trimmed 0.5→0.35.
        nodeLeafSize: A * (0.055 + 0.045 * low) * (0.55 + 0.45 * grow) * SK.nodeLeaf * (1 - 0.35 * P.budDev * f) * (1 + skirt * 0.35),
        nodeBud: null,
        depth: az.depth,
        // Round 9 pass 2 (owner: "flat stacked tiers, no front/mid/rear
        // depth"): the paint order already sorts back→front by depth (see
        // `order` in drawPlant), but the ±7 default lightness swing was too
        // subtle to actually read as depth once branches/leaves were also
        // getting individually jittered — bumped to ±10, paired with the new
        // rear-branch desaturation (see drawPlant's branch strokeStyle).
        litAdj: depthShade(az.depth),
        // A camera-facing branch (lateral≈0) shows its fan nearly edge-on; a
        // side-facing one shows it broad — so leaves no longer all billboard.
        leafYaw: foreshorten(lateral, 0.34),
        leafRoll: (rnd() - 0.5) * 0.5,
        skirt,
      };
      // Horizontal projection foreshortens with |lateral|; the tip drops toward the
      // viewer (depth>0, front) or lifts behind the stem (depth<0, back) for volume.
      nd.tipX = Math.sin(nd.tilt) * lateral * nd.len * spread;
      nd.tipY = -Math.cos(nd.tilt) * nd.len * 0.55 + az.depth * nd.len * 0.18;
      // Round 5 (specialist code review, 2026-07-03, punch-list item 7):
      // explicit cone clamp — a straight-taper guarantee on top of the tamed
      // apexSplay/tilt/len math above. Regular branches (topK<0; co-dominant
      // tops are exempt — their wider reach is a deliberate multi-cola
      // silhouette, not a flaw) can't reach past a half-width that shrinks
      // linearly from the base to a small point at the apex, so the outer
      // *edge* of the canopy is always a clean cone regardless of any one
      // node's random tilt/spread roll.
      if (topK < 0) {
        // Pass 8 (plant render): true triangular silhouette — linear taper (1-f)
        // replaces the convex (1-f)^0.75 that made the canopy flare sideways at
        // mid-height. Apex narrowed 0.14→0.10, base widened 0.62→0.70 so the
        // cone sits wider at the skirt while the top stays tight.
        const maxReach = A * lerp(0.10, 0.70 * SK.lowerSpread, 1 - f);
        if (Math.abs(nd.tipX) > maxReach) nd.tipX = Math.sign(nd.tipX) * maxReach;
      }
      if (P.budDev > 0 && topK >= 0) {
        // Co-dominant top → its own cola (a scaled-down sibling of the leader),
        // sized by this top's mass share relative to the leader so the leader
        // still reads as the main cola. Total flower mass is conserved by the
        // leaderShare/secondaryShares split.
        const coShare = tops.secondaryShares[topK] / tops.leaderShare; // ≤1 vs leader
        let axis = stemH * 0.10 * S.clusterLen * SK.colaScale * (0.5 + 0.5 * P.budDev) * lerp(0.72, 1.06, coShare) * (1 + P.ripe * 0.14);
        axis = Math.min(axis, stemH * 0.28);
        // Round 2 (owner mockup): co-cola width up again (0.22/0.29 → 0.24/0.32)
        // so the candelabra tops read as fat buds, still slimmer than the leader.
        const baseW = axis * (S.pattern === "spiral" ? 0.24 : 0.32) * S.clusterFat * (0.92 + 0.12 * P.ripe);
        const nC = Math.max(3, Math.round(S.bracts * (S.pattern === "spiral" ? 1.9 : 1.35)));
        nd.site = buildFlowerSite(rnd, axis, baseW, { pattern: S.pattern, nClusters: nC, bracts: S.bracts, fatMul: 1.1 });
        nd.budRot = nd.side * 0.06;
        nd.weight = lerp(0.95, 1.7, f) * S.clusterFat; // a top cola is heavy
      } else if (P.budDev > 0 && f > S.flowerFrom * 0.65) {
        // Round 3 (owner mockup): gate lowered (×0.65) — the mockup carries a
        // real cola on the LOWEST branch tips too, not just from mid-plant up.
        // Round 4 (owner harvest reference): every flowering side-node used to
        // grow a near-full-size spike, so 6-8 stacked spikes visually swamped
        // the mid-canopy into a "bare stem + random spikes" read instead of a
        // leafy plant with a few clear colas. A steeper, f-weighted curve
        // keeps only the nodes nearest the apex prominent; mid-canopy sites
        // shrink to small accents so the fan leaves (skirt/nodeFans) read as
        // the dominant mass there, matching the reference's leaf-heavy middle.
        // Round 2 (owner mockup): raise the mid-canopy floor (0.26 → 0.42) and
        // soften the curve (1.8 → 1.5) — the mockup carries a READABLE chunky
        // cola at every flowering tier, not accents that vanish mid-plant. The
        // apex-weighted ramp is kept so the top still dominates.
        // Round 3 (owner mockup): the mockup carries FAT colas all the way down
        // the plant — the low-tier floor rises (0.55 → 0.82) and the curve
        // relaxes so the lowest flowering nodes hold a chunky teardrop instead
        // of thinning into accents. The apex-weighted ramp is kept (top still
        // climaxes); only the bottom of the ladder comes up.
        // Round 5 (specialist code review, 2026-07-03): the apex-weighted
        // ramp above (0.95 → 1.22 as f → 1) was inflating EVERY near-apex side
        // node's own bud, not just the true leader — on a single-leader strain
        // that reads as a fan of several similar-size competing spikes at the
        // very top (the residual "candelabra" look after apexSplay alone was
        // tamed). Taper that inflation back down in the apex-splay band,
        // scaled by how dominant this strain's leader is (SK.apicalDominance)
        // — a high-dominance spear (G13, Gelato) shrinks its near-apex side
        // buds so the true leader reads as the unmistakable climax; a low-
        // dominance bush (White Rhino, Purple Diddy Punch) keeps most of its
        // apex bud mass, since several strong tops are that strain's identity.
        const sizeUp = lerp(0.95, 1.22, Math.pow(f, 1.1)) * lerp(1, 0.7, SK.apicalDominance * apexSplay);
        const axis = A * (0.075 + 0.082 * f) * S.clusterLen * sizeUp * (0.5 + 0.5 * P.budDev);
        // Round 2: side colas fatter still (0.33 → 0.37) — the mockup's side
        // buds are chunky teardrops, clearly slimmer than the leader but never
        // thin green fingers. Round 3: low colas fatten a touch more (the
        // mockup's lower buds are as chunky as the mid ones).
        const baseW = axis * (0.37 + 0.07 * (1 - f)) * S.clusterFat;
        // Round 3: low-cola cluster floor up (0.6 → 0.72 base) — low colas
        // stack enough clusters to read as full teardrops, not stubby nubs.
        const nC = Math.max(4, Math.round(S.bracts * 0.85 * (0.72 + 0.4 * f)));
        nd.site = buildFlowerSite(rnd, axis, baseW, { pattern: S.pattern, nClusters: nC, bracts: S.bracts, fatMul: 1 });
        nd.budRot = nd.side * 0.1;
        nd.weight = lerp(0.5, 1.1, f) * S.clusterFat; // higher / fatter buds weigh more
      }
      // A bud forming at the node intersection itself (not just the tip) —
      // upper/mid nodes only, where light reaches and flower sites set. Skipped
      // on co-cola tops, which read as a clean single cola.
      // Round 2 (owner mockup): node buds start lower (0.38 → 0.3) and run
      // bigger — the mockup's mid-plant look is chunky colas hugging the main
      // stem, and these node-intersection buds are exactly that.
      // Round 3 (owner mockup): interior fill — node buds start LOWER (0.3 →
      // 0.24) and run bigger, so the space between the stem and the branch-tip
      // colas carries bud mass at every tier (the mockup has near-zero empty
      // interior). The skirt fans are untouched — this fills, not drowns.
      // Round 8 (hero render): the stem-hugging node bud is the "near-zero empty
      // interior" filler from round 3 — exactly what packed the interior into a
      // solid mass. Gate raised (0.24 → 0.5) so only the UPPER nodes carry one:
      // the lower/mid interior opens to dark air + fan leaves, letting the
      // branch-tip colas read as the distinct separated spears the hero shows.
      if (P.budDev > 0 && topK < 0 && f > Math.max(S.flowerFrom * 0.8, 0.5)) {
        const axis = A * (0.058 + 0.08 * f) * S.clusterLen * (0.5 + 0.5 * P.budDev);
        const baseW = axis * 0.36 * S.clusterFat;
        const nC = Math.max(3, Math.round(S.bracts * 0.7 * (0.5 + 0.5 * f)));
        nd.nodeBud = buildFlowerSite(rnd, axis, baseW, { pattern: S.pattern, nClusters: nC, bracts: S.bracts, fatMul: 0.95, lush: 0.7 });
        nd.weight += 0.25 * S.clusterFat;
      }
      // Secondary branchlets — small forks carrying their own foliage and, in
      // flower, a small bud at the tip. Denser on the lower/mid canopy. Skipped
      // on co-cola tops (they read as a clean single cola).
      if (topK < 0 && nd.len > A * 0.045 && d > 14) {
        let nBL = rnd() < SK.branchletFrac ? 1 : 0;
        if (low > 0.45 && rnd() < SK.branchletFrac * 0.75) nBL += 1;
        // Round 2 (owner mockup): flowering sprouts one more branchlet on most
        // branches — each carries its own fan + small bud, and together they
        // fill the bare mid-branch stretches the mockup plant doesn't have.
        if (flowering && rnd() < 0.6) nBL += 1;
        for (let b = 0; b < nBL; b++) {
          // Round 5 (specialist code review, 2026-07-03): bias the first
          // branchlet on low-tier nodes toward the stem-facing side, close to
          // the branch base — phyllotaxis leaves the opposite ~137° wedge
          // empty each tier, and the longest (lowest-tier) branches leave the
          // biggest gap there with the least correction from the inner fans
          // above. The rest of the branchlets keep the existing along-branch
          // spread/alternating side.
          const wedgeFill = low > 0.55 && b === 0;
          const along = wedgeFill ? 0.15 + rnd() * 0.06 : 0.48 + rnd() * 0.34;
          const side = wedgeFill ? -nd.side : b % 2 ? 1 : -1;
          let blSite: FlowerSite | null = null;
          if (P.budDev > 0 && f > S.flowerFrom * 0.8) {
            // Round 3 (owner mockup): branchlet buds plumper (0.045 → 0.055
            // axis, 0.3 → 0.34 width) — they carry the lower-third bud mass.
            const axis = A * 0.055 * S.clusterLen * (0.5 + 0.5 * P.budDev);
            const baseW = axis * 0.34 * S.clusterFat;
            blSite = buildFlowerSite(rnd, axis, baseW, { pattern: S.pattern, nClusters: 3, bracts: Math.max(5, Math.round(S.bracts * 0.7)), fatMul: 0.85, lush: 0.55 });
            nd.weight += 0.2 * S.clusterFat;
          }
          nd.branchlets.push({
            along, side,
            len: nd.len * (0.4 + rnd() * 0.26), tilt: 0.55 + rnd() * 0.5, curve: 0.08 + rnd() * 0.14,
            leafSize: nd.leafSize * (0.42 + rnd() * 0.16), leaflets: Math.max(3, nd.leaflets - 2),
            phase: rnd() * TAU, site: blSite,
          });
        }
      }
      nodes.push(nd);
    }

    let cola: Plant["cola"] = null;
    if (P.budDev > 0) {
      // Top cola gains mass through flowering and swells further in late flower
      // (ripeness) — the apex should be the visual climax, not a tidy spike.
      const lateMass = 1 + P.ripe * 0.14;
      // Engines 1&2: when the canopy shares its mass across several tops the
      // leader cola shrinks toward its share (but never below ~0.72×, so it still
      // reads as THE main cola — mockup pass raised the floor from 0.62 so the
      // apical cola is always the clear visual climax). leaderShare = 1 for
      // single-cola strains → no change.
      const leaderMul = lerp(0.72, 1, tops.leaderShare);
      // Cola LENGTH as a fraction of stem height. The previous coefficients
      // compounded (clusterLen·colaScale·lateMass ≈ 1.8×) into a ~0.6·stemH
      // balloon; a harvest cola should read as a SLIM spear ~25–30% of plant
      // height. Keep the strain-differentiating multipliers but scale the base
      // down, then hard-cap the length so no strain balloons past ~a third of
      // the stem (owner harvest reference, 2026-07-02).
      // Round 2 (owner mockup): leader length up a touch (0.115 → 0.13 of budDev)
      // so the apical cola clearly out-scales the fattened co-colas around it.
      let axis = stemH * (0.06 + 0.13 * P.budDev) * S.clusterLen * SK.colaScale * lateMass * leaderMul;
      axis = Math.min(axis, stemH * 0.4);
      // Slim the cola: width is a small fraction of its length (spear taper), not
      // half of it. Chunky strains stay chunkier via clusterFat; spiral sativas
      // are slimmest. Mockup pass: slightly fatter cluster width so the apical
      // cola reads FULL and dense, not a thin spike.
      // Round 2 (owner mockup): the apical cola is the fattest bud on the plant
      // — width up a notch (0.23/0.3 → 0.26/0.34) so it reads as a chunky
      // teardrop climax, not a slim spike.
      const baseW = axis * (S.pattern === "spiral" ? 0.26 : 0.34) * S.clusterFat * (0.92 + 0.12 * P.ripe);
      // Pack more, smaller clusters up the spine so the cola reads as one dense
      // textured column rather than a handful of big teardrops.
      // Pass 9: raise hybrid/nodal multiplier 1.5→1.85 to hit 17-21 anchor
      // clusters (Gelato bracts=10 → nC=19; indica bracts=11 → nC=20).
      const nC = Math.round(S.bracts * (S.pattern === "spiral" ? 2.1 : 1.85));
      cola = {
        site: buildFlowerSite(rnd, axis, baseW, { pattern: S.pattern, nClusters: nC, bracts: S.bracts, fatMul: 1.18 }),
        x: spine[24].x, y: spine[24].y + axis * 0.06,
      };
    }

    plant = { P, CL, stage: stageOf(), cx, baseY, A, stemH, spine, nodes, cola };
    while (phys.nodes.length < nodes.length) phys.nodes.push({ ao: 0, av: 0 });
    phys.nodes.length = nodes.length;
  }

  function buildMacro() {
    const rnd = mulberry32(seed * 5077 + 7);
    const rr = (a: number, b: number) => a + (b - a) * rnd();
    const dna = live.current.budDna;
    const foxtail = clamp(S.foxtail ?? 0, 0, 1);

    // DNA dimensions are in abstract units; scale so budHeight maps to ~0.6·H.
    // The maxBudWidth/budHeight ratio is what distinguishes a chunky indica
    // cola from a slim sativa one across strains.
    const scale = (H * 0.6) / dna.budHeight;
    const budH = dna.budHeight * scale;
    const budW = dna.maxBudWidth * scale;
    const centerX = W * 0.5;
    const baseY = H * 0.9;
    const topY = baseY - budH;
    const sizeMul = lerp(1.0, 1.28, clamp((dna.overlap - 0.6) / 0.15, 0, 1));

    // ---- Concentric ring packing (botanical bracts, NOT independent blobs) ----
    // Calyxes are packed in rings around the cola spine. Each ring is offset half
    // a step from the previous so calyxes nest in the gaps (pinecone / sunflower /
    // dragon-scale packing). Ring radius follows the sin silhouette (narrow top,
    // wide centre, tapered base) and the count peaks in the middle (e.g. 1·3·5·8·5·3).
    // Depth comes from the ring angle, so calyxes wrap front↔back for real volume.
    // Organic noise (±8° angle, ±6% radius, ±25° rotation, ±15% scale) avoids any
    // perfect spacing or symmetry.
    const ratio = dna.maxBudWidth / dna.budHeight;
    const fatT = clamp((ratio - 0.44) / 0.19, 0, 1);
    const widthExp = lerp(1.0, 1.3, fatT); // chunkier strains carry mass lower
    const nRings = Math.round(dna.rows * 1.25);
    const ANG_NOISE = 8 * (Math.PI / 180);

    const calyxes: MacroCalyx[] = [];
    const pistils: MacroPistil[] = [];
    const sugar: MacroLeaf[] = [];
    for (let ring = 0; ring < nRings; ring++) {
      const progress = nRings === 1 ? 0.5 : ring / (nRings - 1); // 0 top → 1 bottom
      const y = topY + progress * budH;
      const widthCurve = Math.sin(Math.pow(progress, widthExp) * Math.PI);
      const ringRadius = (widthCurve * budW) / 2;
      const count = Math.max(1, Math.round(widthCurve * dna.calyxPerRowMax)); // 1 → max → 1
      const angleStep = TAU / count;
      // Ring offset = golden-angle twist per ring (137.5°, so rings never column
      // up — pinecone/sunflower phyllotaxy) + a half-step brick nest so each
      // calyx sits in the previous ring's gap.
      const ringOffset = ring * 2.39996323 + (ring % 2) * angleStep * 0.5;
      const topness = clamp((0.4 - progress) / 0.4, 0, 1);
      const foxBias = dna.foxtailBias ?? 0;
      const topStretch = dna.topStretch ?? 0;
      for (let i = 0; i < count; i++) {
        const angle = i * angleStep + ringOffset + rr(-ANG_NOISE, ANG_NOISE); // ±8°
        const radius = ringRadius * (1 + rr(-0.06, 0.06)); // ±6%
        const x = centerX + Math.cos(angle) * radius;
        const depth = clamp((Math.sin(angle) + 1) / 2, 0, 1); // back(0) → front(1)
        const sizePx = rr(dna.calyxSizeMin, dna.calyxSizeMax) * lerp(0.78, 1.15, widthCurve) * sizeMul * (1 + rr(-0.15, 0.15)); // ±15%
        let w = sizePx * scale;
        // Shape mix (§5): teardrop 40 / oval 25 / pointed 20 / foxtail 15; env
        // light-stress pushes pointed/foxtail near the top. Height > width.
        const sr = rnd();
        const foxCut = 0.85 - foxtail * 0.2 - foxBias * 0.22 - topness * topStretch * 0.15;
        // Keep the oval band thin (ovals = the "grape" look) and above the
        // widened teardrop share (calyxShapeFor takes teardrops to 0.52).
        const ovalCut = Math.min(0.7 - topness * topStretch * 0.2, foxCut - 0.04);
        const shape = calyxShapeFor(sr, ovalCut, foxCut);
        let h: number;
        if (shape === 0) { h = w * rr(1.25, 1.5); }
        else if (shape === 1) { h = w * rr(1.2, 1.35); }
        else if (shape === 2) { h = w * rr(1.5, 1.8); }
        else { w *= 0.78; h = w * rr(2.0, 2.5); }
        if (topStretch > 0) h *= 1 + topness * topStretch * 0.6;
        const col = pickPaletteColor(dna.palette, rnd());
        calyxes.push({
          x, y: y + rr(-3, 3) * scale, w, h,
          rot: rr(-25, 25) * (Math.PI / 180) * (1 + topness * topStretch * 0.7), // ±25°
          depth,
          hue: col.hue + rr(-8, 8), sat: col.sat, lit: col.lit + rr(-6, 6),
          shape, phase: rnd(),
        });
        if (rnd() < dna.pistilChance) {
          pistils.push({
            x, y: y + rr(-3, 3) * scale, a: -Math.PI / 2 + rr(-0.95, 0.95),
            len: 0.5 + rnd() * 0.6, bend: rr(-1.1, 1.1), k: rnd() * 0.85,
          });
        }
        if (rnd() < dna.sugarLeafChance) {
          sugar.push({ x, y, sz: budH * (0.08 + 0.05 * widthCurve) * rr(0.85, 1.2), rot: rr(-0.95, 0.95) });
        }
      }
    }
    calyxes.sort((a, b) => a.depth - b.depth); // back → front

    // Trichomes — fine frost anchored to a calyx so it reveals with its host
    // (not floating), scaled by the strain's density.
    const trichs: MacroTrich[] = [];
    const nT = Math.round(calyxes.length * dna.trichomeDensity * 2.4);
    for (let i = 0; i < nT; i++) {
      const c = calyxes[Math.floor(rnd() * calyxes.length)];
      trichs.push({
        x: c.x + rr(-1, 1) * c.w * 0.5,
        y: c.y + rr(-1, 1) * c.h * 0.4,
        r: 0.5 + rnd() * 0.9, k: rnd(), mat: rnd(), depth: c.depth,
      });
    }
    const core = dominantPaletteColor(dna.palette);
    macroBud = { centerX, baseY, topY, budH, budW, coreHue: core.hue, coreSat: core.sat, calyxes, pistils, trichs, sugar };

    // Static backdrop, computed once (deterministic from seed + canvas size).
    const brnd = mulberry32(seed * 131 + 17);
    macroBokeh = [];
    for (let i = 0; i < 9; i++) {
      const x = brnd() * W, y = brnd() * H * 0.82, r = 26 + brnd() * 72;
      const tone = brnd() < 0.5 ? "190,232,210" : "150,208,168";
      const grad = ctx!.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${tone},0.16)`);
      grad.addColorStop(1, `rgba(${tone},0)`);
      macroBokeh.push({ x, y, r, grad });
    }
    const lrnd = mulberry32(seed * 911 + 3);
    macroLeaves = [];
    const nLeaf = 7;
    for (let i = 0; i < nLeaf; i++) {
      const yf = 0.12 + (i / (nLeaf - 1)) * 0.74;
      const side = i % 2 ? 1 : -1;
      macroLeaves.push({
        lx: side * budW * (0.7 + lrnd() * 0.4),
        ly: -yf * budH,
        lsz: budH * (0.34 - 0.16 * yf) * (0.9 + lrnd() * 0.3),
        rot: side * (1.05 + lrnd() * 0.3) - 0.1,
      });
    }
  }

  // ---- leaves ----
  const FAN_A = [0, 0.42, -0.42, 0.85, -0.85, 1.22, -1.22, 1.5, -1.5];
  const FAN_M = [1, 0.86, 0.86, 0.7, 0.7, 0.52, 0.52, 0.36, 0.36];
  // Cheap deterministic hash (GLSL-style sin/frac) for per-leaflet jitter. Pure
  // function of (seed, i, k) — no RNG stream consumed, so it's safe to call every
  // frame from the draw path without touching build-time determinism/pinned
  // tests. `seed` is a stable per-node/per-fan value already on hand (nd.phase,
  // bl.phase, lf.rot, …), so the same fan always jitters the same way — no
  // frame-to-frame flicker — while different fan instances read differently.
  function fanJit(seed: number, i: number, k: number): number {
    const x = Math.sin(seed * 12.9898 + i * 78.233 + k * 37.719) * 43758.5453;
    return x - Math.floor(x); // 0..1
  }
  // Engine 4 — fan-leaf orientation. `litAdj` shades the leaf by canopy depth;
  // `yaw` horizontally squashes the whole fan (1 = broad/face-on, →0 edge-on) so a
  // leaf on a branch winding toward the camera turns side-on instead of billboarding.
  // `seed` breaks every fan out of the identical-decal look (owner: "leaves ...
  // hard to explain" — flat, stamped, no texture layering): per-leaflet length/
  // width/angle/tone jitter plus a light↔shadow gradient fill (was one flat
  // hsl()) so each leaflet reads as a folded blade with its own facet, not a
  // solid-colour sticker.
  function drawFan(size: number, n: number, topBoost: number, claw: number, litAdj = 0, yaw = 1, seed = 0) {
    // Clamp to the FAN_A/FAN_M table length: a future per-strain leaflet count
    // above 9 would otherwise index past the arrays → undefined → NaN geometry.
    const leaflets = Math.min(n, FAN_A.length);
    const hue = leafTone.hue, sat = leafTone.sat;
    // Bug fix (2026-07-04, "black blob" glitch — found on White Rhino/Blue
    // Dream late-flower renders): this sum has no floor. `leafTone.litBias`
    // alone can reach -18 to -21 (mature -3-9 always-on, teal strains like
    // Blue Dream −9 more), and callers stack further per-fan "recede" darkening
    // on top (skirt/inner/node fans pass litAdj down to nd.litAdj-6, minus up
    // to -8 more for skirt) — so on a rear (litAdj<0), fully-mature, skirt/
    // interior fan the pre-jitter lightness already lands at or below 0. The
    // per-leaflet gradient below (litJ ± jitter) then feeds a NEGATIVE
    // lightness into hsl(), which canvas clamps to 0% — pure black — instead
    // of a dark shaded green. Clamping here keeps every fan's darkest
    // recede/depth/skirt combination visibly dark-green instead of crushing
    // to black, without touching any strain's base hue/sat identity.
    const lit = clampLeafLightness(S.lit + leafTone.litBias + topBoost * 6 + litAdj);
    const arch = leafTone.arch;
    // Round 9 pass 2 (owner: "leaf fans... hover near a bud rather than
    // clearly emerging from a branch joint"). Every fan call site already
    // translates to a real point ON the branch/node before drawing (this
    // function only ever sees its own local origin), but with nothing drawn
    // AT that origin besides the leaflets' own short, thin petioles, a small
    // fan can read as a free-floating cluster rather than something rooted in
    // woody material. A short branch-toned nub at the origin — drawn first,
    // so the leaflets layer over its tip — gives every fan a visible peg it
    // plugs into, independent of bud/cola draw order.
    {
      const nubW = Math.max(1, size * 0.05);
      ctx!.save();
      ctx!.strokeStyle = `hsl(${S.hue - 8}, 30%, ${clamp(26 + litAdj, 14, 40)}%)`;
      ctx!.lineWidth = nubW;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(0, size * 0.05);
      ctx!.lineTo(0, -size * 0.14);
      ctx!.stroke();
      ctx!.restore();
    }
    const yawed = yaw < 0.999;
    if (yawed) {
      ctx!.save();
      ctx!.scale(yaw, 1);
    }
    for (let i = 0; i < leaflets; i++) {
      const jL = fanJit(seed, i, 1), jA = fanJit(seed, i, 2), jT = fanJit(seed, i, 3);
      const L = size * FAN_M[i] * (0.86 + 0.28 * jL), Wd = L * 0.32 * S.leafW * (0.88 + 0.24 * fanJit(seed, i, 4));
      const a =
        FAN_A[i] +
        (claw ? Math.sign(FAN_A[i] || 1) * claw * (0.2 + Math.abs(FAN_A[i]) * 0.5) : 0) +
        (jA - 0.5) * 0.16;
      // Outer leaflets arch over harder than the central spike, so the whole fan
      // cups downward/outward (natural relaxed leaf) rather than splaying flat.
      const curl = arch * (0.5 + Math.abs(FAN_A[i]) * 0.7);
      // Per-leaflet tone jitter (±3 lit / ±4 sat) so a fan isn't 7 identical
      // swatches — real foliage has this much natural variation leaflet to leaflet.
      // Clamped again here, not just on `lit` above (code-review fix,
      // 2026-07-04): this ±3 jitter is applied AFTER `lit`'s floor, so it can
      // still push the per-leaflet value below the floor `lit` itself
      // enforces (e.g. lit=10, jT=0 -> litJ=7). `lit`'s clamp guards the fan
      // as a whole; this one guards the actual value that reaches hsl().
      const litJ = clampLeafLightness(lit + (jT - 0.5) * 6), satJ = clamp(sat + (fanJit(seed, i, 5) - 0.5) * 8, 0, 100);
      ctx!.save();
      ctx!.rotate(a);
      ctx!.strokeStyle = `hsl(${hue}, ${satJ * 0.7}%, ${litJ * 0.8}%)`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(0, 0);
      ctx!.lineTo(0, -size * 0.12);
      ctx!.stroke();
      ctx!.translate(0, -size * 0.12);
      // Light↔shadow facet: a cross-blade gradient (not a flat fill) so each
      // leaflet reads as a folded surface catching light unevenly — the layering
      // a single hsl() fill can't carry. The lit edge leans toward whichever side
      // this leaflet already tilts (jA), so the facet direction varies fan to fan.
      const litSide = jA < 0.5 ? -1 : 1;
      const facet = ctx!.createLinearGradient(-litSide * Wd, 0, litSide * Wd, 0);
      facet.addColorStop(0, `hsl(${hue}, ${Math.max(0, satJ - 6)}%, ${Math.max(6, litJ - 9)}%)`);
      facet.addColorStop(0.48, `hsl(${hue}, ${satJ}%, ${litJ}%)`);
      facet.addColorStop(1, `hsl(${hue}, ${Math.min(76, satJ + 8)}%, ${Math.min(70, litJ + 10)}%)`);
      ctx!.fillStyle = facet;
      leafletPath(L, Wd, curl);
      ctx!.fill();
      ctx!.strokeStyle = "rgba(0,0,0,0.22)";
      ctx!.lineWidth = 0.6;
      ctx!.stroke();
      // Central vein (light) + an adjacent shadow crease on the shaded side —
      // the pair is what sells a folded blade instead of a flat cutout.
      ctx!.strokeStyle = "rgba(255,255,255,0.1)";
      ctx!.beginPath();
      ctx!.moveTo(0, 0);
      ctx!.lineTo(0, -L * 0.96 + curl * L);
      ctx!.stroke();
      ctx!.strokeStyle = "rgba(0,0,0,0.14)";
      ctx!.lineWidth = 0.5;
      ctx!.beginPath();
      ctx!.moveTo(-litSide * Wd * 0.3, -L * 0.1);
      ctx!.lineTo(-litSide * Wd * 0.55, -L * 0.7 + curl * L);
      ctx!.stroke();
      ctx!.restore();
    }
    if (yawed) ctx!.restore();
  }

  // ---- physics + dust ----
  function applyPointer(dt: number) {
    if (!ptr.active || Math.abs(ptr.vx) < 30) {
      ptr.vx *= 0.82;
      return;
    }
    const R = 95;
    if (view === "macro") {
      phys.bud.av = clamp(phys.bud.av + ptr.vx * 0.000012 * 3600 * dt, -1.2, 1.2);
      if (Math.abs(ptr.vx) > 420) spawnDust(ptr.x, ptr.y, 1);
    } else if (plant) {
      for (let i = 0; i < plant.nodes.length; i++) {
        const nd = plant.nodes[i];
        const wx = nd.x + nd.tipX, wy = nd.y + nd.tipY;
        const d = Math.min(Math.hypot(ptr.x - wx, ptr.y - wy), Math.hypot(ptr.x - nd.x, ptr.y - nd.y));
        if (d < R) {
          const fall = 1 - d / R;
          phys.nodes[i].av = clamp(phys.nodes[i].av + ptr.vx * 0.0000792 * fall * 3600 * dt / 60, -2.2, 2.2);
          if (Math.abs(ptr.vx) * fall > 260) spawnDust(wx, wy, fall);
        }
      }
      if (plant.cola) {
        const top = plant.spine[24];
        const d = Math.hypot(ptr.x - top.x, ptr.y - (top.y + plant.stemH * 0.08));
        if (d < R + 20) {
          const fall = 1 - d / (R + 20);
          phys.cola.av = clamp(phys.cola.av + ptr.vx * 0.000016 * fall * 3600 * dt, -1.6, 1.6);
          if (Math.abs(ptr.vx) * fall > 260) spawnDust(top.x, top.y + plant.stemH * 0.06, fall);
        }
      }
    }
    ptr.vx *= 0.82;
  }
  function spawnDust(x: number, y: number, fall: number) {
    const flowering = live.current.dev.budDev > 0.1;
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      if (dust.length >= DUST_MAX) dust.shift();
      dust.push({
        x: x + (Math.random() - 0.5) * 22, y: y + (Math.random() - 0.5) * 16,
        vx: ptr.vx * 0.1 * fall + (Math.random() - 0.5) * 24, vy: -14 + Math.random() * 22,
        r: 0.8 + Math.random() * 0.9, life: 0.7 + Math.random() * 0.45, max: 1.1, gold: flowering,
      });
    }
  }
  function stepPhysics(dt: number) {
    applyPointer(dt);
    for (const s of phys.nodes) {
      s.ao += s.av * dt;
      s.av += (-SPRING_K * s.ao - SPRING_C * s.av) * dt;
      s.ao = clamp(s.ao, -0.5, 0.5);
    }
    for (const c of [phys.cola, phys.bud]) {
      c.ao += c.av * dt;
      c.av += (-SPRING_K * 1.15 * c.ao - SPRING_C * c.av) * dt;
      c.ao = clamp(c.ao, -0.35, 0.35);
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const dd = dust[i];
      dd.life -= dt;
      if (dd.life <= 0) {
        dust.splice(i, 1);
        continue;
      }
      dd.vy += 150 * dt;
      dd.x += dd.vx * dt;
      dd.y += dd.vy * dt;
    }
    windPhase += dt * (1 + (live.current.climate.fan / 100) * 2.5);
  }

  function drawChamberShell(tt: number) {
    const cap = scene!.cap;
    const fan = live.current.climate.fan;
    const co2 = live.current.climate.co2;
    // Arcade layer (Phase 2) glow intensity. Always-on baseline so the plant
    // separates from the dark panel even in veg; ramps as the plant flowers so
    // mature colas "pop" hardest (matches the hero render). budDev is server
    // truth from the live dev params.
    // TODO(arcade): modulate this by the active boost multiplier once the
    // boostEngine store is threaded into the renderer. That is out of scope
    // here — it would require plumbing new React state through
    // createChamberCore, and the DOM BoostAmbientLayer (PR #124) already
    // reacts to boosts on the overlay. Keep this always-on baseline.
    const arcBudDev = clamp(live.current.dev.budDev, 0, 1);
    const arcBloom = 0.5 + 0.5 * arcBudDev; // canopy back-glow strength
    const arcRing = 0.55 + 0.45 * arcBudDev; // pot-ring / soil-pad strength
    let g = ctx!.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#060d16");
    g.addColorStop(1, "#04080e");
    ctx!.fillStyle = g;
    ctx!.fillRect(0, 0, W, H);
    ctx!.strokeStyle = "rgba(127,212,240,0.07)";
    ctx!.lineWidth = 1;
    for (const [i, j] of scene!.links) {
      ctx!.beginPath();
      ctx!.moveTo(scene!.stars[i].x, scene!.stars[i].y);
      ctx!.lineTo(scene!.stars[j].x, scene!.stars[j].y);
      ctx!.stroke();
    }
    for (const st of scene!.stars) {
      ctx!.globalAlpha = st.a;
      ctx!.fillStyle = "#bfe5f5";
      ctx!.beginPath();
      ctx!.arc(st.x, st.y, st.r, 0, TAU);
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;

    g = ctx!.createLinearGradient(0, cap.y, 0, cap.y + cap.h);
    g.addColorStop(0, "#0c2334");
    g.addColorStop(0.55, "#0a1d2c");
    g.addColorStop(1, "#081522");
    ctx!.fillStyle = g;
    ctx!.beginPath();
    ctx!.roundRect(cap.x, cap.y, cap.w, cap.h, 34);
    ctx!.fill();
    ctx!.fillStyle = "#0a1a28";
    ctx!.beginPath();
    ctx!.roundRect(cap.x - 6, cap.y - 4, cap.w + 12, cap.h * 0.07, 20);
    ctx!.fill();
    ctx!.beginPath();
    ctx!.roundRect(cap.x - 6, cap.y + cap.h * 0.965, cap.w + 12, cap.h * 0.05, 14);
    ctx!.fill();

    const hx = cap.cx, hy = cap.haloY, hr = cap.w * 0.3;
    g = ctx!.createLinearGradient(0, hy, 0, cap.floorY);
    g.addColorStop(0, "rgba(140,214,244,0.13)");
    g.addColorStop(1, "rgba(140,214,244,0)");
    ctx!.fillStyle = g;
    ctx!.beginPath();
    ctx!.moveTo(hx - hr * 0.92, hy);
    ctx!.lineTo(hx + hr * 0.92, hy);
    ctx!.lineTo(hx + hr * 1.35, cap.floorY);
    ctx!.lineTo(hx - hr * 1.35, cap.floorY);
    ctx!.closePath();
    ctx!.fill();
    ctx!.save();
    ctx!.shadowColor = "rgba(150,222,250,0.9)";
    ctx!.shadowBlur = 26;
    ctx!.strokeStyle = "#cfeeff";
    ctx!.lineWidth = Math.max(5, cap.w * 0.022);
    ctx!.beginPath();
    ctx!.ellipse(hx, hy, hr, hr * 0.26, 0, 0, TAU);
    ctx!.stroke();
    ctx!.restore();
    ctx!.strokeStyle = "rgba(10,30,44,0.85)";
    ctx!.lineWidth = 3;
    ctx!.beginPath();
    ctx!.ellipse(hx, hy, hr * 0.55, hr * 0.13, 0, 0.4, Math.PI - 0.4);
    ctx!.stroke();

    // ── Arcade layer (Phase 2): in-canvas rim / back glow behind the plant ──
    // The chamber panel is fully OPAQUE, so a green backlight cannot bleed
    // through via a CSS drop-shadow (that is why PR #124's rim pop is a DOM
    // screen-blend overlay). Here we paint the same "pop" INSIDE the canvas,
    // behind the canopy, with additive ("lighter") compositing so it reads as
    // LIGHT, not a flat shape — each cola separates from the dark panel and
    // glows. drawChamberShell runs before drawPlant, so this always lands
    // behind the plant.
    if (plant) {
      const gx = plant.cx;
      const canopyTop = plant.baseY - plant.stemH;
      // Wide soft green column halo hugging the whole canopy.
      ctx!.save();
      ctx!.globalCompositeOperation = "lighter";
      const gy = canopyTop + plant.stemH * 0.4;
      const gw = cap.w * 0.46;
      const gh = plant.stemH * 0.62;
      ctx!.translate(gx, gy);
      ctx!.scale(1, gh / gw);
      const halo = ctx!.createRadialGradient(0, 0, 0, 0, 0, gw);
      halo.addColorStop(0, `rgba(102,230,124,${0.24 * arcBloom})`);
      halo.addColorStop(0.42, `rgba(74,200,110,${0.12 * arcBloom})`);
      halo.addColorStop(1, "rgba(60,170,95,0)");
      ctx!.fillStyle = halo;
      ctx!.beginPath();
      ctx!.arc(0, 0, gw, 0, TAU);
      ctx!.fill();
      ctx!.restore();
      // Brighter apical core bloom hugging the top colas.
      ctx!.save();
      ctx!.globalCompositeOperation = "lighter";
      const coreY = canopyTop + plant.stemH * 0.24;
      const coreR = cap.w * 0.27;
      const core = ctx!.createRadialGradient(gx, coreY, 0, gx, coreY, coreR);
      core.addColorStop(0, `rgba(156,255,156,${0.18 * arcBloom})`);
      core.addColorStop(0.55, `rgba(102,230,124,${0.07 * arcBloom})`);
      core.addColorStop(1, "rgba(96,224,120,0)");
      ctx!.fillStyle = core;
      ctx!.beginPath();
      ctx!.arc(gx, coreY, coreR, 0, TAU);
      ctx!.fill();
      ctx!.restore();
    }

    const fy = cap.floorY;
    ctx!.fillStyle = "#0b1d2b";
    ctx!.beginPath();
    ctx!.ellipse(hx, fy + 8, cap.w * 0.4, 18, 0, 0, TAU);
    ctx!.fill();
    // ── Arcade layer (Phase 2): bright green energy ring around the pot base ─
    // A wide additive green bloom seated under the ring, then a bright green
    // ring stroke with a strong glow — the teal tech-ring reads as the hero
    // render's glowing green energy ring.
    ctx!.save();
    ctx!.globalCompositeOperation = "lighter";
    const ringGlow = ctx!.createRadialGradient(
      hx, fy + 6, scene!.ringR * 0.2,
      hx, fy + 6, scene!.ringR * 1.18,
    );
    ringGlow.addColorStop(0, `rgba(96,232,124,${0.15 * arcRing})`);
    ringGlow.addColorStop(0.6, `rgba(74,200,110,${0.07 * arcRing})`);
    ringGlow.addColorStop(1, "rgba(74,200,110,0)");
    ctx!.fillStyle = ringGlow;
    ctx!.beginPath();
    ctx!.ellipse(hx, fy + 6, scene!.ringR * 1.18, scene!.ringR * 0.3, 0, 0, TAU);
    ctx!.fill();
    ctx!.restore();
    ctx!.save();
    ctx!.shadowColor = `rgba(120,255,140,${0.7 * arcRing})`;
    ctx!.shadowBlur = 22;
    ctx!.strokeStyle = `rgba(150,255,162,${0.5 + 0.4 * arcRing})`;
    ctx!.lineWidth = 3;
    ctx!.beginPath();
    ctx!.ellipse(hx, fy + 6, scene!.ringR, scene!.ringR * 0.24, 0, 0, TAU);
    ctx!.stroke();
    ctx!.restore();
    // Clean white-green radiating spokes/tick-marks (hero render), with a soft
    // glow so they read as light rather than hairline scratches.
    ctx!.save();
    ctx!.shadowColor = "rgba(150,255,170,0.55)";
    ctx!.shadowBlur = 5;
    ctx!.strokeStyle = "rgba(214,255,222,1)";
    ctx!.lineCap = "round";
    for (const cr of scene!.cracks) {
      ctx!.globalAlpha = Math.min(1, cr.al + 0.2);
      ctx!.lineWidth = 1.1;
      const a = cr.a;
      ctx!.beginPath();
      ctx!.moveTo(hx + Math.cos(a) * cr.r0, fy + 6 + Math.sin(a) * cr.r0 * 0.24);
      ctx!.quadraticCurveTo(
        hx + Math.cos(a + cr.wob) * (cr.r0 + cr.r1) / 2, fy + 6 + Math.sin(a + cr.wob) * (cr.r0 + cr.r1) / 2 * 0.24,
        hx + Math.cos(a) * cr.r1, fy + 6 + Math.sin(a) * cr.r1 * 0.24,
      );
      ctx!.stroke();
    }
    ctx!.globalAlpha = 1;
    ctx!.restore();
    ctx!.fillStyle = "#33421f";
    ctx!.beginPath();
    ctx!.ellipse(hx, fy + 4, scene!.soilR, scene!.soilR * 0.26, 0, 0, TAU);
    ctx!.fill();
    ctx!.fillStyle = "rgba(120,150,70,0.5)";
    ctx!.beginPath();
    ctx!.ellipse(hx, fy + 2.5, scene!.soilR * 0.92, scene!.soilR * 0.22, 0, 0, TAU);
    ctx!.fill();
    // ── Arcade layer (Phase 2): green glowing soil pad where the stem meets
    // the base — the bright green pad under the plant in the hero render.
    ctx!.save();
    ctx!.globalCompositeOperation = "lighter";
    const padGlow = ctx!.createRadialGradient(
      hx, fy + 3, 0,
      hx, fy + 3, scene!.soilR * 1.28,
    );
    padGlow.addColorStop(0, `rgba(150,242,120,${0.22 * arcRing})`);
    padGlow.addColorStop(0.55, `rgba(110,210,90,${0.1 * arcRing})`);
    padGlow.addColorStop(1, "rgba(110,210,90,0)");
    ctx!.fillStyle = padGlow;
    ctx!.beginPath();
    ctx!.ellipse(hx, fy + 3, scene!.soilR * 1.28, scene!.soilR * 0.36, 0, 0, TAU);
    ctx!.fill();
    ctx!.restore();

    // CO2 rig — glow scales with co2 level
    const tx = cap.x + cap.w * 0.085, ty = cap.y + cap.h * 0.135, tw = cap.w * 0.1, th = cap.h * 0.19;
    ctx!.fillStyle = "#13293a";
    ctx!.beginPath();
    ctx!.roundRect(tx, ty, tw, th, tw * 0.45);
    ctx!.fill();
    const co2glow = clamp((co2 - 400) / 1100, 0, 1);
    ctx!.strokeStyle = `rgba(127,212,240,${0.15 + co2glow * 0.4})`;
    ctx!.lineWidth = 1.5;
    ctx!.stroke();
    ctx!.fillStyle = "rgba(207,238,255,0.85)";
    ctx!.font = `700 ${Math.max(9, tw * 0.3)}px ui-monospace, Menlo, monospace`;
    ctx!.textAlign = "center";
    ctx!.fillText("CO₂", tx + tw / 2, ty + th * 0.56);

    // FAN — blade rotation speed driven by fan
    const fxc = cap.x + cap.w * 0.86, fyc = cap.y + cap.h * 0.18, fr = cap.w * 0.085;
    ctx!.fillStyle = "#0d2030";
    ctx!.beginPath();
    ctx!.arc(fxc, fyc, fr * 1.22, 0, TAU);
    ctx!.fill();
    ctx!.strokeStyle = fan > 78 ? "rgba(232,138,92,0.7)" : "rgba(127,212,240,0.3)";
    ctx!.lineWidth = 2;
    ctx!.beginPath();
    ctx!.arc(fxc, fyc, fr * 1.22, 0, TAU);
    ctx!.stroke();
    ctx!.fillStyle = "#091723";
    ctx!.beginPath();
    ctx!.arc(fxc, fyc, fr * 1.02, 0, TAU);
    ctx!.fill();
    const fanRot = (motionOK ? tt : 0) * (0.2 + (fan / 100) * 7);
    ctx!.save();
    ctx!.translate(fxc, fyc);
    ctx!.rotate(fanRot);
    ctx!.fillStyle = "#13293a";
    for (let b = 0; b < 5; b++) {
      ctx!.rotate(TAU / 5);
      ctx!.beginPath();
      ctx!.moveTo(0, 0);
      ctx!.bezierCurveTo(fr * 0.5, -fr * 0.18, fr * 0.95, -fr * 0.42, fr * 0.92, -fr * 0.05);
      ctx!.bezierCurveTo(fr * 0.85, fr * 0.3, fr * 0.3, fr * 0.18, 0, 0);
      ctx!.fill();
    }
    ctx!.restore();
    ctx!.fillStyle = "#16303f";
    ctx!.beginPath();
    ctx!.arc(fxc, fyc, fr * 0.22, 0, TAU);
    ctx!.fill();
    if (fan > 55 && motionOK) {
      ctx!.strokeStyle = `rgba(127,212,240,${(fan - 55) / 100})`;
      ctx!.lineWidth = 1;
      for (let s = 0; s < 3; s++) {
        const sy = fyc + (s - 1) * fr * 0.5;
        const off = (tt * 120 * (fan / 100)) % 60;
        ctx!.beginPath();
        ctx!.moveTo(fxc - fr * 1.4 - off, sy);
        ctx!.lineTo(fxc - fr * 1.4 - off + 18, sy);
        ctx!.stroke();
      }
    }
  }

  function drawPlant(tt: number) {
    const p = plant!;
    refreshLeafTone();
    // Recompute climate live so dragging FAN/temp affects sway + windburn now
    // (without rebuilding the plant geometry).
    const CL = climateModel(live.current.climate);
    const flag = dominantFlag(live.current.flags);
    const vis = CONDITION_VISUALS[flag.condition];
    const sev = SEVERITY_SCALE[flag.severity] ?? 0;
    const condClaw = vis.bodyAnim === "wilt-hard" ? 0.5 * sev : vis.bodyAnim === "droop" ? 0.3 * sev : 0;
    const wind = Math.sin(windPhase) * CL.windAmp;
    const claw = (CL.tooMuchFan ? 0.35 : 0) + condClaw;
    // Mobile-readability pass: a thicker, more organic-feeling stem — at real
    // phone size a thin line reads as a wire, not a plant stalk. Mockup pass
    // thickened it further (owner: "less spindly, sturdier plant").
    const sw0 = clamp(p.A * 0.0175 * (0.5 + p.stemH / p.A), 3.2, 11) * (CL.tooLowFan ? 0.8 : 1);
    // ── SEED ─────────────────────────────────────────────────────────────────
    // A dark brown bean sitting on the medium surface. Nothing green visible —
    // the seed is soaking up moisture and hasn't cracked yet.
    if (p.stage === "seed") {
      const cx = p.cx, by = p.baseY, soilR = scene!.soilR;
      const eb = earlyStageBoost(p.stage);
      const bW = soilR * 0.30 * eb, bH = soilR * 0.175 * eb;
      // Ground shadow — anchors the seed to the medium so it reads as a seed on
      // the surface, not a dot floating in the chamber.
      ctx!.fillStyle = "rgba(0,0,0,0.22)";
      ctx!.beginPath();
      ctx!.ellipse(cx, by + bH * 0.45, bW * 1.05, bH * 0.5, 0, 0, TAU);
      ctx!.fill();
      // Moisture halo — dark damp ring around the base of the seed.
      const mhalo = ctx!.createRadialGradient(cx, by - bH * 0.1, 0, cx, by, soilR * 0.54);
      mhalo.addColorStop(0, "rgba(55,88,78,0.24)");
      mhalo.addColorStop(1, "rgba(55,88,78,0)");
      ctx!.fillStyle = mhalo;
      ctx!.beginPath();
      ctx!.ellipse(cx, by, soilR * 0.54, soilR * 0.16, 0, 0, TAU);
      ctx!.fill();
      // Bean body — radial gradient gives depth (lighter face, dark edge).
      ctx!.save();
      ctx!.translate(cx, by - bH * 0.62);
      ctx!.rotate(-0.18);
      const sg = ctx!.createRadialGradient(-bW * 0.18, -bH * 0.22, bW * 0.04, 0, 0, bW);
      sg.addColorStop(0,    "hsl(28, 38%, 28%)");
      sg.addColorStop(0.45, "hsl(22, 42%, 20%)");
      sg.addColorStop(1,    "hsl(18, 46%, 13%)");
      ctx!.fillStyle = sg;
      ctx!.beginPath();
      ctx!.ellipse(0, 0, bW, bH, 0, 0, TAU);
      ctx!.fill();
      // Centre ridge — the longitudinal seam of a cannabis seed.
      ctx!.strokeStyle = "rgba(0,0,0,0.30)";
      ctx!.lineWidth = bH * 0.13;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(-bW * 0.68, 0);
      ctx!.bezierCurveTo(-bW * 0.2, -bH * 0.40, bW * 0.2, -bH * 0.40, bW * 0.68, 0);
      ctx!.stroke();
      // Faint highlight along the top shoulder.
      ctx!.strokeStyle = "rgba(120,90,60,0.22)";
      ctx!.lineWidth = bH * 0.18;
      ctx!.beginPath();
      ctx!.moveTo(-bW * 0.48, -bH * 0.18);
      ctx!.bezierCurveTo(-bW * 0.14, -bH * 0.64, bW * 0.14, -bH * 0.64, bW * 0.48, -bH * 0.18);
      ctx!.stroke();
      ctx!.restore();
      return;
    }

    // ── GERMINATION ──────────────────────────────────────────────────────────
    // The seed has cracked; a white taproot curls into the medium while the
    // pale green hypocotyl arch (the "hook") pushes up through the surface,
    // cotyledons still folded shut at its tip.
    if (p.stage === "germination") {
      const cx = p.cx, by = p.baseY, soilR = scene!.soilR;
      const eb = earlyStageBoost(p.stage);
      const hookH = p.A * 0.17 * eb;
      // Taproot hint — barely visible below the medium surface.
      ctx!.save();
      ctx!.globalAlpha = 0.42;
      ctx!.strokeStyle = "rgb(236,228,210)";
      ctx!.lineWidth = 2.2;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(cx, by);
      ctx!.bezierCurveTo(
        cx + soilR * 0.22, by + soilR * 0.18,
        cx + soilR * 0.14, by + soilR * 0.44,
        cx - soilR * 0.06, by + soilR * 0.55,
      );
      ctx!.stroke();
      ctx!.globalAlpha = 1;
      ctx!.restore();
      // Two cracked seed-shell halves resting at the medium surface.
      const bW = soilR * 0.23 * eb, bH = soilR * 0.13 * eb;
      ctx!.fillStyle = "hsl(22, 40%, 18%)";
      for (const s of [-1, 1]) {
        ctx!.save();
        ctx!.translate(cx + s * bW * 0.30, by - bH * 0.28);
        ctx!.rotate(s * 0.44);
        ctx!.beginPath();
        ctx!.ellipse(0, 0, bW * 0.56, bH, 0, 0, Math.PI);
        ctx!.fill();
        ctx!.restore();
      }
      // Hypocotyl arch — pale green hook curving up from the soil and over.
      const archHue = S.hue + 8;
      const archSat = Math.round(S.sat * 0.72);
      const archLit = Math.round(S.lit + 20);
      ctx!.strokeStyle = `hsl(${archHue}, ${archSat}%, ${archLit}%)`;
      ctx!.lineWidth = 3.8;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(cx, by);
      ctx!.bezierCurveTo(
        cx + soilR * 0.50, by - hookH * 0.16,
        cx + soilR * 0.46, by - hookH * 0.84,
        cx, by - hookH,
      );
      ctx!.stroke();
      // Cotyledon nub — two tiny folded teardrops at the arch tip, still closed.
      const nubR = soilR * 0.115 * eb;
      ctx!.fillStyle = `hsl(${archHue}, ${archSat}%, ${archLit - 4}%)`;
      for (const s of [-1, 1]) {
        ctx!.save();
        ctx!.translate(cx + s * nubR * 0.92, by - hookH - nubR * 0.18);
        ctx!.rotate(s * 0.58);
        ctx!.beginPath();
        ctx!.ellipse(0, 0, nubR * 0.42, nubR * 0.78, 0, 0, TAU);
        ctx!.fill();
        ctx!.restore();
      }
      return;
    }

    // ── STEM (seedling → vegetative → flowering → harvest) ───────────────────
    // Round 2 (owner mockup): a mature plant's lower trunk is woody BROWN, not
    // green — blend from bark brown at the base to the green stem hue by the
    // mid-plant. Maturity-gated (grows in with bud development) so seedlings
    // and young veg keep their tender green stems.
    const woody = clamp(live.current.dev.budDev * 0.85 + (day > 30 ? 0.25 : 0), 0, 1);
    for (let i = 0; i < p.spine.length - 1; i++) {
      const a = p.spine[i], b = p.spine[i + 1];
      if (b.y < p.baseY - p.stemH) break;
      const bark = woody * clamp(1 - a.t / 0.55, 0, 1); // base → mid fade
      const hueS = lerp(S.hue - 12, 30, bark);
      const satS = lerp(34, 32, bark);
      const litS = 26 + a.t * 8 - bark * 4;
      ctx!.strokeStyle = `hsl(${hueS}, ${satS}%, ${litS}%)`;
      // Plant rework pass 3 (owner blueprint: "build a STRONGER central stem with
      // CLEAR taper"). Thicker base (×1.4) with a sharper power-curve taper so the
      // spine reads as a strong tapering trunk that visibly supports the colas,
      // not a thin wire. Branch widths are unchanged (they key off sw0 directly).
      ctx!.lineWidth = taperWidth(a.t, sw0 * 1.4, sw0 * 0.3, 0.8);
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(a.x, a.y);
      ctx!.lineTo(b.x, b.y);
      ctx!.stroke();
      // A soft light edge up the front of the lower trunk (below mid) — a rim
      // that sculpts the stem into a rounded stalk instead of a flat ribbon
      // (blueprint: "increase material definition", "lighting sculpts the plant").
      if (a.t < 0.5) {
        ctx!.strokeStyle = `hsla(${hueS + 4}, ${satS + 6}%, ${litS + 16}%, ${0.5 * (1 - a.t * 2)})`;
        ctx!.lineWidth = taperWidth(a.t, sw0 * 0.5, sw0 * 0.16, 0.8);
        ctx!.beginPath();
        ctx!.moveTo(a.x - lerp(sw0 * 0.42, 0, a.t * 2), a.y);
        ctx!.lineTo(b.x - lerp(sw0 * 0.42, 0, b.t * 2), b.y);
        ctx!.stroke();
      }
    }

    // ── SEEDLING ──────────────────────────────────────────────────────────────
    // The stem is visible; two round oval cotyledons spread open at the apex,
    // and a single tiny true-leaf blade just emerges from between them.
    if (p.stage === "seedling") {
      const top = p.spine[24]; // apex of the stem
      const soilR = scene!.soilR;
      const eb = earlyStageBoost(p.stage);
      const cotyL = soilR * 0.50 * eb, cotyW = soilR * 0.30 * eb;
      const cotyHue = S.hue + 6;
      const cotySat = Math.round(S.sat * 0.82);
      const cotyLit = Math.round(S.lit + 17);
      // Round-oval cotyledons splayed open — lighter and rounder than true leaves.
      for (const s of [-1, 1]) {
        ctx!.save();
        ctx!.translate(top.x + s * cotyL * 0.53, top.y + cotyL * 0.14);
        ctx!.rotate(s * 0.52);
        ctx!.fillStyle = `hsl(${cotyHue}, ${cotySat}%, ${cotyLit}%)`;
        ctx!.beginPath();
        ctx!.ellipse(0, 0, cotyW * 0.55, cotyL * 0.50, 0, 0, TAU);
        ctx!.fill();
        // Midrib vein.
        ctx!.strokeStyle = `hsl(${cotyHue}, ${Math.round(cotySat * 0.78)}%, ${cotyLit - 8}%)`;
        ctx!.lineWidth = 0.8;
        ctx!.lineCap = "round";
        ctx!.beginPath();
        ctx!.moveTo(0,  cotyL * 0.43);
        ctx!.lineTo(0, -cotyL * 0.43);
        ctx!.stroke();
        ctx!.restore();
      }
      // First true leaf — one narrow serrated blade growing up from the apex.
      const tlSz = soilR * 0.30 * eb;
      ctx!.save();
      ctx!.translate(top.x, top.y - tlSz * 0.06);
      ctx!.fillStyle = `hsl(${S.hue + 2}, ${S.sat}%, ${S.lit + 12}%)`;
      ctx!.strokeStyle = `hsl(${S.hue}, ${Math.round(S.sat * 0.70)}%, ${Math.round(S.lit * 0.82)}%)`;
      ctx!.lineWidth = 0.6;
      leafletPath(tlSz, tlSz * 0.30);
      ctx!.fill();
      ctx!.stroke();
      ctx!.restore();
      return;
    }
    // Round 5 (specialist code review, 2026-07-03): soft canopy "under-mass" —
    // a dark, cone-tapered silhouette painted BEHIND the branch/bud draw loop
    // below, so any residual gap between branches reads as shaded interior
    // foliage instead of black chamber background (depth-aware occlusion, done
    // once instead of per-branch). Tapers wide-base -> narrow-apex in lock-step
    // with the node spread math (SK.lowerSpread), so it reinforces the single-
    // leader cone silhouette rather than fighting it.
    if (p.nodes.length >= 4) {
      const baseHalf = p.A * 0.3 * SK.lowerSpread;
      const apexHalf = p.A * 0.055;
      const leftPts: Array<[number, number]> = [];
      const rightPts: Array<[number, number]> = [];
      for (const sp of p.spine) {
        if (sp.y < p.baseY - p.stemH * 1.02) break; // never runs past the apex
        const hw = lerp(apexHalf, baseHalf, Math.pow(1 - clamp(sp.t, 0, 1), 0.85));
        leftPts.push([sp.x - hw, sp.y]);
        rightPts.push([sp.x + hw, sp.y]);
      }
      if (leftPts.length > 2) {
        ctx!.save();
        ctx!.beginPath();
        ctx!.moveTo(rightPts[0][0], rightPts[0][1]);
        for (let i = 1; i < rightPts.length; i++) ctx!.lineTo(rightPts[i][0], rightPts[i][1]);
        for (let i = leftPts.length - 1; i >= 0; i--) ctx!.lineTo(leftPts[i][0], leftPts[i][1]);
        ctx!.closePath();
        const ug = ctx!.createLinearGradient(p.cx, p.baseY, p.cx, p.baseY - p.stemH);
        ug.addColorStop(0, `hsla(${S.hue - 8}, 30%, 9%, 0.6)`);
        ug.addColorStop(0.6, `hsla(${S.hue - 4}, 34%, 12%, 0.52)`);
        ug.addColorStop(1, `hsla(${S.hue}, 30%, 14%, 0.38)`);
        ctx!.fillStyle = ug;
        ctx!.fill();
        ctx!.restore();
      }
    }
    const bd = clamp(live.current.dev.budDev, 0, 1);
    const flex = branchFlexFor(S.branchMul);
    // Flowering weight ladder (seed/veg 0 → harvest 1): scales all bud-load droop.
    const stageMul = flowerStageMultiplier(p.stage as GrowthStage, bd);
    // Engine 3 — paint back→front (by azimuth depth) so the spiral reads as a 3-D
    // canopy: branches winding toward the camera overlap the ones behind the stem.
    const order = p.nodes.map((_, i) => i).sort((a, b) => p.nodes[a].depth - p.nodes[b].depth);
    for (const i of order) {
      const nd = p.nodes[i];
      // Bud-weight physics: heavier branches droop more (rotated, not just a tip
      // sag, so the whole branch bows) and move with more inertia in the airflow.
      const droopRot = branchDroop(nd.weight, flex, stageMul, SK.budWeightMul, SK.branchStrength);
      const af = airflowWeighting(nd.weight, stageMul);
      // Airflow WAVE (not random wiggle): the top leads and lower nodes lag, with
      // bigger amplitude up top. Heavy buds damp the swing, lag further, slow down.
      const amp = CL.windAmp * (0.8 + nd.f * 1.2) * flex * af.ampMul;
      const sway = motionOK ? Math.sin(tt * 1.6 * af.freqMul - (1 - nd.f) * 1.3 * af.lagMul) * amp + wind * (0.4 + nd.f * 0.6) : 0;
      const spring = phys.nodes[i] ? phys.nodes[i].ao : 0;
      const jig = Math.min(3, Math.abs(phys.nodes[i] ? phys.nodes[i].av : 0) * 7);
      // Residual tip bow on top of the branch rotation, for a compound sag curve.
      const sag = Math.sin(droopRot) * nd.len * 0.35;
      const endX = nd.tipX, endY = nd.tipY + sag;
      ctx!.save();
      ctx!.translate(nd.x, nd.y);
      // The whole branch rotates downward under load (nd.side keeps the sign so
      // both sides droop toward the floor), then sways/springs around that.
      ctx!.rotate(sway + spring + nd.side * droopRot + nd.side * condClaw * 0.4);
      // Round 9 pass 2 (owner: "branches render as flat, uniform-width
      // ribbons... no front/mid/rear depth"). Rear branches (depth<0, winding
      // away from the camera) lose a little saturation on top of the existing
      // litAdj darkening — a cheap, standard aerial-perspective cue that makes
      // the depth-sorted paint order (`order`, above) actually READ as depth
      // instead of every tier looking like the same flat green at every layer.
      // Blob-complaint fix (pass 7): branches previously shared close to the
      // same hue/saturation neighbourhood as the leaf fans, so branches and
      // foliage optically fused into one green mass. Pushing the hue further
      // from S.hue and capping saturation lower (32 → 24) desaturates branches
      // relative to leaves without touching `leafTone`'s own saturation.
      const depthSat = clamp(32 - Math.max(0, -nd.depth) * 9, 20, 24);
      ctx!.strokeStyle = `hsl(${S.hue - 22}, ${depthSat}%, ${clamp(30 + nd.litAdj, 18, 46)}%)`;
      // Bolder branches, less thinning toward the apex — the upper branches carry
      // the flower sites, so a "wire" up there is the worst place for it.
      const branchW = clamp(sw0 * 0.7 * (1 - nd.f * 0.26), 2.1, 6);
      ctx!.lineCap = "round";
      // Curved branch: arcs upward (nd.curve) then sags at the tip under weight.
      // Tapered thick→thin (trunk-facing root → bud-facing tip, see
      // strokeTaperedBezier above) instead of one constant lineWidth — the
      // single highest-leverage fix for the "flat ribbon, no woody taper" read.
      const bc1x = nd.tipX * 0.35, bc1y = nd.tipY * 0.4 - nd.len * nd.curve;
      const bc2x = nd.tipX * 0.72, bc2y = nd.tipY * 0.7 - nd.len * nd.curve * 0.4 + sag * 0.5;
      const branchPts = sampleBezier(0, 0, bc1x, bc1y, bc2x, bc2y, endX, endY);
      strokeTaperedPoints(branchPts, branchW * 1.35, branchW * 0.32);
      // Plant rework pass 5 (owner blueprint: "increase material definition";
      // "branches visibly support each bud"). A thin lighter rim along the top of
      // each branch so it reads as a rounded, lit supporting branch instead of a
      // flat line — the visible support structure the blueprint repeatedly asks
      // for. Same bezier, offset up by the rim width. Additive, draw-path only.
      // Tapered in lock-step with the branch body above.
      {
        const rw = clamp(sw0 * 0.28 * (1 - nd.f * 0.26), 0.9, 2.4);
        const ro = rw * 0.5 + 0.6;
        ctx!.strokeStyle = `hsl(${S.hue - 18}, ${depthSat + 10}%, ${clamp(48 + nd.litAdj, 30, 64)}%)`;
        // Reuses branchPts (offset by -ro in y) instead of re-sampling the
        // bezier — valid because a cubic bezier is an affine combination of
        // its control points, so shifting every control point by (0,-ro)
        // shifts every sampled point on the curve by that same constant.
        const rimPts: Array<[number, number]> = branchPts.map(([x, y]) => [x, y - ro]);
        strokeTaperedPoints(rimPts, rw * 1.3, rw * 0.3);
      }
      ctx!.save();
      ctx!.translate(endX, endY);
      // Engine 4: roll the fan a touch per node and yaw it by the branch azimuth
      // so the tip leaves aren't all flat to the camera.
      ctx!.rotate(nd.side * (0.5 + nd.tilt * 0.18) + nd.leafRoll);
      drawFan(nd.leafSize, nd.leaflets, nd.f, claw, nd.litAdj, nd.leafYaw, nd.phase);
      ctx!.restore();
      // Round 2 (owner mockup): a mid-branch fan on longer branches — the bare
      // arc between the node and the tip was the last "diagram" tell; the mockup
      // plant carries foliage along the whole branch, not just at its ends.
      if (nd.len > p.A * 0.06) {
        const mt = 0.55;
        ctx!.save();
        ctx!.translate(endX * mt, endY * mt - nd.len * nd.curve * Math.sin(Math.PI * mt) * 0.6);
        ctx!.rotate(nd.side * 0.32 + nd.leafRoll * 0.7);
        drawFan(nd.leafSize * 0.6, Math.max(3, nd.leaflets - 2), nd.f * 0.5, claw, nd.litAdj - 3, lerp(nd.leafYaw, 1, 0.5), nd.phase + 1.7);
        ctx!.restore();
        // Round 3 (owner mockup): an INNER fan near the branch base, angled up
        // toward the stem — the wedge of dark space between the trunk and each
        // branch arc was the biggest interior hole left after round 2.
        // Round 5 (specialist code review, 2026-07-03): enlarged 0.5x → 0.72x —
        // phyllotaxis leaves the opposite ~137° wedge empty each tier, and this
        // fan was the existing corrective for it but was too small to close the
        // gap on the longest (lowest-tier) branches, which need it most.
        const it = 0.26;
        ctx!.save();
        ctx!.translate(endX * it, endY * it - nd.len * nd.curve * Math.sin(Math.PI * it) * 0.6);
        ctx!.rotate(-nd.side * 0.4 + nd.leafRoll * 0.5);
        drawFan(nd.leafSize * 0.72, Math.max(3, nd.leaflets - 2), nd.f * 0.4, claw, nd.litAdj - 5, lerp(nd.leafYaw, 1, 0.6), nd.phase + 3.1);
        ctx!.restore();
        // Round 5 (specialist code review, 2026-07-03): a SECOND inner fan even
        // closer to the branch base (t≈0.12), angled further back toward the
        // trunk than the t≈0.26 fan above — targets the specific lowest-tier
        // trunk-to-branch wedge the specialist called out (longest branches =
        // biggest gap, least correction from the existing single inner fan).
        const it2 = 0.12;
        ctx!.save();
        ctx!.translate(endX * it2, endY * it2 - nd.len * nd.curve * Math.sin(Math.PI * it2) * 0.6);
        ctx!.rotate(-nd.side * 0.62 + nd.leafRoll * 0.4);
        drawFan(nd.leafSize * 0.6, Math.max(3, nd.leaflets - 2), nd.f * 0.35, claw, nd.litAdj - 6, lerp(nd.leafYaw, 1, 0.65), nd.phase + 4.6);
        ctx!.restore();
      }
      // Leaf cluster hugging the stem at the node — every node carries foliage,
      // not just the branch tip, so internodes don't read as bare gaps.
      const nodeFans: Array<readonly [number, number]> = [
        [-nd.side * 0.32, 0.55], [-nd.side * 0.74, 0.36], [nd.side * 0.22, 0.3],
      ];
      // Mockup pass: one extra fan on the mid-canopy band (all strains) so the
      // middle of the plant reads leafy and full rather than bare stem + buds.
      if (nd.f > 0.25 && nd.f < 0.8) nodeFans.push([nd.side * 0.5, 0.44]);
      // Round 3 (owner mockup): a cross-stem fan reaching over to the branch-
      // less side of this tier — alternating phyllotaxy leaves a dark wedge
      // opposite every branch, and the mockup's interior has no such holes.
      if (nd.f > 0.2 && nd.f < 0.9) nodeFans.push([-nd.side * 1.18, 0.5]);
      // Full lower skirt (owner harvest reference): broad-leaf strains add two
      // more big fans on the low/mid nodes so the bottom canopy reads as a
      // dense layered skirt, not a bare diagram. Skirt fans sit in shade.
      // Round 3 (owner mockup): skirt fans a notch bigger (0.52/0.46 →
      // 0.6/0.54) — the lower interior still showed dark wedges between the
      // stem and the low colas; the mockup's lower third is packed foliage.
      if (nd.skirt > 0.2) nodeFans.push([nd.side * 0.62, 0.6], [-nd.side * 1.08, 0.54]);
      for (let fi = 0; fi < nodeFans.length; fi++) {
        const [ang, scl] = nodeFans[fi];
        ctx!.save();
        ctx!.rotate(ang);
        // Plant rework pass 6 (owner blueprint: "keep leaf fans SECONDARY so buds
        // stay readable"). Node/skirt fans recede a few % darker (−8 vs −5 on the
        // skirt) so the bright colas dominate the read — leaves support the buds,
        // they don't compete. Density is unchanged (no bareness).
        drawFan(nd.nodeLeafSize * scl, Math.max(3, nd.leaflets - 2), 0, claw, nd.litAdj - 3 - nd.skirt * 8, lerp(nd.leafYaw, 1, 0.4), nd.phase + 6 + fi * 1.9);
        ctx!.restore();
      }
      // Secondary branchlets — forks part-way along the branch (sharing the
      // branch's sway/droop), each with its own foliage and small tip bud.
      for (const bl of nd.branchlets) {
        const t = bl.along;
        // point on the branch's bezier at t≈along (linear path + its upward arc)
        const bx = endX * t;
        const by = endY * t - nd.len * nd.curve * Math.sin(Math.PI * t);
        const bex = Math.sin(bl.tilt) * nd.side * bl.len;
        const bey = -Math.cos(bl.tilt) * bl.len * 0.5 + sag * 0.25;
        ctx!.save();
        ctx!.translate(bx, by);
        // Shares the parent branch's depthSat (code-review fix, 2026-07-04):
        // was hardcoded 30% regardless of depth, so a branchlet forking off a
        // rear-facing (desaturated) branch stayed brighter than the branch it
        // grows from — a visible mismatch right at the fork.
        ctx!.strokeStyle = `hsl(${S.hue - 20}, ${depthSat}%, 32%)`;
        const blW = clamp(sw0 * 0.48 * (1 - nd.f * 0.3), 1.4, 3.6);
        ctx!.lineCap = "round";
        // Tapered to match the parent branch (round 9 pass 2) — quadratic
        // control point converted to its equivalent cubic pair so it can share
        // strokeTaperedBezier's segmented-width trick.
        {
          const qx = bex * 0.5, qy = bey * 0.5 - bl.len * bl.curve;
          const c1x = qx * (2 / 3), c1y = qy * (2 / 3);
          const c2x = bex + (qx - bex) * (2 / 3), c2y = bey + (qy - bey) * (2 / 3);
          strokeTaperedBezier(0, 0, c1x, c1y, c2x, c2y, bex, bey, blW * 1.25, blW * 0.35);
        }
        ctx!.save();
        ctx!.translate(bex, bey);
        ctx!.rotate(bl.side * (0.4 + bl.tilt * 0.2) + nd.leafRoll * 0.6);
        drawFan(bl.leafSize, bl.leaflets, nd.f, claw, nd.litAdj, lerp(nd.leafYaw, 1, 0.5), bl.phase);
        ctx!.restore();
        if (bl.site) {
          ctx!.save();
          ctx!.translate(bex, bey);
          // Small extra nod: the bud hangs a touch beyond the (already drooped) branch.
          ctx!.rotate(nd.side * 0.12 + nd.side * droopRot * 0.15);
          // branchlet buds sit lower/outer — thinner frost than their parent node
          drawBudCollar(bl.site, nd.litAdj - 3);
          drawFlowerSite(bl.site, p.P, jig, tt, budSiteDensity(nd.f) * 0.7);
          ctx!.restore();
        }
        ctx!.restore();
      }
      // Bud forming at the node intersection itself (upper/mid nodes).
      if (nd.nodeBud) {
        ctx!.save();
        ctx!.translate(0, -2);
        ctx!.rotate(-nd.side * 0.12);
        drawBudCollar(nd.nodeBud, nd.litAdj);
        drawFlowerSite(nd.nodeBud, p.P, jig, tt, budSiteDensity(nd.f) * 0.9);
        ctx!.restore();
      }
      // Bud at the branch tip.
      if (nd.site) {
        ctx!.save();
        ctx!.translate(endX * 0.85, endY * 0.85);
        ctx!.rotate(nd.budRot + nd.side * droopRot * 0.2); // bud nods a touch past the drooped branch
        drawBudCollar(nd.site, nd.litAdj);
        drawFlowerSite(nd.site, p.P, jig, tt, budSiteDensity(nd.f));
        ctx!.restore();
        // Plant rework pass 2 (owner blueprint: "add visible branch segments in
        // FRONT of some buds, not only behind them" → front/mid/rear depth).
        // Front-facing nodes (high azimuth depth, painted last) get a short lit
        // support branch arcing across the cola's lower third with a small leaf
        // tip — a foreground overlap so the bud reads as layered, not flat. Only
        // the front nodes get it, so it's depth, not clutter (blueprint: "keep
        // leaf fans secondary so buds stay readable"). Draw-path only.
        if (nd.depth > 0.6) {
          const cw = nd.site.baseW;
          ctx!.save();
          ctx!.translate(endX * 0.85, endY * 0.85);
          ctx!.rotate(nd.budRot + nd.side * droopRot * 0.2);
          ctx!.strokeStyle = `hsl(${S.hue - 8}, 40%, ${clamp(40 + nd.litAdj, 26, 54)}%)`;
          ctx!.lineWidth = clamp(sw0 * 0.5, 1.6, 4);
          ctx!.lineCap = "round";
          ctx!.beginPath();
          ctx!.moveTo(-cw * 1.15, cw * 0.25);
          ctx!.quadraticCurveTo(-cw * 0.1, -nd.site.axisLen * 0.14, cw * 0.95, -nd.site.axisLen * 0.26);
          ctx!.stroke();
          ctx!.translate(cw * 0.95, -nd.site.axisLen * 0.26);
          ctx!.rotate(nd.side * 0.45 + nd.leafRoll);
          drawFan(nd.leafSize * 0.52, 3, 0, claw, nd.litAdj + 6, nd.leafYaw, nd.phase + 8.2);
          ctx!.restore();
        }
      }
      ctx!.restore();
    }
    const top = p.spine[24];
    const swayT = motionOK ? Math.sin(tt * 1.5) * CL.windAmp * 2.2 + wind : 0;
    if (p.cola) {
      const cjig = Math.min(3, Math.abs(phys.cola.av) * 7);
      // Heavy top cola: leans 1–5° toward its offset side and nods slowly with
      // inertia (the airflow weighting slows + damps its sway as it gains mass).
      const leanDir = Math.sign(top.x - p.cx) || 1;
      const colaDroop = colaLean(stageMul, SK.budWeightMul) * leanDir;
      const caf = airflowWeighting(SK.colaScale * SK.budWeightMul, stageMul);
      const colaSway = motionOK ? Math.sin(tt * 1.5 * caf.freqMul) * CL.windAmp * 2.2 * caf.ampMul + wind : 0;
      ctx!.save();
      ctx!.translate(p.cola.x, p.cola.y);
      ctx!.rotate(phys.cola.ao + colaSway + colaDroop);
      ctx!.save();
      ctx!.translate(0, -p.cola.site.axisLen * 0.04);
      drawFan(p.A * 0.08 * (1 - 0.35 * p.P.budDev), Math.min(S.leafletMax, 5 + Math.floor(day / 18)), 1, claw, 0, 1, seed + day * 0.3);
      ctx!.restore();
      drawBudCollar(p.cola.site, 2); // the top cola gets the strongest node collar
      // Plant rework pass 7 (owner blueprint: "clear MAIN cola", "1 top cola —
      // the HERO", "silhouette lacks hierarchy"). A warm apical hero-bloom behind
      // the crown so the top cola reads as the clear dominant apex, not just the
      // tallest of a row. Additive light ("lighter"), gated on flower dev so it
      // only blooms as the crown matures. Draw-path only.
      {
        const hb = clamp(live.current.dev.budDev, 0, 1);
        if (hb > 0.05) {
          const r = p.cola.site.baseW * 3.2;
          const cy = -p.cola.site.axisLen * 0.5;
          const bloom = ctx!.createRadialGradient(0, cy, 0, 0, cy, r);
          bloom.addColorStop(0, `hsla(${S.hue + 14}, 62%, 66%, ${0.16 * hb})`);
          bloom.addColorStop(0.6, `hsla(${S.hue + 6}, 56%, 56%, ${0.08 * hb})`);
          bloom.addColorStop(1, "hsla(0,0%,100%,0)");
          ctx!.save();
          ctx!.globalCompositeOperation = "lighter";
          ctx!.fillStyle = bloom;
          ctx!.beginPath();
          ctx!.ellipse(0, cy, r * 0.8, r, 0, 0, TAU);
          ctx!.fill();
          ctx!.restore();
        }
      }
      drawFlowerSite(p.cola.site, p.P, cjig, tt, 1.05); // top cola — full frost + hero
      ctx!.restore();
    } else {
      ctx!.save();
      ctx!.translate(top.x, top.y);
      ctx!.rotate(swayT);
      drawFan(p.A * 0.08, Math.min(S.leafletMax, 5 + Math.floor(day / 18)), 1, claw, 0, 1, seed + day * 0.3);
      ctx!.restore();
    }
    drawConditionOverlay(p);
  }

  // Condition flags -> canvas overlays, reusing conditionVisuals semantics.
  function drawConditionOverlay(p: Plant) {
    const flag = dominantFlag(live.current.flags);
    const vis = CONDITION_VISUALS[flag.condition];
    const sev = SEVERITY_SCALE[flag.severity] ?? 0;
    if (vis.overlay === "none" || sev <= 0) return;
    const cx = p.cx, midY = p.baseY - p.stemH * 0.5;
    const rnd = mulberry32(seed + 99);
    if (vis.overlay === "bugs") {
      ctx!.fillStyle = "#1a1a1a";
      for (let i = 0; i < Math.round(12 * sev); i++) {
        const x = cx + (rnd() - 0.5) * p.stemH * 0.7;
        const y = midY + (rnd() - 0.5) * p.stemH * 0.8;
        ctx!.beginPath();
        ctx!.arc(x, y, 1.6, 0, TAU);
        ctx!.fill();
      }
    } else if (vis.overlay === "mildew") {
      ctx!.fillStyle = `rgba(232,237,242,${0.5 * sev})`;
      for (let i = 0; i < Math.round(14 * sev); i++) {
        const x = cx + (rnd() - 0.5) * p.stemH * 0.7;
        const y = midY + (rnd() - 0.5) * p.stemH * 0.8;
        ctx!.beginPath();
        ctx!.arc(x, y, 3 + rnd() * 3, 0, TAU);
        ctx!.fill();
      }
    } else if (vis.overlay === "rot") {
      ctx!.fillStyle = `rgba(59,47,35,${0.8 * sev})`;
      ctx!.beginPath();
      ctx!.ellipse(cx, p.baseY, p.stemH * 0.18, 6, 0, 0, TAU);
      ctx!.fill();
    } else if (vis.overlay === "water-sheen") {
      ctx!.fillStyle = `rgba(140,200,235,${0.18 * sev})`;
      ctx!.beginPath();
      ctx!.ellipse(cx, p.baseY + 2, p.stemH * 0.25, 8, 0, 0, TAU);
      ctx!.fill();
    }
  }

  function drawMacro(tt: number) {
    // ---- grow-tent depth-of-field backdrop ----
    let g = ctx!.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b1a12");
    g.addColorStop(0.5, "#0a1410");
    g.addColorStop(1, "#070d0a");
    ctx!.fillStyle = g;
    ctx!.fillRect(0, 0, W, H);
    // Soft out-of-focus bokeh — blurred grow-light glints behind the subject
    // (precomputed once in buildMacro; gradients reused frame to frame).
    for (const b of macroBokeh) {
      ctx!.fillStyle = b.grad;
      ctx!.beginPath();
      ctx!.arc(b.x, b.y, b.r, 0, TAU);
      ctx!.fill();
    }
    // Top light cone from the grow lamp.
    g = ctx!.createLinearGradient(0, 0, 0, H * 0.9);
    g.addColorStop(0, "rgba(196,242,222,0.10)");
    g.addColorStop(1, "rgba(196,242,222,0)");
    ctx!.fillStyle = g;
    ctx!.beginPath();
    ctx!.moveTo(W * 0.34, 0);
    ctx!.lineTo(W * 0.66, 0);
    ctx!.lineTo(W * 0.86, H * 0.9);
    ctx!.lineTo(W * 0.14, H * 0.9);
    ctx!.closePath();
    ctx!.fill();

    const P = live.current.dev;
    const bc = live.current.budColor;
    const bud = macroBud!;
    const baseX = bud.centerX, baseY = bud.baseY;
    const budH = bud.budH, budW = bud.budW;

    ctx!.save();
    ctx!.translate(baseX, baseY);
    ctx!.rotate(phys.bud.ao + (motionOK ? Math.sin(tt * 0.8) * 0.008 : 0));
    // Everything below is drawn relative to the bud base (0,0).

    // ---- framing fan leaves behind the cola (precomputed; kept green).
    ctx!.save();
    ctx!.globalAlpha = 0.92;
    for (const lf of macroLeaves) {
      ctx!.save();
      ctx!.translate(lf.lx, lf.ly);
      ctx!.rotate(lf.rot);
      drawFan(lf.lsz, Math.min(S.leafletMax, 7), 0.2, 0, 0, 1, lf.rot * 41.3);
      ctx!.restore();
    }
    ctx!.restore();

    // ---- stalk below the cola ----
    ctx!.strokeStyle = `hsl(${S.hue - 12}, 34%, 26%)`;
    ctx!.lineWidth = Math.max(4, budW * 0.12);
    ctx!.lineCap = "round";
    ctx!.beginPath();
    ctx!.moveTo(0, H * 0.06);
    ctx!.lineTo(0, -budH * 0.04);
    ctx!.stroke();

    // ---- dark cola core (palette-derived so it tracks env purple shift) ----
    ctx!.fillStyle = `hsl(${bud.coreHue}, ${bud.coreSat}%, 16%)`;
    ctx!.beginPath();
    ctx!.ellipse(0, -budH * 0.5, budW * 0.46, budH * 0.5, 0, 0, TAU);
    ctx!.fill();

    // ---- calyxes: pointed, ribbed, fuzzy teardrops, layered; sugar leaves
    // woven between back and front to break up the silhouette ----
    const grow = clamp(P.budDev, 0, 1);
    const hb = live.current.budDna.highlightBoost ?? 0;
    const drawCalyx = (c: MacroCalyx) => {
      if (grow < 0.04 + c.depth * 0.35) return; // fill in as the bud develops
      const lit = clamp(c.lit + (c.depth - 0.6) * 18 + P.ripe * 2, 10, 82);
      const sc = 0.6 + 0.4 * grow;
      const w = c.w * sc, h = c.h * sc;
      const detail = w > 2.8 && c.depth > 0.45; // ribs/seams break up the blob — render them sooner
      ctx!.save();
      ctx!.globalAlpha = lerp(0.78, 1, c.depth);
      ctx!.translate(c.x - baseX, c.y - baseY);
      ctx!.rotate(c.rot);
      // body
      ctx!.fillStyle = `hsl(${c.hue}, ${c.sat}%, ${lit}%)`;
      calyxPath(c.shape, w, h);
      ctx!.fill();
      // outer-rim edge shadow → reads as overlap / ambient occlusion
      ctx!.strokeStyle = `hsla(${c.hue}, ${c.sat}%, ${Math.max(6, lit - 24)}%, 0.5)`;
      ctx!.lineWidth = Math.max(0.5, w * 0.05);
      ctx!.stroke();
      if (detail) {
        ctx!.lineCap = "round";
        // center seam/vein up to the tip
        ctx!.strokeStyle = `hsla(${c.hue}, ${c.sat}%, ${Math.max(8, lit - 14)}%, 0.5)`;
        ctx!.lineWidth = Math.max(0.4, w * 0.035);
        ctx!.beginPath();
        ctx!.moveTo(0, h * 0.42);
        ctx!.lineTo(0, -h * 0.46);
        ctx!.stroke();
        // side ridges (vertebrae), mirrored
        ctx!.lineWidth = Math.max(0.35, w * 0.025);
        for (const s of [-1, 1]) {
          for (let r = 1; r <= 2; r++) {
            const sx = s * (r / 3) * w * 0.42;
            ctx!.beginPath();
            ctx!.moveTo(0, h * 0.34);
            ctx!.quadraticCurveTo(sx, -h * 0.02, sx * 0.45, -h * 0.42);
            ctx!.stroke();
          }
        }
        // surface speckles (deterministic from the calyx's own phase)
        ctx!.fillStyle = `hsla(${c.hue}, ${c.sat}%, ${Math.max(8, lit - 18)}%, 0.4)`;
        for (let s = 0; s < 4; s++) {
          const px = (((c.phase * 9.7 + s * 2.3) % 1) - 0.5) * w * 0.5;
          const py = (((c.phase * 5.3 + s * 1.7) % 1) - 0.5) * h * 0.6;
          ctx!.beginPath();
          ctx!.arc(px, py, Math.max(0.3, w * 0.03), 0, TAU);
          ctx!.fill();
        }
      }
      // edge sheen: a faint matte ridge-line (NOT a bright gloss sliver) — just
      // enough to read the ridge, no plastic shine.
      if (c.depth > 0.5) {
        ctx!.strokeStyle = `hsla(${c.hue}, ${c.sat}%, ${Math.min(70, lit + 8 + hb * 6)}%, ${0.14 + hb * 0.08})`;
        ctx!.lineWidth = Math.max(0.5, w * 0.05);
        ctx!.lineCap = "round";
        ctx!.beginPath();
        ctx!.moveTo(-w * 0.1, h * 0.12);
        ctx!.quadraticCurveTo(-w * 0.16, -h * 0.28, 0, -h * 0.45);
        ctx!.stroke();
      }
      // micro-fuzz hairs around the tip on front calyxes
      if (detail && c.depth > 0.78) {
        ctx!.strokeStyle = `hsla(${c.hue}, ${Math.max(0, c.sat - 12)}%, ${Math.min(78, lit + 16)}%, 0.22)`;
        ctx!.lineWidth = 0.4;
        for (let f = 0; f < 4; f++) {
          const ang = -Math.PI / 2 + (f - 1.5) * 0.5;
          const ox = Math.cos(ang) * w * 0.3, oy = -h * 0.4 + Math.sin(ang) * h * 0.12;
          ctx!.beginPath();
          ctx!.moveTo(ox, oy);
          ctx!.lineTo(ox + Math.cos(ang) * w * 0.16, oy + Math.sin(ang) * w * 0.16);
          ctx!.stroke();
        }
      }
      ctx!.restore();
    };
    for (const c of bud.calyxes) if (c.depth < 0.55) drawCalyx(c); // back layer
    if (grow > 0.15) {
      for (const lf of bud.sugar) {
        ctx!.save();
        ctx!.translate(lf.x - baseX, lf.y - baseY);
        ctx!.rotate(lf.rot);
        drawFan(lf.sz * (0.6 + 0.4 * grow), 3, 0.3, 0, 0, 1, lf.rot * 41.3);
        ctx!.restore();
      }
    }
    for (const c of bud.calyxes) if (c.depth >= 0.55) drawCalyx(c); // front layer
    ctx!.globalAlpha = 1;

    // ---- pistils: thin, curly, irregular, from between the calyxes ----
    if (grow > 0.1) {
      const fiber = pistilFiber(P.ripe, P.brown, bc.pistilMagenta);
      const ball = pistilBall(P.ripe, P.brown, bc.pistilMagenta);
      ctx!.lineWidth = Math.max(0.4, budW * 0.004);
      ctx!.lineCap = "round";
      for (const ps of bud.pistils) {
        if (ps.k > grow) continue;
        const L = budW * 0.2 * ps.len * clamp((grow - ps.k * 0.5) / 0.6, 0.4, 1);
        const x0 = ps.x - baseX, y0 = ps.y - baseY;
        const x1 = x0 + Math.cos(ps.a) * L, y1 = y0 + Math.sin(ps.a) * L;
        const mx = (x0 + x1) / 2 + ps.bend * (3 + P.ripe * 3); // stronger curl
        const my = (y0 + y1) / 2 - 3 - Math.abs(ps.bend) * 2;
        ctx!.strokeStyle = fiber;
        ctx!.beginPath();
        ctx!.moveTo(x0, y0);
        ctx!.quadraticCurveTo(mx, my, x1, y1);
        ctx!.stroke();
        ctx!.fillStyle = ball;
        ctx!.beginPath();
        ctx!.arc(x1, y1, Math.max(0.5, budW * 0.006), 0, TAU);
        ctx!.fill();
      }
    }

    // ---- trichome frost: soft additive specks that build into fuzzy frost
    // patches (revealed with their host calyx, never floating) ----
    if (P.trich > 0) {
      // Engine 7: the close-up frost carries the same maturity model — each speck
      // is clear / cloudy / amber by its stable bucket against the ripening mix,
      // with a lavender tip on purple phenos. Matte, light-scattering resin dust.
      ctx!.save();
      const purpleM = clamp(live.current.budColor?.anthocyanin ?? 0, 0, 1);
      const mixM = maturityMix(clamp(P.ripe * 0.7 + P.brown * 0.6, 0, 1), purpleM * 0.4);
      for (const t of bud.trichs) {
        if (t.k > P.trich || grow < 0.04 + t.depth * 0.35) continue;
        const x = t.x - baseX, y = t.y - baseY;
        const m = maturityFor(t.mat, mixM);
        const a = 0.1 + 0.2 * clamp(P.trich - t.mat * 0.4, 0, 1);
        ctx!.fillStyle = trichHeadColor(m, a, purpleM);
        ctx!.beginPath();
        ctx!.arc(x, y, t.r * Math.max(0.8, budW * 0.014), 0, TAU);
        ctx!.fill();
      }
      ctx!.restore();
    }
    ctx!.restore();

    // ---- frost haze: a faint matte dusting around the cola (normal blend, not
    // an additive bloom — a soft frosted atmosphere, no wet sheen) ----
    if (P.trich > 0.25) {
      ctx!.save();
      const gy = baseY - budH * 0.5;
      const gg = ctx!.createRadialGradient(baseX, gy, budH * 0.06, baseX, gy, budH * 0.6);
      gg.addColorStop(0, `rgba(214,224,219,${0.03 + P.trich * 0.03})`);
      gg.addColorStop(1, "rgba(214,224,219,0)");
      ctx!.fillStyle = gg;
      ctx!.fillRect(0, 0, W, H);
      ctx!.restore();
    }
  }

  function drawDust() {
    for (const dd of dust) {
      ctx!.globalAlpha = clamp(dd.life / dd.max, 0, 1) * 0.85;
      ctx!.fillStyle = dd.gold ? "rgb(233,220,168)" : "rgb(168,214,176)";
      ctx!.beginPath();
      ctx!.arc(dd.x, dd.y, dd.r, 0, TAU);
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;
  }

  function draw(tt: number) {
    ctx!.clearRect(0, 0, W, H);
    if (view === "macro") drawMacro(tt);
    else {
      drawChamberShell(tt);
      drawPlant(tt);
    }
    drawDust();
  }

  function setSize(w: number, h: number) {
    W = w;
    H = h;
    buildScene();
    buildPlant();
    buildMacro();
  }

  function pointerDown(x: number, y: number) {
    ptr.active = true;
    ptr.x = x;
    ptr.y = y;
    ptr.vx = 0;
    ptr.lastT = 0;
  }
  function pointerMove(x: number, y: number, nowMs: number) {
    if (!ptr.active) return;
    if (ptr.lastT === 0) ptr.lastT = nowMs;
    const nx = x, ny = y;
    const dts = Math.max(0.004, (nowMs - ptr.lastT) / 1000);
    ptr.vx = lerp(ptr.vx, clamp((nx - ptr.x) / dts, -2600, 2600), 0.55);
    ptr.x = nx;
    ptr.y = ny;
    ptr.lastT = nowMs;
  }
  function pointerUp() {
    ptr.active = false;
  }

  return { setSize, draw, step: stepPhysics, pointerDown, pointerMove, pointerUp };
}
