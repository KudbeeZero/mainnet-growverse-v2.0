"use client";

// Phase 2 — whole-plant 3D renderer (studio preview).
//
// Composes the seven owner-spec layers into one R3F scene, mirroring BudGL's
// material/instancing conventions:
//   1 stem core     — tapered green tube along the skeleton spline (+ node rings)
//   2 branches      — tapered tubes arcing up off the stem
//   3 fan leaves    — serrated multi-leaflet blades, instanced, deep waxy blue-green
//   4 calyx colas   — the bud3d calyx instances, one big apex spear + satellites
//   5 sugar leaves  — narrow frosted leaflets poking through each cola
//   6 pistils       — amber curling strands weaving out of the bracts
//   7 trichome frost— tiny translucent crystals caked over every cola
//
// Every repeated element is a single instancedMesh (low draw calls). Geometry is
// deliberately low-poly (whole plant = thousands of instances) to hold the tri
// budget. Must be loaded via dynamic({ ssr:false }).

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildPlantAssembly, fatWidthCurve, type LODLevel, type PlantAssembly } from "@/lib/plant3d/assembly";
import { TrichomeLayer } from "@/components/viz/TrichomeLayer";
import { buildFanLeafOutlines } from "@/lib/plant3d/leaves";
import type { Vec3 } from "@/lib/plant3d/skeleton";
import { hslToRgb } from "@/lib/chamber/bud3d/cola";
import { pickPaletteColor, type BudDNA } from "@/lib/chamber/budDna";
import type { Silhouette } from "@/lib/chamber/morphology";

const UP = new THREE.Vector3(0, 1, 0);

// ---- shared geometry helpers --------------------------------------------

/** A tapered tube along `pts` (world) with per-point `radii`. Low radial count. */
function taperedTube(pts: Vec3[], radii: number[], radial = 6): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const tubular = Math.max(6, pts.length * 3);
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, c);
    // radius at this station: sample the radii array by t.
    const fi = t * (radii.length - 1);
    const lo = Math.floor(fi);
    const hi = Math.min(radii.length - 1, lo + 1);
    const r = radii[lo] + (radii[hi] - radii[lo]) * (fi - lo);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx);
      v.sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/** A unit cola "body" teardrop (y 0..1) sitting just inside the calyx shell so
 * the packed calyxes read as one fused frosted mass instead of floating balls
 * (mirrors BudGL's BudCore). Instanced per cola, scaled by width/height. */
function makeColaCoreGeom(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, 0)];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // Fat-through-the-middle profile (matches the reshaped calyx envelope), so
    // where the body peeks between calyxes it reads as a chunky bud, not a cone.
    // Pinch the top 14% to a point so the bare tip is calyx-only (no pale stub).
    const tipPinch = t > 0.86 ? (1 - t) / 0.14 : 1;
    pts.push(new THREE.Vector2(Math.max(0.0001, 0.42 * fatWidthCurve(t) * 0.6 * tipPinch), t));
  }
  pts.push(new THREE.Vector2(0.0001, 1));
  const geo = new THREE.LatheGeometry(pts, 14);
  // Angular + vertical lobing so even the body silhouette is bumpy/irregular.
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    if (r > 1e-4) {
      const theta = Math.atan2(v.z, v.x);
      const f = 1 + 0.16 * Math.cos(5 * theta + v.y * 6.5) + 0.09 * Math.cos(3 * theta - v.y * 4.2);
      v.x *= f;
      v.z *= f;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/** Detail level of the calyx icosphere (0 = 20 tris, 1 = 80 tris). Kept low for
 * the whole-plant tri budget; SMOOTH sphere normals (below) do the heavy lifting
 * on killing the crystalline facet look, so a cheap sphere still reads organic. */
const CALYX_DETAIL = 0;

/** A PLUMP, rounded, organic calyx — a swollen teardrop/kidney sac, NOT a faceted
 * shard. Built from an icosphere, deformed to bulge at the equator and round to a
 * soft point up top, then given SMOOTH radial normals (never computeVertexNormals,
 * which flat-shades the non-indexed icosphere into visible crystal facets). Stacked
 * and overlapped by the thousand these read as bulbous packed sacs. */
function makeCalyxGeom(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, CALYX_DETAIL);
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Smooth sphere normal captured BEFORE the deform — organic, no facets.
    n.copy(v).normalize();
    const y = v.y; // -1..1
    // Bulge the equator (fat sac), tuck the very bottom, round the top to a soft
    // point (teardrop). All smooth — no creases.
    const equator = 1 + 0.12 * Math.cos(y * Math.PI * 0.5);
    v.x *= equator;
    v.z *= equator;
    if (y > 0) {
      const taper = 1 - 0.34 * y * y; // narrow gently toward the tip
      v.x *= taper;
      v.z *= taper;
      v.y = y * 1.16; // a touch elongated = teardrop, not a ball
    } else {
      v.y = y * 0.94; // slightly tucked base
    }
    pos.setXYZ(i, v.x, v.y, v.z);
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  pos.needsUpdate = true;
  nrm.needsUpdate = true;
  return geo;
}

