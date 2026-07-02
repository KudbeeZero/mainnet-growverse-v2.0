// Layer 1 + 2 — 3D plant skeleton builder (pure, DOM-free, unit-testable).
//
// Generates the full plant structure in world space: a tapered main stem, branch
// paths from phyllotaxic nodes, and bud-site placements where colas attach. This
// is the 3D equivalent of chamberCore.buildPlant's spine/node/branch logic — same
// genetics inputs (Morphology, Silhouette, DevParams), same engines (phyllotaxis,
// apical dominance), but outputting typed 3D data instead of 2D canvas draw calls.
//
// The existing bud3d/cola.ts + detail.ts handle layers 3-6 (calyxes, sugar leaves,
// pistils, trichomes) for each cola; this module places those colas on the skeleton.

import { mulberry32, clamp, lerp, smooth, type Morphology, type Silhouette, type DevParams } from "../morphology";
import { phyllotaxis, foreshorten } from "../phyllotaxy";
import { colaTops } from "../apicalDominance";

export type Vec3 = [number, number, number];

export interface StemPoint {
  pos: Vec3;
  radius: number;
  t: number;
}

export interface BranchPath {
  points: Vec3[];
  radii: number[];
}

export interface ColaPlacement {
  pos: Vec3;
  /** Uniform scale relative to the plant's reference cola size. */
  scale: number;
  /** Euler rotation (radians) so the cola points outward from the stem. */
  rot: Vec3;
  /** Instance budget multiplier (0..1) — distant/small colas get fewer instances. */
  budgetMul: number;
}

export interface LeafPlacement {
  pos: Vec3;
  /** Euler rotation (radians). */
  rot: Vec3;
  /** Leaf blade scale (world units). */
  scale: number;
  /** Number of leaflets (3, 5, 7, or 9). */
  leaflets: number;
}

export interface BranchletData {
  path: BranchPath;
  leaves: LeafPlacement[];
  budSite: ColaPlacement | null;
}

export interface PlantNode {
  /** Position on the stem where this node attaches. */
  pos: Vec3;
  /** 0..1 fractional height up the stem (0 = base, 1 = apex). */
  f: number;
  /** ±1 side of the stem. */
  side: 1 | -1;
  /** Main branch path from this node. */
  branch: BranchPath;
  /** Fan leaves at this node. */
  fanLeaves: LeafPlacement[];
  /** Cola at the branch tip (null if not flowering here). */
  budSite: ColaPlacement | null;
  /** Small bud at the node intersection (null if too low / not flowering). */
  nodeBud: ColaPlacement | null;
  /** Secondary branchlets forking off this branch. */
  branchlets: BranchletData[];
  /** Azimuth depth (−1 back .. +1 front). */
  depth: number;
}

export interface PlantSkeleton {
  stem: StemPoint[];
  nodes: PlantNode[];
  topCola: ColaPlacement | null;
  /** Plant height in world units. */
  height: number;
  /** Reference cola size (world units) for scaling budDev → actual size. */
  refColaSize: number;
}

export interface BuildPlantOpts {
  seed: number;
  morph: Morphology;
  silhouette: Silhouette;
  dev: DevParams;
  day: number;
  stage: string;
  /** World-space maximum plant height. Default 3. */
  maxHeight?: number;
}

const STEM_SEGMENTS = 24;
const MAX_NODES = 18;

/**
 * Build the full 3D plant skeleton. Pure; deterministic from seed + genetics.
 *
 * The stem grows along +Y from the origin. Branches extend laterally (X/Z) with
 * phyllotaxic azimuth. Bud sites carry scale + rotation so the renderer can place
 * colas from bud3d at each position.
 */
