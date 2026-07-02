"use client";

// Capitate-stalked trichome layer — the silvery resin COAT that cakes a ripe
// cola (owner's #1 realism gap; replaces the old scattered octahedron "crystals").
//
// A real cannabis trichome is a capitate-stalked gland: a thin translucent STALK
// with a bulbous resin GLAND head on top. We render each as one merged low-poly
// micro-mesh (stalk cylinder + smooth-normal gland ball), instanced once per draw
// call, standing UP along the calyx surface normal and jittered per-instance
// (height, tilt, scale, sparkle) so the field reads as an organic frosting, not a
// crystal lattice. Glands are individually addressable (instance index == gland
// id) so the future "Trichome Rush" minigame can glow / tap / count them.
//
// LOD:
//   close — real stalk+gland geometry (this is what earns the caked-resin look).
//   mid   — gland heads only (stalks dropped) — cheaper sparkle highlights.
//   far   — nothing here (assembly emits zero frost at far; shader frost only).
//
// Deterministic: consumes the seeded FrostInstance field from buildFrost, so the
// coat never drifts from the cola. Pure three.js wiring — no DOM, no app state.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { LODLevel, PlantAssembly } from "@/lib/plant3d/assembly";
import type { FrostMat } from "@/lib/chamber/bud3d/detail";

const UP = new THREE.Vector3(0, 1, 0);

/** Resin-head base colour by maturity (mirrors trichomes.ts trichHeadColor). */
function frostColor(mat: FrostMat): THREE.Color {
  if (mat === 0) return new THREE.Color(0.88, 0.95, 1.0); // clear — blue-white
  if (mat === 1) return new THREE.Color(0.97, 0.98, 0.955); // cloudy — milky white
  return new THREE.Color(0.9, 0.74, 0.45); // amber — warm cream/gold
}

/** Merge child geometries (position + smooth normal) into one non-indexed mesh. */
function concatGeom(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const posArr: number[] = [];
  const nrmArr: number[] = [];
  for (const g of parts) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      posArr.push(p.getX(i), p.getY(i), p.getZ(i));
      nrmArr.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrmArr, 3));
  return geo;
}

/** A smooth-normal resin gland ball (octahedron shaded radially — a bead, not a
 * crystal), sized `r`, centred at height `y`. ~8 tris. */
function glandGeom(r: number, y: number): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(r, 0).toNonIndexed();
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize(); // radial => smooth, no facets
    n.setXYZ(i, v.x, v.y, v.z);
  }
  g.translate(0, y, 0);
  return g;
}

/** Capitate stalk + gland (~14 tris). Unit height ≈ 1, base at y=0. The gland is
 * fat relative to the stalk so a field of them reads as a caked resin bead-coat. */
function makeCapitateGeom(): THREE.BufferGeometry {
  const stalk = new THREE.CylinderGeometry(0.09, 0.13, 0.52, 3, 1, true).toNonIndexed();
  stalk.translate(0, 0.26, 0);
  stalk.computeVertexNormals();
  return concatGeom([stalk, glandGeom(0.5, 0.62)]);
}

/** Gland head only (mid LOD) — no stalk. ~8 tris. */
function makeGlandOnlyGeom(): THREE.BufferGeometry {
  return concatGeom([glandGeom(0.55, 0)]);
}

const UPv = new THREE.Vector3(0, 1, 0);

/** World quaternion aligning unit-UP to a cola's growth axis (mirrors PlantGL). */
function colaQuat(axis: [number, number, number]): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(
    UPv,
    new THREE.Vector3(axis[0], axis[1], axis[2]).normalize(),
  );
}

export function TrichomeLayer({ assembly, lod }: { assembly: PlantAssembly; lod: LODLevel }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => (lod === "close" ? makeCapitateGeom() : makeGlandOnlyGeom()), [lod]);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // Translucent silvery resin: low roughness so it catches the key light as
        // wet sparkle, a hair of emissive so the coat never goes muddy in shadow.
        roughness: 0.16,
        metalness: 0.0,
        transparent: true,
        opacity: 0.96,
        // A brighter emissive floor so the glands glint as wet resin points even
        // in shadow — the crystalline sparkle over the silvery coat.
        emissive: new THREE.Color(0.22, 0.27, 0.30),
        emissiveIntensity: 0.9,
        depthWrite: true,
      }),
    [],
  );
  const total = useMemo(() => assembly.colas.reduce((n, c) => n + c.frost.length, 0), [assembly]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || total === 0) return;
    const d = new THREE.Object3D();
    const qWorld = new THREE.Quaternion();
    const qLocal = new THREE.Quaternion();
    const lp = new THREE.Vector3();
    const wn = new THREE.Vector3();
    const col = new THREE.Color();
    let idx = 0;
    for (const c of assembly.colas) {
      qWorld.copy(colaQuat(c.axis));
      const origin = new THREE.Vector3(c.origin[0], c.origin[1], c.origin[2]);
      for (const g of c.frost) {
        lp.set(g.pos[0] * c.width, g.pos[1] * c.height, g.pos[2] * c.width);
        lp.applyQuaternion(qWorld).add(origin);
        // Stand the trichome UP along the calyx surface normal (rotated to world).
        wn.set(g.nrm[0], g.nrm[1], g.nrm[2]).applyQuaternion(qWorld).normalize();
        qLocal.setFromUnitVectors(UP, wn);
        // Per-gland tilt jitter so the coat looks grown, not combed.
        const tilt = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          (g.spark - 0.5) * 0.9,
        );
        qLocal.multiply(tilt);
        d.position.copy(lp);
        d.quaternion.copy(qLocal);
        // Scale: gland size × cola width, with per-instance jitter; stalks stand a
        // touch taller than they are wide so they read as columns of resin.
        const s = g.r * c.width * (lod === "close" ? 5.0 : 5.6) * (0.8 + 0.6 * g.spark);
        d.scale.set(s, s * (lod === "close" ? 1.3 : 1.0), s);
        d.updateMatrix();
        mesh.setMatrixAt(idx, d.matrix);
        // Sparkle: keep glands bright (near-white) so they read as crystal frost
        // against the teal calyx, with a wide brightness spread for granular glint.
        col.copy(frostColor(g.mat)).multiplyScalar(0.85 + 0.5 * g.spark);
        mesh.setColorAt(idx, col);
        idx++;
      }
    }
    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [assembly, total, lod]);

  return total ? <instancedMesh key={`tri${total}${lod}`} ref={ref} args={[geom, mat, total]} /> : null;
}