/** A single low-poly curling pistil strand along +Y, base at origin, ~1 tall. */
function makePistilGeom(): THREE.BufferGeometry {
  const N = 6;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const bend = 0.16 * Math.sin(t * Math.PI * 0.85) + 0.06 * t * t;
    pts.push(new THREE.Vector3(bend, t, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tubular = 3, radial = 3;
  const geo = new THREE.TubeGeometry(curve, tubular, 0.13, radial, false);
  const pos = geo.attributes.position;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, c);
    const taper = Math.max(0.05, 1 - 0.95 * t);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx);
      v.sub(c).multiplyScalar(taper).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/** Narrow serrated sugar-leaf blade in the XY plane pointing +Y. */
function makeSugarLeafGeom(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 1.0);
  s.lineTo(0.12, 0.66);
  s.lineTo(0.06, 0.58);
  s.lineTo(0.2, 0.34);
  s.lineTo(0.09, 0.0);
  s.lineTo(-0.09, 0.0);
  s.lineTo(-0.2, 0.34);
  s.lineTo(-0.06, 0.58);
  s.lineTo(-0.12, 0.66);
  s.lineTo(0, 1.0);
  const g = new THREE.ShapeGeometry(s);
  g.computeVertexNormals();
  return g;
}

/** Merge several ShapeGeometries into one non-indexed geometry (fan leaf). */
function makeFanLeafGeom(leaflets: number, seed: number): THREE.BufferGeometry {
  const outlines = buildFanLeafOutlines(leaflets, seed);
  const positions: number[] = [];
  for (const { outline } of outlines) {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ShapeGeometry(shape).toNonIndexed();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) positions.push(p.getX(i), p.getY(i), p.getZ(i));
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.computeVertexNormals();
  return merged;
}

// ---- per-cola transform --------------------------------------------------

/** World quaternion aligning unit-UP to a cola's growth axis. */
function colaQuat(axis: Vec3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(axis[0], axis[1], axis[2]).normalize());
}

// ---- layer components ----------------------------------------------------

function Stems({ assembly, stemColor }: { assembly: PlantAssembly; stemColor: THREE.Color }) {
  const geoms = useMemo(() => {
    const { skeleton } = assembly;
    const list: THREE.BufferGeometry[] = [];
    // Main stalk.
    list.push(
      taperedTube(
        skeleton.stem.map((s) => s.pos),
        skeleton.stem.map((s) => s.radius),
        8,
      ),
    );
    // Branches.
    for (const b of skeleton.branches) {
      const radii = b.path.map((_, i) => b.radius * (1 - 0.7 * (i / (b.path.length - 1))));
      list.push(taperedTube(b.path, radii, 5));
    }
    return list;
  }, [assembly]);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: stemColor, roughness: 0.66, metalness: 0.0 }),
    [stemColor],
  );
  return (
    <>
      {geoms.map((g, i) => (
        <mesh key={i} geometry={g} material={mat} />
      ))}
    </>
  );
}

function NodeRings({ assembly, stemColor }: { assembly: PlantAssembly; stemColor: THREE.Color }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => new THREE.SphereGeometry(1, 6, 4), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: stemColor.clone().multiplyScalar(0.8), roughness: 0.7 }),
    [stemColor],
  );
  const nodes = assembly.skeleton.nodes;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    nodes.forEach((n, i) => {
      d.position.set(n.pos[0], n.pos[1], n.pos[2]);
      d.scale.set(n.radius * 1.5, n.radius * 0.9, n.radius * 1.5);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [nodes]);
  return <instancedMesh key={nodes.length} ref={ref} args={[geom, mat, nodes.length]} />;
}

