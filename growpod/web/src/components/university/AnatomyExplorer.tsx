"use client";

// Phase 3 — 3D Anatomy Explorer renderer (university).
//
// A zoomable, orbitable bud rendered from the SHIPPED pure bud3d generators via
// buildExplorerInstances() — three InstancedMeshes (calyxes / frost / pistils),
// so the whole bud is a fixed 3 draw calls however many glands grow. This is a
// RENDERER ONLY: no genetics/geometry logic lives here (it mirrors the proven
// BudGL wiring). The teaching layer on top — LOD tiers (zoom→tier) and part
// picking (hover→label) — reads from the same pure module. Sliders land next.
// Must load via dynamic({ ssr: false }).

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { FrostMat } from "@/lib/chamber/bud3d/detail";
import { budDnaFor, type BudDNA } from "@/lib/chamber/budDna";
import { budColorFor } from "@/lib/chamber/morphology";
import {
  buildExplorerInstances,
  tierForDistance,
  TIER_INFO,
  PART_LABELS,
  DEFAULT_PARAMS,
  type AnatomyPart,
  type ExplorerInstances,
  type ExplorerParams,
  type Tier,
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

/** Pointer handlers that report which anatomy part is under the cursor. */
type HoverProps = { onHover: (p: AnatomyPart | null) => void };

function hoverHandlers(part: AnatomyPart, onHover: HoverProps["onHover"]) {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(part); },
    onPointerOut: () => onHover(null),
  };
}

function Calyxes({ cola, onHover }: { cola: ExplorerInstances["cola"] } & HoverProps) {
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
  return <instancedMesh key={cola.length} ref={ref} args={[geom, mat, cola.length]} {...hoverHandlers("calyx", onHover)} />;
}

function Frost({ instances, purple, onHover }: { instances: ExplorerInstances["frost"]; purple: number } & HoverProps) {
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
  return instances.length ? <instancedMesh key={`f${instances.length}`} ref={ref} args={[geom, mat, instances.length]} {...hoverHandlers("trichome", onHover)} /> : null;
}

function Pistils({ instances, onHover }: { instances: ExplorerInstances["pistils"] } & HoverProps) {
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
  return instances.length ? <instancedMesh key={`p${instances.length}`} ref={ref} args={[geom, mat, instances.length]} {...hoverHandlers("pistil", onHover)} /> : null;
}

/** Reads the camera distance each frame and reports the current LOD tier. */
function TierWatcher({ onTier }: { onTier: (t: Tier) => void }) {
  const camera = useThree((s) => s.camera);
  const last = useRef<Tier | null>(null);
  useFrame(() => {
    const t = tierForDistance(camera.position.length()); // OrbitControls target ≈ origin
    if (t !== last.current) { last.current = t; onTier(t); }
  });
  return null;
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

/** Bottom-left readout: the current LOD tier, and the part under the cursor.
 * Lives outside the Canvas (plain DOM) so it's selectable + screen-reader visible;
 * pointer-events off so it never steals an orbit drag. */
function ExplorerOverlay({ tier, hovered }: { tier: Tier; hovered: AnatomyPart | null }) {
  const info = TIER_INFO[tier];
  const part = hovered ? PART_LABELS[hovered] : null;
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-xs rounded-lg bg-ink-900/75 px-3 py-2 backdrop-blur-sm" aria-live="polite">
        <p className="instrument-label text-accent-300">TIER · {info.title}</p>
        <p className="mt-0.5 text-xs text-gray-300">{info.blurb}</p>
      </div>
      {part && (
        <div className="max-w-xs rounded-lg border border-grow-600/50 bg-grow-950/80 px-3 py-2 backdrop-blur-sm" aria-live="polite">
          <p className="font-semibold text-grow-200">{part.title}</p>
          <p className="mt-0.5 text-xs text-gray-300">{part.blurb}</p>
        </div>
      )}
    </div>
  );
}

/**
 * The 3D Anatomy Explorer. Genetics + params flow through the pure generator;
 * everything below is presentation. Orbit/zoom via OrbitControls, whose zoom
 * distance drives the LOD tier readout; hovering a part surfaces its label.
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
  const [tier, setTier] = useState<Tier>("whole");
  const [hovered, setHovered] = useState<AnatomyPart | null>(null);

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.05, 1.9], fov: 35 }}
        frameloop={reducedMotion ? "demand" : "always"}
        onPointerMissed={() => setHovered(null)}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 4, 3]} intensity={1.4} color="#fff6e8" />
        <pointLight position={[-2, 1, 2]} intensity={18} distance={9} color="#6cf0ff" />
        <TierWatcher onTier={setTier} />
        <Calyxes cola={inst.cola} onHover={setHovered} />
        <Pistils instances={inst.pistils} onHover={setHovered} />
        <Frost instances={inst.frost} purple={params.purple} onHover={setHovered} />
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
      <ExplorerOverlay tier={tier} hovered={hovered} />
    </div>
  );
}
