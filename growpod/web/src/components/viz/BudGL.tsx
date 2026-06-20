"use client";

// Phase 1a — WebGL/3D bud renderer (macro view).
//
// A real 3D cola built from instanced calyx ellipsoids (one draw call), driven by
// the SAME genetics (`BudDNA`) as the Canvas engine. This replaces the flat,
// "fabric-like" 2D macro blob with a lit, volumetric bud you can see depth in.
// Pistils + trichome frost (1b) and the whole-plant chamber view (1d) build on
// this. Must be loaded via next/dynamic({ ssr:false }) — three.js needs `window`.

import { Canvas, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildCola } from "@/lib/chamber/bud3d/cola";
import type { BudDNA } from "@/lib/chamber/budDna";

function Cola({ dna, seed, budDev, spin }: { dna: BudDNA; seed: number; budDev: number; spin: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const instances = useMemo(() => buildCola(dna, seed, { budDev }), [dna, seed, budDev]);
  // A low-poly ellipsoid base; per-instance scale makes the teardrop calyx.
  const geom = useMemo(() => new THREE.IcosahedronGeometry(0.5, 2), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.0 }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < instances.length; i++) {
      const ins = instances[i];
      dummy.position.set(ins.pos[0], ins.pos[1] - 0.5, ins.pos[2]); // centre y on origin
      dummy.scale.set(ins.scale[0], ins.scale[1], ins.scale[2]);
      dummy.rotation.set(ins.rot[0], ins.rot[1], ins.rot[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.setRGB(ins.color[0], ins.color[1], ins.color[2]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [instances]);

  useFrame((_, dt) => {
    if (spin && ref.current) ref.current.rotation.y += dt * 0.35;
  });

  // `key` forces a fresh InstancedMesh when the count changes (dev/seed/strain).
  return (
    <instancedMesh
      key={instances.length}
      ref={ref}
      args={[geom, mat, instances.length]}
      castShadow={false}
    />
  );
}

export function BudGL({
  dna,
  seed,
  budDev,
  reducedMotion = false,
}: {
  dna: BudDNA;
  seed: number;
  /** 0..1 bud development (drives accretion + swell). */
  budDev: number;
  reducedMotion?: boolean;
}) {
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.05, 1.9], fov: 35 }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        {/* Grow-tent lighting: soft ambient + a key light + a cool cyan rim. */}
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 4, 3]} intensity={1.4} color="#fff6e8" />
        <pointLight position={[-2, 1, 2]} intensity={18} distance={9} color="#6cf0ff" />
        <Cola dna={dna} seed={seed} budDev={budDev} spin={!reducedMotion} />
      </Canvas>
    </div>
  );
}