function ColaCores({ assembly, coreColor }: { assembly: PlantAssembly; coreColor: THREE.Color }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(makeColaCoreGeom, []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: coreColor, roughness: 0.85, metalness: 0.0 }),
    [coreColor],
  );
  const colas = assembly.colas;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const qWorld = new THREE.Quaternion();
    colas.forEach((c, i) => {
      qWorld.copy(colaQuat(c.axis));
      d.position.set(c.origin[0], c.origin[1], c.origin[2]);
      d.quaternion.copy(qWorld);
      d.scale.set(c.width, c.height, c.width);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [colas]);
  return <instancedMesh key={colas.length} ref={ref} args={[geom, mat, colas.length]} />;
}

/** Frosted-calyx tint target — a pale silver-teal the calyx albedo lerps toward
 * as trichome caking builds up the cola (Blue Dream = blue-teal bud under a
 * silver resin coat). Kept data-driven: the lerp AMOUNT comes from the strain's
 * trichomeDensity, not a hardcoded recolour. */
const FROST_TINT = new THREE.Color(0.74, 0.84, 0.86);

function Calyxes({ assembly, frost }: { assembly: PlantAssembly; frost: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(makeCalyxGeom, []);
  // Waxy, low-plastic calyx skin with a hint of translucency read via a soft
  // emissive floor (cheap subsurface-ish softness in the crevices).
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.58,
        metalness: 0.0,
        emissive: new THREE.Color(0.02, 0.05, 0.05),
      }),
    [],
  );
  const total = useMemo(() => assembly.colas.reduce((n, c) => n + c.cola.length, 0), [assembly]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    const qWorld = new THREE.Quaternion();
    const qLocal = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const lp = new THREE.Vector3();
    let idx = 0;
    for (const c of assembly.colas) {
      qWorld.copy(colaQuat(c.axis));
      const origin = new THREE.Vector3(c.origin[0], c.origin[1], c.origin[2]);
      for (const ins of c.cola) {
        lp.set(ins.pos[0] * c.width, ins.pos[1] * c.height, ins.pos[2] * c.width);
        lp.applyQuaternion(qWorld).add(origin);
        // Local calyx attitude (tip outward + up), then rotate into the cola frame.
        dir.set(ins.pos[0], 0.65, ins.pos[2]).normalize();
        qLocal.setFromUnitVectors(UP, dir);
        const q = qWorld.clone().multiply(qLocal);
        const rz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ins.rot[2] * 0.4);
        q.multiply(rz);
        d.position.copy(lp);
        d.quaternion.copy(q);
        const s = c.width * 1.65;
        d.scale.set(ins.scale[0] * s, ins.scale[1] * s * 1.15, ins.scale[2] * s);
        d.updateMatrix();
        mesh.setMatrixAt(idx, d.matrix);
        // Frost the calyx albedo toward silver — heavier up the cola (where resin
        // cakes thickest), lighter at the leafy skirt — so the whole flower reads
        // coated, not just where a discrete gland happens to sit.
        const hf = Math.min(1, Math.max(0, ins.pos[1]));
        const amt = Math.min(0.9, frost * (0.28 + 0.72 * hf));
        col.setRGB(ins.color[0], ins.color[1], ins.color[2]).lerp(FROST_TINT, amt);
        mesh.setColorAt(idx, col);
        idx++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [assembly, frost]);
  return <instancedMesh key={total} ref={ref} args={[geom, mat, total]} />;
}

