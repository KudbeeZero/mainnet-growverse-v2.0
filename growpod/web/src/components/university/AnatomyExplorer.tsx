"use client";

// Phase 3 — 3D Anatomy Explorer renderer (university).
//
// A zoomable, orbitable bud rendered from the SHIPPED pure bud3d generators via
// buildExplorerInstances() — three InstancedMeshes (calyxes / frost / pistils),
// so the whole bud is a fixed 3 draw calls however many glands grow. This is a
// RENDERER ONLY: no genetics/geometry logic lives here (it mirrors the proven
// BudGL wiring); the teaching layer (LOD tiers, part picking, sliders) builds on
// top in later commits. Must load via dynamic({ ssr: false }).

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { FrostMat } from "@/lib/chamber/bud3d/detail";
import { budDnaFor, type BudDNA } from "@/lib/chamber/budDna";
import { budColorFor } from "@/lib/chamber/morphology";
import {
  buildExplorerInstances,
  DEFAULT_PARAMS,
  type ExplorerInstances,
  type ExplorerParams,
} from "@/lib/chamber3d/explorer/parts";

const Y_CENTER = -0.5; // cola spans y≈0..1 in unit space; centre it on the origin
const UP = new THREE.Vector3(0, 1, 0);

/** Frost head colour by maturity (mirrors BudGL.frostColor), with an optional
 * lavender tint for purple phenos. */
function frostColor(mat: FrostMat, purple: number): THREE.Color {
  let r: number, g: number, b: number;
  if (mat === 0) { r = 224; g = 242; b = 255; }
  else if (mat === 1) { r = 248; g = 250; b = 244; }
  else return new THREE.Color(228 / 255, 188 / 255, 110 / 255);
  const t = Math.min(1, Math.max(0, purple)) * 0.35;
  r = r + (198 - r) * t; g = g + (178 - g) * t; b = b + (232 - b) * t;
  return new THREE.Color(r / 255, g / 255, b / 255);
}

/** RIBBED teardrop calyx (bulbous base → pointed tip, radially fluted). */
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

function Calyxes({ cola }: { cola: ExplorerInstances["cola"] }) {
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
  return <instancedMesh key={cola.length} ref={ref} args={[geom, mat, cola.length]} />;
}

function Frost({ instances, purple }: { instances: ExplorerInstances["frost"]; purple: number }) {
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
  return instances.length ? <instancedMesh key={`f${instances.length}`} ref={ref} args={[geom, mat, instances.length]} /> : null;
}

function Pistils({ instances }: { instances: ExplorerInstances["pistils"] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
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
  return instances.length ? <instancedMesh key={`p${instances.length}`} ref={ref} args={[geom, mat, instances.length]} /> : null;
}

export interface AnatomyExplorerProps {
  /** Genetics to render. Defaults to a representative stylized-botanical bud. */
  dna?: BudDNA;
  /** Deterministic seed — same seed → identical bud. */
  seed?: number;
  /** 0..1 grow params (bud dev / ripeness / browning / frost / purple). */
  params?: ExplorerParams;
  /** Honour prefers-reduced-motion: no auto-orbit, render on demand. */
  reducedMotion?: boolean;
}

const DEFAULT_SEED = 4242;
function defaultDna(): BudDNA {
  return budDnaFor(undefined, budColorFor(DEFAULT_SEED, 0.28));
}

/**
 * The 3D Anatomy Explorer canvas. Genetics + params flow through the pure
 * generator; everything below is presentation. Orbit/zoom via OrbitControls
 * (zoom range will drive LOD tiers in a later commit).
 */
export function AnatomyExplorer({
  dna,
  seed = DEFAULT_SEED,
  params = DEFAULT_PARAMS,
  reducedMotion = false,
}: AnatomyExplorerProps) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const budDna = useMemo(() => dna ?? defaultDna(), [dna]);
  const inst = useMemo(
    () => buildExplorerInstances(budDna, seed, { ...params, isMobile }),
    [budDna, seed, params, isMobile],
  );

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.05, 1.9], fov: 35 }}
      frameloop={reducedMotion ? "demand" : "always"}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 4, 3]} intensity={1.4} color="#fff6e8" />
      <pointLight position={[-2, 1, 2]} intensity={18} distance={9} color="#6cf0ff" />
      <Calyxes cola={inst.cola} />
      <Pistils instances={inst.pistils} />
      <Frost instances={inst.frost} purple={params.purple} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.6}
        maxDistance={3.2}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.6}
      />
    </Canvas>
  );
}
