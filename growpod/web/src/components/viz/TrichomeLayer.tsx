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
import { makeCapitateGeom, makeGlandOnlyGeom, trichomeHeadColor as frostColor } from "@/components/viz/trichomeGeometry";

const UP = new THREE.Vector3(0, 1, 0);
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