function Pistils({ assembly }: { assembly: PlantAssembly }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(makePistilGeom, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.0 }), []);
  const total = useMemo(() => assembly.colas.reduce((n, c) => n + c.pistils.length, 0), [assembly]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || total === 0) return;
    const d = new THREE.Object3D();
    const qWorld = new THREE.Quaternion();
    const qLocal = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const lp = new THREE.Vector3();
    const col = new THREE.Color();
    let idx = 0;
    for (const c of assembly.colas) {
      qWorld.copy(colaQuat(c.axis));
      const origin = new THREE.Vector3(c.origin[0], c.origin[1], c.origin[2]);
      for (const p of c.pistils) {
        lp.set(p.pos[0] * c.width, p.pos[1] * c.height, p.pos[2] * c.width);
        lp.applyQuaternion(qWorld).add(origin);
        dir.set(p.dir[0], p.dir[1], p.dir[2]).normalize();
        qLocal.setFromUnitVectors(UP, dir);
        const q = qWorld.clone().multiply(qLocal);
        const roll = new THREE.Quaternion().setFromAxisAngle(UP, p.roll);
        q.multiply(roll);
        d.position.copy(lp);
        d.quaternion.copy(q);
        d.scale.setScalar(p.len * c.width * 1.8);
        d.updateMatrix();
        mesh.setMatrixAt(idx, d.matrix);
        mesh.setColorAt(idx, col.setRGB(p.color[0], p.color[1], p.color[2]));
        idx++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [assembly, total]);
  return total ? <instancedMesh key={`p${total}`} ref={ref} args={[geom, mat, total]} /> : null;
}

function SugarLeaves({ assembly }: { assembly: PlantAssembly }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(makeSugarLeafGeom, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.5,
        metalness: 0.04,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0.03, 0.05, 0.03),
      }),
    [],
  );
  const total = useMemo(() => assembly.colas.reduce((n, c) => n + c.sugar.length, 0), [assembly]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || total === 0) return;
    const d = new THREE.Object3D();
    const qWorld = new THREE.Quaternion();
    const qLocal = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const lp = new THREE.Vector3();
    const col = new THREE.Color();
    let idx = 0;
    for (const c of assembly.colas) {
      qWorld.copy(colaQuat(c.axis));
      const origin = new THREE.Vector3(c.origin[0], c.origin[1], c.origin[2]);
      for (const leaf of c.sugar) {
        lp.set(leaf.pos[0] * c.width, leaf.pos[1] * c.height, leaf.pos[2] * c.width);
        lp.applyQuaternion(qWorld).add(origin);
        dir.set(leaf.dir[0], leaf.dir[1], leaf.dir[2]).normalize();
        qLocal.setFromUnitVectors(UP, dir);
        const q = qWorld.clone().multiply(qLocal);
        const roll = new THREE.Quaternion().setFromAxisAngle(UP, leaf.roll);
        q.multiply(roll);
        d.position.copy(lp);
        d.quaternion.copy(q);
        d.scale.setScalar(leaf.scale * c.width * 2.4);
        d.updateMatrix();
        mesh.setMatrixAt(idx, d.matrix);
        mesh.setColorAt(idx, col.setRGB(leaf.color[0], leaf.color[1], leaf.color[2]));
        idx++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [assembly, total]);
  return total ? <instancedMesh key={`s${total}`} ref={ref} args={[geom, mat, total]} /> : null;
}

function FanLeaves({ assembly, seed }: { assembly: PlantAssembly; seed: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => makeFanLeafGeom(9, seed), [seed]);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.52,
        metalness: 0.02,
        side: THREE.DoubleSide,
        // Faint waxy sheen so the fan leaves catch the key light like the ref.
        emissive: new THREE.Color(0.01, 0.03, 0.02),
      }),
    [],
  );
  const leaves = assembly.leaves;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const qWorld = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const col = new THREE.Color();
    leaves.forEach((leaf, i) => {
      d.position.set(leaf.pos[0], leaf.pos[1], leaf.pos[2]);
      dir.set(leaf.dir[0], leaf.dir[1], leaf.dir[2]).normalize();
      qWorld.setFromUnitVectors(UP, dir);
      const yaw = new THREE.Quaternion().setFromAxisAngle(UP, leaf.roll + leaf.yaw);
      const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), leaf.pitch);
      qWorld.multiply(yaw).multiply(pitch);
      d.quaternion.copy(qWorld);
      d.scale.setScalar(leaf.scale);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, col.setRGB(leaf.color[0], leaf.color[1], leaf.color[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [leaves]);
  return <instancedMesh key={leaves.length} ref={ref} args={[geom, mat, leaves.length]} />;
}

/** Dev-studio only: publish the last-frame rendered triangle count so the tri
 * budget stays visible while tuning (read by the studio HUD / screenshot loop). */
