"use client";

// Whole-plant 3D renderer — the 7-layer construction model:
//   1. Central stem/core          (skeleton.ts → TubeGeometry)
//   2. Secondary branchlets       (skeleton.ts → TubeGeometry)
//   3. Calyx/bract clusters       (bud3d/cola.ts → InstancedMesh)
//   4. Sugar leaves               (bud3d/detail.ts → InstancedMesh)
//   5. Pistils                    (bud3d/detail.ts → InstancedMesh)
//   6. Trichome/resin coat        (bud3d/detail.ts → InstancedMesh)
//   7. Fan leaves + final assembly (fanLeaf.ts → InstancedMesh)
//
// The skeleton builder outputs pure typed data; this component turns it into
// three.js geometry. Colas reuse the existing bud3d builders (buildCola,
// buildFrost, buildPistils, buildSugarLeaves) placed at each bud site from
// the skeleton, aggregated into shared InstancedMesh pools for performance.

import { Canvas, useFrame, type ThreeElements } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildPlantSkeleton, type PlantSkeleton, type ColaPlacement, type Vec3 } from "@/lib/chamber/plant3d/skeleton";
import { buildFanLeaf } from "@/lib/chamber/plant3d/fanLeaf";
import { buildCola, colaSilhouette, hslToRgb, type ColaInstance } from "@/lib/chamber/bud3d/cola";
import { buildFrost, buildPistils, buildSugarLeaves, type FrostInstance, type PistilInstance, type SugarLeafInstance, type FrostMat } from "@/lib/chamber/bud3d/detail";
import { morphologyFor, type DevParams, type Morphology, type Silhouette } from "@/lib/chamber/morphology";
import { budDnaFor, pickPaletteColor, type BudDNA } from "@/lib/chamber/budDna";
import { silhouetteFor, budColorForStrain } from "@/lib/chamber/strainVisuals";

const UP = new THREE.Vector3(0, 1, 0);

// --- Woody parts (stem + branches) ------------------------------------------

function pathToTube(points: Vec3[], radii: number[], segments = 6): THREE.BufferGeometry | null {
  if (points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(
    points.map(p => new THREE.Vector3(p[0], p[1], p[2])),
  );
  const tubular = points.length * 3;
  const geo = new THREE.TubeGeometry(curve, tubular, 1, segments, false);

  // Apply per-segment taper by scaling each ring's radius.
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const targetR = lerpArr(radii, t);
    curve.getPointAt(t, c);
    for (let j = 0; j <= segments; j++) {
      const idx = i * (segments + 1) + j;
      v.fromBufferAttribute(pos, idx);
      v.sub(c).normalize().multiplyScalar(targetR).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function lerpArr(arr: number[], t: number): number {
  if (arr.length === 0) return 0;
  if (arr.length === 1) return arr[0];
  const f = Math.max(0, Math.min(1, t)) * (arr.length - 1);
  const i = Math.floor(f);
  const frac = f - i;
  if (i >= arr.length - 1) return arr[arr.length - 1];
  return arr[i] + (arr[i + 1] - arr[i]) * frac;
}

function WoodyParts({ skeleton }: { skeleton: PlantSkeleton }) {
  const merged = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];

    // Main stem
    const stemPts = skeleton.stem.map(s => s.pos);
    const stemRadii = skeleton.stem.map(s => s.radius);
    const stemGeo = pathToTube(stemPts, stemRadii, 8);
    if (stemGeo) geos.push(stemGeo);

    // Branches from each node
    for (const node of skeleton.nodes) {
      const bGeo = pathToTube(node.branch.points, node.branch.radii, 5);
      if (bGeo) geos.push(bGeo);

      // Branchlets
      for (const bl of node.branchlets) {
        const blGeo = pathToTube(bl.path.points, bl.path.radii, 4);
        if (blGeo) geos.push(blGeo);
      }
    }

    if (geos.length === 0) return null;

    // Merge all woody geometry into one draw call.
    const merged = mergeBufferGeometries(geos);
    geos.forEach(g => g.dispose());
    return merged;
  }, [skeleton]);

  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x3d5c2a, roughness: 0.85, metalness: 0.0 }),
    [],
  );

  if (!merged) return null;
  return <mesh geometry={merged} material={mat} />;
}

function mergeBufferGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : 0;
  }
  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIdx);
  let vOff = 0, iOff = 0, baseV = 0;
  for (const g of geos) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos[(vOff + i) * 3] = p.getX(i);
      pos[(vOff + i) * 3 + 1] = p.getY(i);
      pos[(vOff + i) * 3 + 2] = p.getZ(i);
      if (n) {
        norm[(vOff + i) * 3] = n.getX(i);
        norm[(vOff + i) * 3 + 1] = n.getY(i);
        norm[(vOff + i) * 3 + 2] = n.getZ(i);
      }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        indices[iOff + i] = g.index.getX(i) + baseV;
      }
      iOff += g.index.count;
    }
    baseV += p.count;
    vOff += p.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(norm, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

// Color-aware merge (position + normal + color) into one draw call.
function mergeColoredGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0, totalIdx = 0;
  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : 0;
  }
  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  const col = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIdx);
  let vOff = 0, iOff = 0, baseV = 0;
  for (const g of geos) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      pos[(vOff + i) * 3] = p.getX(i);
      pos[(vOff + i) * 3 + 1] = p.getY(i);
      pos[(vOff + i) * 3 + 2] = p.getZ(i);
      if (n) { norm[(vOff + i) * 3] = n.getX(i); norm[(vOff + i) * 3 + 1] = n.getY(i); norm[(vOff + i) * 3 + 2] = n.getZ(i); }
      if (c) { col[(vOff + i) * 3] = c.getX(i); col[(vOff + i) * 3 + 1] = c.getY(i); col[(vOff + i) * 3 + 2] = c.getZ(i); }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) indices[iOff + i] = g.index.getX(i) + baseV;
      iOff += g.index.count;
    }
    baseV += p.count;
    vOff += p.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(norm, 3));
  merged.setAttribute("color", new THREE.BufferAttribute(col, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

// --- Bud cores (the solid teardrop body behind each cola's calyxes) ----------
// Without this the calyxes read as loose floating dots with the background
// showing through the seams — the bud vanishes at whole-plant zoom. The core is
// the same lathed silhouette BudGL uses, pulled inside the calyx shell, merged
// across every bud site into one vertex-coloured draw call.

function FloraBudCore({
  sites, dna, dev, refColaSize, purple,
}: { sites: ColaPlacement[]; dna: BudDNA; dev: DevParams; refColaSize: number; purple: number }) {
  const geom = useMemo(() => {
    const { profile, H } = colaSilhouette(dna);
    const pts = profile.map(([r, y]) => new THREE.Vector2(r * 0.66, y));

    // Deep understructure colour → muted crown (mirrors BudGL.BudCore).
    const [br, bg, bb] = hslToRgb(pickPaletteColor(dna.palette, 0.5));
    let baseR = br * 0.4, baseG = bg * 0.46, baseB = bb * 0.4;
    const pp = Math.min(1, Math.max(0, purple)) * 0.5;
    if (pp > 0) { baseR += (0.22 - baseR) * pp; baseG += (0.1 - baseG) * pp; baseB += (0.28 - baseB) * pp; }
    const fr = 0.42, fg = 0.52, fb = 0.4;
    const lift = 0.3 + 0.3 * Math.min(1, Math.max(0, dev.trich));
    const devScale = 0.18 + 0.82 * Math.min(1, Math.max(0, dev.budDev));

    const geos: THREE.BufferGeometry[] = [];
    for (const site of sites) {
      const worldScale = site.scale * refColaSize * devScale;
      if (worldScale < 0.012) continue;
      const geo = new THREE.LatheGeometry(pts, 18);
      const gp = geo.attributes.position;
      const colors = new Float32Array(gp.count * 3);
      for (let i = 0; i < gp.count; i++) {
        const t = Math.min(1, Math.max(0, gp.getY(i) / H));
        const k = t * t * lift;
        colors[i * 3] = baseR + (fr - baseR) * k;
        colors[i * 3 + 1] = baseG + (fg - baseG) * k;
        colors[i * 3 + 2] = baseB + (fb - baseB) * k;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      geo.scale(worldScale, worldScale, worldScale);
      geo.translate(site.pos[0], site.pos[1], site.pos[2]);
      geos.push(geo);
    }
    if (geos.length === 0) return null;
    const merged = mergeColoredGeometries(geos);
    geos.forEach(g => g.dispose());
    return merged;
  }, [sites, dna, dev, refColaSize, purple]);

  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0 }),
    [],
  );

  if (!geom) return null;
  return <mesh geometry={geom} material={mat} />;
}

