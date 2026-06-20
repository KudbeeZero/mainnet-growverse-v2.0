"use client";

// Phase 1a+1b — WebGL/3D bud renderer (macro view).
//
// One genetics-driven 3D bud: teardrop calyxes accreted up a phyllotaxic spiral
// (cola.ts), with pistils ("hairs") and trichome frost grown from them
// (detail.ts). Maturity colour reuses the Engine-7 model so frost reads ripeness.
// Three instanced meshes = three draw calls. Must load via dynamic({ssr:false}).

import { Canvas, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildCola } from "@/lib/chamber/bud3d/cola";
import { buildFrost, buildPistils, type FrostMat } from "@/lib/chamber/bud3d/detail";
import type { BudDNA } from "@/lib/chamber/budDna";

const Y_CENTER = -0.5; // cola spans y≈0..1 in unit space; centre it on the origin
const UP = new THREE.Vector3(0, 1, 0);

/** Frost head colour by maturity (mirrors trichomes.ts trichHeadColor), with an
 * optional lavender tint for purple phenos. Returns a THREE.Color. */
function frostColor(mat: FrostMat, purple: number): THREE.Color {
  let r: number, g: number, b: number;
  if (mat === 0) { r = 224; g = 242; b = 255; }          // clear / blue-white
  else if (mat === 1) { r = 248; g = 250; b = 244; }     // cloudy / milky
  else return new THREE.Color(228 / 255, 188 / 255, 110 / 255); // amber (no tint)
  const t = Math.min(1, Math.max(0, purple)) * 0.35;
  r = r + (198 - r) * t; g = g + (178 - g) * t; b = b + (232 - b) * t;
  return new THREE.Color(r / 255, g / 255, b / 255);
}

/** A teardrop calyx: bulbous swollen base tapering to a pointed tip (lathed). */
function useCalyxGeometry() {
  return useMemo(() => {
    const profile = [
      [0.0, -0.5], [0.28, -0.42], [0.42, -0.3], [0.5, -0.15],
      [0.46, 0.0], [0.36, 0.16], [0.22, 0.3], [0.1, 0.42], [0.0, 0.5],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(profile, 10);
  }, []);
}

function Calyxes({ cola, spin }: { cola: ReturnType<typeof buildCola>; spin: boolean }) {
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
    cola.forEach((ins, i) => {
      d.position.set(ins.pos[0], ins.pos[1] + Y_CENTER, ins.pos[2]);
      d.scale.set(ins.scale[0], ins.scale[1], ins.scale[2]);
      // Point the teardrop tip outward from the stem + up (natural calyx attitude);
      // ins.rot adds a little per-calyx jitter so they aren't perfectly radial.
      dir.set(ins.pos[0], 0.65, ins.pos[2]).normalize();
      q.setFromUnitVectors(UP, dir);
      d.quaternion.copy(q);
      d.rotateY(ins.rot[1]);
      d.rotateZ(ins.rot[2] * 0.4);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, col.setRGB(ins.color[0], ins.color[1], ins.color[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cola, geom]);
  useFrame((_, dt) => { if (spin && ref.current) ref.current.rotation.y += dt * 0.32; });
  return <instancedMesh key={cola.length} ref={ref} args={[geom, mat, cola.length]} />;
}

function Frost({
  instances, purple, spin,
}: { instances: ReturnType<typeof buildFrost>; purple: number; spin: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  // Low roughness + faint emissive so glands catch the light like wet resin.
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0.1, emissive: new THREE.Color(0.05, 0.07, 0.08), transparent: true, opacity: 0.92 }),
    [],
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    instances.forEach((g, i) => {
      d.position.set(g.pos[0], g.pos[1] + Y_CENTER, g.pos[2]);
      d.scale.setScalar(g.r);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, frostColor(g.mat, purple));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [instances, purple]);
  useFrame((_, dt) => { if (spin && ref.current) ref.current.rotation.y += dt * 0.32; });
  return instances.length ? <instancedMesh key={`f${instances.length}`} ref={ref} args={[geom, mat, instances.length]} /> : null;
}

function Pistils({
  instances, spin,
}: { instances: ReturnType<typeof buildPistils>; spin: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  // Thin tapered strand along +Y, base at the origin (translate so it grows out).
  const geom = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.18, 0.5, 1, 5, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.0 }), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const q = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const col = new THREE.Color();
    instances.forEach((p, i) => {
      d.position.set(p.pos[0], p.pos[1] + Y_CENTER, p.pos[2]);
      dir.set(p.dir[0], p.dir[1], p.dir[2]).normalize();
      q.setFromUnitVectors(UP, dir);
      d.quaternion.copy(q);
      d.scale.set(0.02, p.len, 0.02);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, col.setRGB(p.color[0], p.color[1], p.color[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [instances]);
  useFrame((_, dt) => { if (spin && ref.current) ref.current.rotation.y += dt * 0.32; });
  return instances.length ? <instancedMesh key={`p${instances.length}`} ref={ref} args={[geom, mat, instances.length]} /> : null;
}

export function BudGL({
  dna, seed, budDev, ripe = 0, brown = 0, trich = 0, purple = 0, reducedMotion = false,
}: {
  dna: BudDNA;
  seed: number;
  /** 0..1 bud development (accretion + swell). */
  budDev: number;
  /** 0..1 ripeness (frost maturity + pistil amber). */
  ripe?: number;
  /** 0..1 browning (pistils brown + curl). */
  brown?: number;
  /** 0..1 frost amount (× dna.trichomeDensity). */
  trich?: number;
  /** 0..1 purple/anthocyanin (lavender frost + magenta pistils). */
  purple?: number;
  reducedMotion?: boolean;
}) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const cola = useMemo(() => buildCola(dna, seed, { budDev }), [dna, seed, budDev]);
  const frost = useMemo(
    () => buildFrost(cola, { seed, density: dna.trichomeDensity * trich, ripe, amberBias: purple * 0.4, isMobile }),
    [cola, seed, dna.trichomeDensity, trich, ripe, purple, isMobile],
  );
  const pistils = useMemo(
    () => buildPistils(cola, { seed, chance: dna.pistilChance, ripe, brown, magenta: purple, isMobile }),
    [cola, seed, dna.pistilChance, ripe, brown, purple, isMobile],
  );
  const spin = !reducedMotion;

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.05, 1.9], fov: 35 }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 4, 3]} intensity={1.4} color="#fff6e8" />
        <pointLight position={[-2, 1, 2]} intensity={18} distance={9} color="#6cf0ff" />
        <Calyxes cola={cola} spin={spin} />
        <Pistils instances={pistils} spin={spin} />
        <Frost instances={frost} purple={purple} spin={spin} />
      </Canvas>
    </div>
  );
}