function TriProbe() {
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    if (typeof window === "undefined") return;
    let tris = 0;
    scene.traverse((o) => {
      const m = o as THREE.Mesh & { isMesh?: boolean; isInstancedMesh?: boolean; count?: number };
      if (!m.isMesh || !m.geometry) return;
      const g = m.geometry as THREE.BufferGeometry;
      const verts = g.index ? g.index.count : g.attributes.position.count;
      const inst = m.isInstancedMesh ? (m.count ?? 0) : 1;
      tris += (verts / 3) * inst;
    });
    (window as unknown as { __triCount?: number }).__triCount = Math.round(tris);
  });
  return null;
}

function PlantScene({
  dna,
  sil,
  seed,
  lod,
  spin,
}: {
  dna: BudDNA;
  sil: Silhouette;
  seed: number;
  lod: LODLevel;
  spin: boolean;
}) {
  const assembly = useMemo(
    // ripe ~0.25 keeps the frost silvery-white (mostly clear/cloudy, little
    // amber) while the pistils still warm toward orange — the Blue Dream look.
    () => buildPlantAssembly(dna, sil, seed, { lod, ripe: 0.28, trich: 1 }),
    [dna, sil, seed, lod],
  );
  const stemColor = useMemo(() => {
    // A semi-waxy plant green derived from the strain palette (kept saturated,
    // a touch darker than the calyxes so the skeleton reads under the buds).
    const [r, g, b] = hslToRgb({ hue: 96, sat: 46, lit: 30 });
    return new THREE.Color(r, g, b);
  }, []);
  const coreColor = useMemo(() => {
    // A PALE silvery-teal frosted-bud body. Where it peeks through the calyxes
    // (especially the tapering spear tip) it reads as dense frosted flower, not
    // a bare cone — the calyxes + frost then just add texture on top.
    const [r, g, b] = hslToRgb({ hue: 162, sat: 24, lit: 47 });
    return new THREE.Color(r, g, b);
  }, []);
  const yOffset = -assembly.skeleton.height * 0.5;
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin && groupRef.current) groupRef.current.rotation.y += dt * 0.25;
  });
  return (
    <group ref={groupRef}>
      <group position={[0, yOffset, 0]}>
        <Stems assembly={assembly} stemColor={stemColor} />
        <NodeRings assembly={assembly} stemColor={stemColor} />
        <FanLeaves assembly={assembly} seed={seed} />
        <ColaCores assembly={assembly} coreColor={coreColor} />
        <Calyxes assembly={assembly} frost={dna.trichomeDensity} />
        <SugarLeaves assembly={assembly} />
        <Pistils assembly={assembly} />
        <TrichomeLayer assembly={assembly} lod={lod} />
      </group>
      <ContactShadows
        position={[0, yOffset, 0]}
        scale={assembly.skeleton.height * 1.4}
        blur={2.4}
        far={assembly.skeleton.height}
        opacity={0.35}
        resolution={1024}
      />
    </group>
  );
}

export function PlantGL({
  dna,
  sil,
  seed,
  lod = "close",
  reducedMotion = false,
  cameraTight = false,
}: {
  dna: BudDNA;
  sil: Silhouette;
  seed: number;
  lod?: LODLevel;
  reducedMotion?: boolean;
  /** Tighten the camera onto the main spear (close-up preview). */
  cameraTight?: boolean;
}) {
  const spin = !reducedMotion;
  const dist = cameraTight ? 2.3 : 9.6;
  const camY = cameraTight ? 1.5 : 0.3;
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, camY, dist], fov: 32 }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <color attach="background" args={["#d9dbdd"]} />
        {/* Soft 3-point studio lighting + ambient (neutral, no colour cast). */}
        <ambientLight intensity={0.62} />
        <directionalLight position={[3, 6, 4]} intensity={1.5} color="#fff8ef" castShadow />
        <directionalLight position={[-4, 2, 2]} intensity={0.5} color="#eaf4ff" />
        <directionalLight position={[0, 3, -5]} intensity={0.7} color="#ffffff" />
        <PlantScene dna={dna} sil={sil} seed={seed} lod={lod} spin={spin} />
        <TriProbe />
        <OrbitControls
          enablePan={false}
          target={[0, cameraTight ? 1.45 : 0.35, 0]}
          minDistance={1.6}
          maxDistance={11}
        />
      </Canvas>
    </div>
  );
}