// --- Fan leaves (instanced) --------------------------------------------------

function FanLeafLayer({ skeleton, morph }: { skeleton: PlantSkeleton; morph: Morphology }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  // Collect all leaf placements from the skeleton.
  const allLeaves = useMemo(() => {
    const leaves: Array<{ pos: Vec3; rot: Vec3; scale: number }> = [];
    for (const node of skeleton.nodes) {
      for (const fl of node.fanLeaves) {
        leaves.push({ pos: fl.pos, rot: fl.rot, scale: fl.scale });
      }
      for (const bl of node.branchlets) {
        for (const fl of bl.leaves) {
          leaves.push({ pos: fl.pos, rot: fl.rot, scale: fl.scale });
        }
      }
    }
    return leaves;
  }, [skeleton]);

  // Build the leaf blade geometry.
  const geom = useMemo(() => {
    const leafData = buildFanLeaf({
      leaflets: morph.leafletMax,
      widthMul: morph.leafW,
      hue: morph.hue,
      sat: morph.sat,
      lit: morph.lit,
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(leafData.vertices, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(leafData.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(leafData.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [morph]);

  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || allLeaves.length === 0) return;
    const d = new THREE.Object3D();
    allLeaves.forEach((leaf, i) => {
      d.position.set(leaf.pos[0], leaf.pos[1], leaf.pos[2]);
      d.rotation.set(leaf.rot[0], leaf.rot[1], leaf.rot[2]);
      d.scale.setScalar(leaf.scale);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [allLeaves]);

  if (allLeaves.length === 0) return null;
  return <instancedMesh key={allLeaves.length} ref={ref} args={[geom, mat, allLeaves.length]} />;
}

// --- Flora layer (colas: calyxes + frost + pistils + sugar leaves) -----------

interface AggregatedFlora {
  calyxes: Array<ColaInstance & { worldPos: Vec3; worldScale: number }>;
  frost: Array<FrostInstance & { worldPos: Vec3; worldScale: number }>;
  pistils: Array<PistilInstance & { worldPos: Vec3; worldScale: number }>;
  sugarLeaves: Array<SugarLeafInstance & { worldPos: Vec3; worldScale: number }>;
}

function collectBudSites(skeleton: PlantSkeleton): ColaPlacement[] {
  const sites: ColaPlacement[] = [];
  if (skeleton.topCola) sites.push(skeleton.topCola);
  for (const node of skeleton.nodes) {
    if (node.budSite) sites.push(node.budSite);
    if (node.nodeBud) sites.push(node.nodeBud);
    for (const bl of node.branchlets) {
      if (bl.budSite) sites.push(bl.budSite);
    }
  }
  return sites;
}

function buildAggregatedFlora(
  sites: ColaPlacement[],
  dna: BudDNA,
  seed: number,
  dev: DevParams,
  refColaSize: number,
  isMobile: boolean,
): AggregatedFlora {
  const agg: AggregatedFlora = { calyxes: [], frost: [], pistils: [], sugarLeaves: [] };

  for (let si = 0; si < sites.length; si++) {
    const site = sites[si];
    const worldScale = site.scale * refColaSize;
    if (worldScale < 0.01) continue;

    // Density scales with the cola's on-screen size (area ∝ scale²), so a big main
    // cola gets proportionally more calyxes and stays densely clad instead of going
    // sleek/bare. Referenced to a ~0.5-scale side cola (≈1×); capped for perf.
    const densityMul = Math.min(9, Math.max(0.5, (site.scale / 0.5) * (site.scale / 0.5)));
    const maxInst = Math.min(
      isMobile ? 340 : 900,
      Math.max(24, Math.round((isMobile ? 110 : 260) * densityMul)),
    );
    const cola = buildCola(dna, seed + si * 7, { budDev: dev.budDev, maxInstances: maxInst, densityMul });

    for (const c of cola) {
      agg.calyxes.push({ ...c, worldPos: site.pos, worldScale });
    }

    if (dev.trich > 0) {
      const frost = buildFrost(cola, {
        seed: seed + si * 11,
        density: dna.trichomeDensity * dev.trich * site.budgetMul,
        ripe: dev.ripe,
        isMobile,
      });
      for (const f of frost) {
        agg.frost.push({ ...f, worldPos: site.pos, worldScale });
      }
    }

    const pistils = buildPistils(cola, {
      seed: seed + si * 13,
      chance: dna.pistilChance * Math.max(0.3, site.budgetMul),
      ripe: dev.ripe,
      brown: dev.brown,
      isMobile,
    });
    for (const p of pistils) {
      agg.pistils.push({ ...p, worldPos: site.pos, worldScale });
    }

    const sugar = buildSugarLeaves(cola, {
      seed: seed + si * 17,
      amount: 0.8 * Math.max(0.3, site.budgetMul) * Math.max(0.4, dev.budDev),
      frost: dev.trich,
      isMobile,
    });
    for (const s of sugar) {
      agg.sugarLeaves.push({ ...s, worldPos: site.pos, worldScale });
    }
  }

  return agg;
}

// Instance transform: takes unit-space position, applies cola scale + world offset.
function setColaInstanceTransform(
  obj: THREE.Object3D,
  unitPos: Vec3,
  worldPos: Vec3,
  worldScale: number,
  scale: Vec3 | number,
  rot?: Vec3,
) {
  const s = typeof scale === "number" ? scale : 1;
  const sx = typeof scale === "number" ? worldScale : scale[0] * worldScale;
  const sy = typeof scale === "number" ? worldScale : scale[1] * worldScale;
  const sz = typeof scale === "number" ? worldScale : scale[2] * worldScale;
  obj.position.set(
    worldPos[0] + unitPos[0] * worldScale,
    worldPos[1] + unitPos[1] * worldScale,
    worldPos[2] + unitPos[2] * worldScale,
  );
  obj.scale.set(sx * s, sy * s, sz * s);
  if (rot) {
    obj.rotation.set(rot[0], rot[1], rot[2]);
  }
  obj.updateMatrix();
}

function useCalyxGeometry() {
  return useMemo(() => {
    const profile = [
      [0.0, -0.5], [0.28, -0.42], [0.42, -0.3], [0.5, -0.15],
      [0.46, 0.0], [0.36, 0.16], [0.22, 0.3], [0.1, 0.42], [0.0, 0.5],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(profile, 16);
    const pos = geo.attributes.position;
    const RIBS = 6, AMT = 0.14;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const r = Math.hypot(v.x, v.z);
      if (r > 1e-4) {
        const theta = Math.atan2(v.z, v.x);
        const f = 1 + AMT * Math.cos(RIBS * theta);
        v.x *= f; v.z *= f;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
}

function usePistilGeometry() {
  return useMemo(() => {
    const N = 8;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const bend = 0.14 * Math.sin(t * Math.PI * 0.85) + 0.05 * t * t;
      pts.push(new THREE.Vector3(bend, t, 0));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 12, 0.12, 3, false);
    const pos = geo.attributes.position;
    const c = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      curve.getPointAt(t, c);
      const taper = Math.max(0.04, 1 - 0.95 * t);
      for (let j = 0; j <= 3; j++) {
        const idx = i * 4 + j;
        v.fromBufferAttribute(pos, idx);
        v.sub(c).multiplyScalar(taper).add(c);
        pos.setXYZ(idx, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
}

function useSugarLeafGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 1.0);
    s.lineTo(0.16, 0.74);
    s.lineTo(0.10, 0.66);
    s.lineTo(0.26, 0.44);
    s.lineTo(0.16, 0.36);
    s.lineTo(0.28, 0.12);
    s.lineTo(0.12, 0.0);
    s.lineTo(0, 0.04);
    s.lineTo(-0.12, 0.0);
    s.lineTo(-0.28, 0.12);
    s.lineTo(-0.16, 0.36);
    s.lineTo(-0.26, 0.44);
    s.lineTo(-0.10, 0.66);
    s.lineTo(-0.16, 0.74);
    s.lineTo(0, 1.0);
    const g = new THREE.ShapeGeometry(s);
    g.computeVertexNormals();
    return g;
  }, []);
}

function frostColor(mat: FrostMat, purple: number): THREE.Color {
  let r: number, g: number, b: number;
  if (mat === 0) { r = 224; g = 242; b = 255; }
  else if (mat === 1) { r = 248; g = 250; b = 244; }
  else return new THREE.Color(228 / 255, 188 / 255, 110 / 255);
  const t = Math.min(1, Math.max(0, purple)) * 0.35;
  r = r + (198 - r) * t; g = g + (178 - g) * t; b = b + (232 - b) * t;
  return new THREE.Color(r / 255, g / 255, b / 255);
}

function FloraCalyxes({ flora, purple }: { flora: AggregatedFlora; purple: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useCalyxGeometry();
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.74, metalness: 0.0 }), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    const q = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    flora.calyxes.forEach((ins, i) => {
      setColaInstanceTransform(d, ins.pos, ins.worldPos, ins.worldScale, ins.scale);
      dir.set(ins.pos[0], 0.65, ins.pos[2]).normalize();
      q.setFromUnitVectors(UP, dir);
      d.quaternion.copy(q);
      d.rotateY(ins.rot[1]);
      d.rotateZ(ins.rot[2] * 0.4);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);

      let cr = ins.color[0], cg = ins.color[1], cb = ins.color[2];
      const pp = Math.min(1, Math.max(0, purple)) * 0.4;
      if (pp > 0) { cr = cr + (0.45 - cr) * pp; cg = cg * (1 - pp * 0.6); cb = cb + (0.55 - cb) * pp; }
      mesh.setColorAt(i, col.setRGB(cr, cg, cb));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [flora, purple]);

  if (flora.calyxes.length === 0) return null;
  return <instancedMesh key={flora.calyxes.length} ref={ref} args={[geom, mat, flora.calyxes.length]} />;
}

function FloraFrost({ flora, purple }: { flora: AggregatedFlora; purple: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0.1, emissive: new THREE.Color(0.05, 0.07, 0.08), transparent: true, opacity: 0.92 }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    flora.frost.forEach((g, i) => {
      d.position.set(
        g.worldPos[0] + g.pos[0] * g.worldScale,
        g.worldPos[1] + g.pos[1] * g.worldScale,
        g.worldPos[2] + g.pos[2] * g.worldScale,
      );
      d.scale.setScalar(g.r * g.worldScale);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, frostColor(g.mat, purple));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [flora, purple]);

  if (flora.frost.length === 0) return null;
  return <instancedMesh key={`f${flora.frost.length}`} ref={ref} args={[geom, mat, flora.frost.length]} />;
}

function FloraPistils({ flora }: { flora: AggregatedFlora }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = usePistilGeometry();
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.0 }), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const q = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const col = new THREE.Color();
    flora.pistils.forEach((p, i) => {
      d.position.set(
        p.worldPos[0] + p.pos[0] * p.worldScale,
        p.worldPos[1] + p.pos[1] * p.worldScale,
        p.worldPos[2] + p.pos[2] * p.worldScale,
      );
      dir.set(p.dir[0], p.dir[1], p.dir[2]).normalize();
      q.setFromUnitVectors(UP, dir);
      d.quaternion.copy(q);
      d.rotateY(p.roll);
      d.scale.setScalar(p.len * p.worldScale);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, col.setRGB(p.color[0], p.color[1], p.color[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [flora]);

  if (flora.pistils.length === 0) return null;
  return <instancedMesh key={`p${flora.pistils.length}`} ref={ref} args={[geom, mat, flora.pistils.length]} />;
}

function FloraSugarLeaves({ flora }: { flora: AggregatedFlora }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useSugarLeafGeometry();
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide, emissive: new THREE.Color(0.03, 0.05, 0.03) }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const q = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const col = new THREE.Color();
    flora.sugarLeaves.forEach((leaf, i) => {
      d.position.set(
        leaf.worldPos[0] + leaf.pos[0] * leaf.worldScale,
        leaf.worldPos[1] + leaf.pos[1] * leaf.worldScale,
        leaf.worldPos[2] + leaf.pos[2] * leaf.worldScale,
      );
      dir.set(leaf.dir[0], leaf.dir[1], leaf.dir[2]).normalize();
      q.setFromUnitVectors(UP, dir);
      d.quaternion.copy(q);
      d.rotateY(leaf.roll);
      d.scale.setScalar(leaf.scale * leaf.worldScale);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, col.setRGB(leaf.color[0], leaf.color[1], leaf.color[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [flora]);

  if (flora.sugarLeaves.length === 0) return null;
  return <instancedMesh key={`sl${flora.sugarLeaves.length}`} ref={ref} args={[geom, mat, flora.sugarLeaves.length]} />;
}

// Slow auto-rotate for the whole plant.
function AutoRotate({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.15;
  });
  return <group ref={ref}>{children}</group>;
}

// --- Main component ----------------------------------------------------------

export interface PlantGLProps {
  /** Strain slug (e.g. "blue-dream"). */
  strain?: string;
  /** Indica ratio 0..1. */
  indicaRatio?: number;
  /** Deterministic seed. */
  seed: number;
  /** Growth day. */
  day: number;
  /** Growth stage. */
  stage: string;
  /** Development params. */
  dev: DevParams;
  /** Bud colour override. */
  budColor?: { anthocyanin: number; calyxHue: number; calyxSat: number; pistilMagenta: number };
  /** Reduce motion (no spin). */
  reducedMotion?: boolean;
}

export function PlantGL({
  strain,
  indicaRatio = 0.5,
  seed,
  day,
  stage,
  dev,
  budColor,
  reducedMotion = false,
}: PlantGLProps) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const morph = useMemo(() => morphologyFor(indicaRatio), [indicaRatio]);
  const sil = useMemo(() => silhouetteFor(strain, indicaRatio), [strain, indicaRatio]);
  const bc = useMemo(
    () => budColor ?? budColorForStrain(strain, morph.hue, seed),
    [strain, morph.hue, seed, budColor],
  );

  const skeleton = useMemo(
    () => buildPlantSkeleton({ seed, morph, silhouette: sil, dev, day, stage }),
    [seed, morph, sil, dev, day, stage],
  );

  const dna = useMemo(() => budDnaFor(strain ?? "", bc), [strain, bc]);

  const sites = useMemo(() => collectBudSites(skeleton), [skeleton]);

  const flora = useMemo(
    () => buildAggregatedFlora(sites, dna, seed, dev, skeleton.refColaSize, isMobile),
    [sites, dna, seed, dev, skeleton.refColaSize, isMobile],
  );

  // Camera position: pull back enough to frame the plant.
  const camY = skeleton.height * 0.45;
  const camZ = Math.max(2.5, skeleton.height * 1.3);

  const purple = bc.anthocyanin;

  const content = (
    <>
      <WoodyParts skeleton={skeleton} />
      <FanLeafLayer skeleton={skeleton} morph={morph} />
      <FloraBudCore sites={sites} dna={dna} dev={dev} refColaSize={skeleton.refColaSize} purple={purple} />
      <FloraCalyxes flora={flora} purple={purple} />
      <FloraSugarLeaves flora={flora} />
      <FloraPistils flora={flora} />
      <FloraFrost flora={flora} purple={purple} />
    </>
  );

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, camY, camZ], fov: 40 }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 4]} intensity={1.3} color="#fff8e0" />
        <directionalLight position={[-2, 3, -1]} intensity={0.4} color="#d0e8ff" />
        <pointLight position={[0, skeleton.height, 2]} intensity={8} distance={6} color="#e8fff4" />

        {reducedMotion ? <group>{content}</group> : <AutoRotate>{content}</AutoRotate>}

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={1}
          maxDistance={8}
          target={[0, skeleton.height * 0.4, 0]}
        />
      </Canvas>
    </div>
  );
}