export function buildPlantSkeleton(opts: BuildPlantOpts): PlantSkeleton {
  const { seed, morph: S, silhouette: SK, dev: P, day: d, stage } = opts;
  const maxH = opts.maxHeight ?? 3;
  const rnd = mulberry32(seed * 7919 + 13);

  const flowering = stage === "flowering" || stage === "late_flower" || stage === "harvest";

  // Height ramp — same logic as chamberCore.buildPlant.
  let hN: number;
  if (d <= 10) hN = lerp(0.05, 0.13, smooth(d / 10));
  else if (d <= 34) hN = lerp(0.13, 0.55, Math.pow((d - 10) / 24, 0.75));
  else hN = lerp(0.55, clamp(0.6 * S.stretch, 0, 0.97), smooth(clamp((d - 34) / 28, 0, 1)));
  hN = clamp(hN * S.heightMul, 0.05, 0.97);
  const stemH = maxH * hN;

  // --- Layer 1: Main stem ---
  const wob1 = (rnd() - 0.5) * stemH * 0.08;
  const wob2 = (rnd() - 0.5) * stemH * 0.04;
  const stem: StemPoint[] = [];
  const baseRadius = stemH * 0.018;
  for (let i = 0; i <= STEM_SEGMENTS; i++) {
    const t = i / STEM_SEGMENTS;
    const segNoise = (rnd() - 0.5) * stemH * 0.006;
    const x = wob1 * Math.sin(Math.PI * t) + wob2 * Math.sin(Math.PI * 2 * t) * 0.5 + segNoise * Math.sin(t * 9);
    const z = wob2 * Math.cos(Math.PI * t) * 0.3 + segNoise * Math.cos(t * 7) * 0.5;
    const y = stemH * t;
    const radius = baseRadius * lerp(1.4, 0.35, t);
    stem.push({ pos: [x, y, z], radius, t });
  }

  // --- Layer 2: Nodes + branches ---
  const flowerPack = flowering ? 1.18 : 1;
  const nodeTarget = Math.floor((hN / S.internode) * SK.nodeDensity * SK.vertStack * flowerPack);
  const maxNodes = Math.min(MAX_NODES, Math.max(d <= 10 ? 1 : 2, nodeTarget));
  const grow = smooth(clamp((d - 8) / 22, 0, 1));

  const maturity = clamp(
    lerp(0.42, 1, smooth(clamp((d - 12) / 40, 0, 1))) + (flowering ? 0.14 : 0),
    0.42, 1,
  );
  const phase = mulberry32((seed * 2246822519) >>> 0)() * Math.PI * 2;
  const azi = phyllotaxis(maxNodes, maturity, phase);

  const tops = colaTops(SK.apicalDominance);
  const nTop = flowering ? Math.min(tops.count - 1, Math.max(0, maxNodes - 2)) : 0;
  const topFromIdx = maxNodes - nTop;

  const nodes: PlantNode[] = [];

  for (let i = 0; i < maxNodes; i++) {
    const fBase = (i + 1) / (maxNodes + 1);
    const stackExp = lerp(1.0, 1.22, clamp(SK.vertStack - 0.96, 0, 0.3) / 0.3);
    const f = clamp(Math.pow(fBase, stackExp) + (rnd() - 0.5) * 0.045, 0.04, 0.96);
    const low = Math.pow(1 - f, 0.75);

    const stemIdx = Math.round(f * STEM_SEGMENTS);
    const nodePos: Vec3 = [stem[stemIdx].pos[0], stem[stemIdx].pos[1], stem[stemIdx].pos[2]];

    const az = azi[i];
    const side = az.side;
    const lateral = az.lateral;

    const topK = nTop > 0 && i >= topFromIdx ? i - topFromIdx : -1;
    const apexSplay = smooth(clamp((f - 0.58) / 0.3, 0, 1));
    const spread = lerp(1, SK.lowerSpread, low) * lerp(1, 1.8, apexSplay);
    const shorten = 1 - SK.upperShorten * f;

    let tilt = (0.92 + rnd() * 0.3) * (1 - f * 0.22 + apexSplay * 0.55) * lerp(1, 1.12, low);
    let branchLen = maxH * 0.27 * S.branchMul * (0.35 + 0.65 * low) * grow * shorten;
    if (topK >= 0) {
      tilt *= lerp(1, 0.42, tops.release);
      branchLen *= lerp(1, 2.6, tops.release);
    }

    const curve = 0.14 + rnd() * 0.22;
    const branchRadius = stem[stemIdx].radius * (0.5 + 0.3 * low);

    // Build branch path: a curve from node position outward/upward.
    const branchSegs = 8;
    const branchPts: Vec3[] = [];
    const branchRadii: number[] = [];
    for (let j = 0; j <= branchSegs; j++) {
      const bt = j / branchSegs;
      // The lateral projection uses cos(azimuth) for X and sin(azimuth) for Z,
      // giving branches that wind around the stem in 3D.
      const outward = Math.sin(tilt) * bt * branchLen * spread;
      const upward = -Math.cos(tilt) * bt * branchLen * 0.55;
      const curveLift = curve * Math.sin(Math.PI * bt) * branchLen * 0.3;
      branchPts.push([
        nodePos[0] + lateral * outward,
        nodePos[1] - upward + curveLift,
        nodePos[2] + az.depth * outward * 0.7,
      ]);
      branchRadii.push(branchRadius * lerp(1, 0.25, bt));
    }

    const tipPos = branchPts[branchPts.length - 1];

    // Fan leaves at this node.
    const midFill = smooth(clamp(1 - Math.abs(f - 0.5) / 0.38, 0, 1));
    const skirt = clamp(low + midFill * 0.55, 0, 1) * clamp((SK.nodeLeaf - 1) / 0.2, 0, 1);
    const leafScale = maxH * (0.08 + 0.05 * low) * (0.55 + 0.45 * grow) * (1 - 0.4 * P.budDev * f) * (1 + skirt * 0.4);
    const leaflets = Math.min(S.leafletMax, 3 + 2 * Math.floor(d / 14));
    const fanLeaves: LeafPlacement[] = [];

    // Place 2-4 fan leaves around the node.
    const nLeaves = 2 + (skirt > 0.3 ? 1 : 0) + (skirt > 0.6 ? 1 : 0);
    for (let lk = 0; lk < nLeaves; lk++) {
      const leafAz = az.az + (lk - (nLeaves - 1) / 2) * 0.8 + (rnd() - 0.5) * 0.4;
      const leafTilt = 0.4 + 0.5 * low + rnd() * 0.3;
      const along = 0.05 + lk * 0.15;
      const bIdx = Math.min(branchSegs, Math.round(along * branchSegs));
      const lPos: Vec3 = [branchPts[bIdx][0], branchPts[bIdx][1], branchPts[bIdx][2]];
      fanLeaves.push({
        pos: lPos,
        rot: [leafTilt, leafAz, (rnd() - 0.5) * 0.3],
        scale: leafScale * (0.7 + rnd() * 0.3),
        leaflets,
      });
    }

    // Node leaf cluster (the broad fans at the node base).
    const nodeLeafScale = maxH * (0.05 + 0.04 * low) * (0.55 + 0.45 * grow) * SK.nodeLeaf * (1 - 0.35 * P.budDev * f) * (1 + skirt * 0.5);
    if (nodeLeafScale > 0.02) {
      const nlAz = az.az + Math.PI * 0.5 + (rnd() - 0.5) * 0.5;
      fanLeaves.push({
        pos: [nodePos[0], nodePos[1], nodePos[2]],
        rot: [0.35 + 0.4 * low, nlAz, (rnd() - 0.5) * 0.3],
        scale: nodeLeafScale,
        leaflets: Math.max(5, leaflets),
      });
    }

    // Bud site at branch tip.
    let budSite: ColaPlacement | null = null;
    if (P.budDev > 0 && topK >= 0) {
      const coShare = tops.secondaryShares[topK] / tops.leaderShare;
      const colaScale = lerp(0.72, 1.06, coShare) * SK.colaScale * (0.5 + 0.5 * P.budDev);
      budSite = {
        pos: tipPos,
        scale: Math.min(colaScale, 0.9),
        rot: [side * 0.06, az.az, 0],
        budgetMul: Math.max(0.3, colaScale),
      };
    } else if (P.budDev > 0 && f > S.flowerFrom) {
      const sizeUp = lerp(0.26, 1.18, Math.pow(f, 1.8));
      const colaScale = sizeUp * (0.5 + 0.5 * P.budDev) * 0.5;
      budSite = {
        pos: tipPos,
        scale: Math.min(colaScale, 0.55),
        rot: [side * 0.1, az.az, 0],
        budgetMul: Math.max(0.15, colaScale * 0.5),
      };
    }

    // Node-intersection bud.
    let nodeBud: ColaPlacement | null = null;
    if (P.budDev > 0 && topK < 0 && f > Math.max(S.flowerFrom, 0.38)) {
      const colaScale = (0.035 + 0.055 * f) * (0.5 + 0.5 * P.budDev) * 0.35;
      nodeBud = {
        pos: [nodePos[0], nodePos[1], nodePos[2]],
        scale: colaScale,
        rot: [0, az.az + Math.PI * 0.5, 0],
        budgetMul: 0.1,
      };
    }

    // Secondary branchlets.
    const branchlets: BranchletData[] = [];
    if (topK < 0 && branchLen > maxH * 0.045 && d > 14) {
      let nBL = rnd() < SK.branchletFrac ? 1 : 0;
      if (low > 0.45 && rnd() < SK.branchletFrac * 0.75) nBL += 1;
      for (let b = 0; b < nBL; b++) {
        const along = 0.48 + rnd() * 0.34;
        const blIdx = Math.round(along * branchSegs);
        const blBase: Vec3 = [branchPts[blIdx][0], branchPts[blIdx][1], branchPts[blIdx][2]];
        const blSide = b % 2 ? 1 : -1;
        const blLen = branchLen * (0.4 + rnd() * 0.26);
        const blTilt = 0.55 + rnd() * 0.5;
        const blCurve = 0.1 + rnd() * 0.2;
        const blSegs = 5;
        const blPts: Vec3[] = [];
        const blRadii: number[] = [];
        for (let bj = 0; bj <= blSegs; bj++) {
          const bt = bj / blSegs;
          const blOutward = Math.sin(blTilt) * bt * blLen;
          const blUp = -Math.cos(blTilt) * bt * blLen * 0.5;
          const blCurveLift = blCurve * Math.sin(Math.PI * bt) * blLen * 0.3;
          blPts.push([
            blBase[0] + blSide * lateral * blOutward * 0.6,
            blBase[1] - blUp + blCurveLift,
            blBase[2] + az.depth * blOutward * 0.4,
          ]);
          blRadii.push(branchRadius * 0.4 * lerp(1, 0.2, bt));
        }

        const blTipPos = blPts[blPts.length - 1];
        const blLeaves: LeafPlacement[] = [];
        const blLeafScale = leafScale * (0.42 + rnd() * 0.16);
        blLeaves.push({
          pos: blPts[Math.round(blSegs * 0.4)],
          rot: [0.5 + rnd() * 0.4, az.az + blSide * 0.7, (rnd() - 0.5) * 0.3],
          scale: blLeafScale,
          leaflets: Math.max(3, leaflets - 2),
        });

        let blBudSite: ColaPlacement | null = null;
        if (P.budDev > 0 && f > S.flowerFrom * 0.8) {
          blBudSite = {
            pos: blTipPos,
            scale: 0.22 * (0.5 + 0.5 * P.budDev),
            rot: [blSide * 0.1, az.az + blSide * 0.5, 0],
            budgetMul: 0.08,
          };
        }

        branchlets.push({
          path: { points: blPts, radii: blRadii },
          leaves: blLeaves,
          budSite: blBudSite,
        });
      }
    }

    nodes.push({
      pos: nodePos,
      f,
      side,
      branch: { points: branchPts, radii: branchRadii },
      fanLeaves,
      budSite,
      nodeBud,
      branchlets,
      depth: az.depth,
    });
  }

  // Top cola (leader).
  let topCola: ColaPlacement | null = null;
  if (P.budDev > 0) {
    const lateMass = 1 + P.ripe * 0.14;
    const leaderMul = lerp(0.62, 1, tops.leaderShare);
    let colaScale = SK.colaScale * lateMass * leaderMul * (0.5 + 0.5 * P.budDev);
    colaScale = Math.min(colaScale, 1.4);
    const apex = stem[stem.length - 1].pos;
    topCola = {
      pos: [apex[0], apex[1], apex[2]],
      scale: colaScale,
      rot: [0, 0, 0],
      budgetMul: 1,
    };
  }

  // Reference cola size drives every bud's world scale. Tuned so the apical cola
  // reads as a fat, dominant flower (~15-20% of plant height at full flower) and
  // side colas cluster into a visible column — not the scattered specks a smaller
  // factor produced.
  const refColaSize = stemH * 0.38 * S.clusterLen;

  return {
    stem,
    nodes,
    topCola,
    height: stemH,
    refColaSize,
  };
}
