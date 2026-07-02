"use client";

// Phase 1a+1b — WebGL/3D bud renderer (macro view).
//
// One genetics-driven 3D bud: teardrop calyxes accreted up a phyllotaxic spiral
// (cola.ts), with pistils ("hairs") and trichome frost grown from them
// (detail.ts). Maturity colour reuses the Engine-7 model so frost reads ripeness.
// Three instanced meshes = three draw calls. Must load via dynamic({ssr:false}).

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildCola, colaSilhouette, hslToRgb } from "@/lib/chamber/bud3d/cola";
import { buildFrost, buildPistils, buildSugarLeaves } from "@/lib/chamber/bud3d/detail";
import { pickPaletteColor, type BudDNA } from "@/lib/chamber/budDna";
import { makeCapitateGeom, trichomeHeadColor } from "@/components/viz/trichomeGeometry";
import { NutrientPop } from "@/components/arcade/NutrientPop";
import { BOOST_APPLIED_EVENT, type BoostApplyDetail } from "@/lib/arcade/boostEngine";

const Y_CENTER = -0.5; // cola spans y≈0..1 in unit space; centre it on the origin
const UP = new THREE.Vector3(0, 1, 0);

/** A pale silver-teal the calyx albedo lerps toward as frost cakes the bud — so a
 * frosty cola reads coated, not just where a discrete gland sits. Data-driven: the
 * lerp AMOUNT comes from trichomeDensity × trich (zero when the bud isn't frosting
 * yet), never a hardcoded recolour. */
const FROST_TINT = new THREE.Color(0.74, 0.84, 0.86);

/** The solid "bud body" — a lathed teardrop following the cola silhouette, sitting
 * just inside the calyx shell so it fills the gaps BETWEEN calyxes. Without it the
 * bud reads as a loose cluster of floating balls (you see the background through the
 * seams); with it the calyxes look fused into one cohesive cola that "grows together"
 * (owner's reference note). Vertex-coloured with a vertical GRADIENT — deeper strain
 * colour at the base lifting to a frosty light-green crown — for depth/mass. One mesh. */
function BudCore({ dna, budDev, trich, purple, spin }: { dna: BudDNA; budDev: number; trich: number; purple: number; spin: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const geom = useMemo(() => {
    const { profile, H } = colaSilhouette(dna);
    // Pull the body WELL inside the calyx centres — it's only a gap-filling backstop
    // so the dense calyxes around it read as a fused mass; it must never become the
    // visible surface (that made the bud look like a smooth egg with studs).
    const pts = profile.map(([r, y]) => new THREE.Vector2(r * 0.66, y));
    const geo = new THREE.LatheGeometry(pts, 24);

    // Deep, shadowed understructure colour (the calyxes + frost are the bright
    // surface; the core sits behind them in shadow). Heavily darkened strain green.
    const [br, bg, bb] = hslToRgb(pickPaletteColor(dna.palette, 0.5));
    let baseR = br * 0.4, baseG = bg * 0.46, baseB = bb * 0.4;
    const pp = Math.min(1, Math.max(0, purple)) * 0.5;
    if (pp > 0) { baseR = baseR + (0.22 - baseR) * pp; baseG = baseG + (0.1 - baseG) * pp; baseB = baseB + (0.28 - baseB) * pp; }
    // A gentle lift toward a muted green crown — subtle, NOT a bright frosty egg.
    const fr = 0.42, fg = 0.52, fb = 0.4;
    const lift = 0.3 + 0.3 * Math.min(1, Math.max(0, trich));

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = Math.min(1, Math.max(0, v.y / H)); // 0 base → 1 crown
      const k = t * t * lift; // ease-in toward the muted crown
      colors[i * 3] = baseR + (fr - baseR) * k;
      colors[i * 3 + 1] = baseG + (fg - baseG) * k;
      colors[i * 3 + 2] = baseB + (fb - baseB) * k;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [dna, trich, purple]);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0 }),
    [],
  );
  // Scale the body with development so an unformed seed doesn't show a full bud:
  // tiny early, swelling to full as it accretes — matching the calyx accretion.
  const devScale = 0.18 + 0.82 * Math.min(1, Math.max(0, budDev));
  useFrame((_, dt) => { if (spin && ref.current) ref.current.rotation.y += dt * 0.32; });
  return <mesh ref={ref} geometry={geom} material={mat} position={[0, Y_CENTER, 0]} scale={devScale} />;
}

/** A RIBBED teardrop calyx: bulbous swollen base → pointed tip (lathed), then
 * radially fluted so it reads "ribbed, not a grape" (polish-guide rule of
 * realism). Ribs fade out at the tip so the point stays clean. */
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

function Calyxes({ cola, frost, spin }: { cola: ReturnType<typeof buildCola>; frost: number; spin: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useCalyxGeometry();
  // Waxy, low-plastic calyx skin with a hint of subsurface softness via a soft
  // emissive floor (reads in the crevices between packed calyxes).
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.0, emissive: new THREE.Color(0.02, 0.05, 0.05) }),
    [],
  );
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
      // Frost the calyx albedo toward silver — heavier up the cola, lighter at the
      // skirt — but keep most of the blue-teal palette so the bright WHITE glands
      // read as high-contrast crystal caking on a green bud (the reference look).
      const hf = Math.min(1, Math.max(0, ins.pos[1]));
      const amt = Math.min(0.62, frost * (0.18 + 0.6 * hf));
      col.setRGB(ins.color[0], ins.color[1], ins.color[2]).lerp(FROST_TINT, amt);
      // Deterministic per-calyx tonal jitter (±8%) so packed sacs read distinct.
      const hsh = Math.sin(ins.pos[0] * 91.17 + ins.pos[1] * 47.33 + ins.pos[2] * 61.7) * 43758.5453;
      col.multiplyScalar(0.92 + 0.16 * (hsh - Math.floor(hsh)));
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cola, geom, frost]);
  useFrame((_, dt) => { if (spin && ref.current) ref.current.rotation.y += dt * 0.32; });
  return <instancedMesh key={cola.length} ref={ref} args={[geom, mat, cola.length]} />;
}

function Frost({
  instances, purple, spin,
}: { instances: ReturnType<typeof buildFrost>; purple: number; spin: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  // Capitate stalk + gland (smoother detail-1 gland — it's a single hero bud so
  // the tris are cheap) so the close-up reads as real capitate-stalked trichomes
  // caking the cola, not floating balls.
  const geom = useMemo(() => makeCapitateGeom(1), []);
  // Translucent silvery resin: low roughness so glands glint as wet sparkle, a
  // brighter emissive floor so the coat never goes muddy in shadow.
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.16,
        metalness: 0.0,
        transparent: true,
        opacity: 0.96,
        emissive: new THREE.Color(0.22, 0.27, 0.3),
        emissiveIntensity: 0.9,
        depthWrite: true,
      }),
    [],
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const q = new THREE.Quaternion();
    const nrm = new THREE.Vector3();
    const col = new THREE.Color();
    instances.forEach((g, i) => {
      d.position.set(g.pos[0], g.pos[1] + Y_CENTER, g.pos[2]);
      // Stand the trichome UP along the calyx surface normal, with a per-gland
      // tilt jitter so the coat looks grown, not combed.
      nrm.set(g.nrm[0], g.nrm[1], g.nrm[2]).normalize();
      q.setFromUnitVectors(UP, nrm);
      d.quaternion.copy(q);
      d.rotateX((g.spark - 0.5) * 0.9);
      const s = g.r * 2.4 * (0.8 + 0.6 * g.spark);
      d.scale.set(s, s * 1.3, s);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      // Sparkle: keep glands bright (near-white) with a wide brightness spread so
      // a fraction glint near-white for granular crystal frost.
      col.copy(trichomeHeadColor(g.mat, purple)).multiplyScalar(0.85 + 0.5 * g.spark);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [instances, purple]);
  useFrame((_, dt) => { if (spin && ref.current) ref.current.rotation.y += dt * 0.32; });
  return instances.length ? <instancedMesh key={`f${instances.length}`} ref={ref} args={[geom, mat, instances.length]} /> : null;
}

/** A single pistil "hair": a very thin, TAPERED, gently CURLING strand along +Y,
 * base at the origin, ~1 unit long. The reference cola's hairs are fine wispy
 * threads (not the old fat stubble), so this is a tube that arcs out then hooks and
 * tapers to a fine point. Per-instance `roll` spins the curl so a bundle fans every
 * which way. Built once; instanced. */
function usePistilGeometry() {
  return useMemo(() => {
    const N = 10;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // lean outward (+x) low, then hook back as it rises — a soft S-curl.
      const bend = 0.14 * Math.sin(t * Math.PI * 0.85) + 0.05 * t * t;
      pts.push(new THREE.Vector3(bend, t, 0));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubular = 16, radial = 4;
    const geo = new THREE.TubeGeometry(curve, tubular, 0.12, radial, false);
    // Taper the constant-radius tube to a fine point: scale each ring's offset from
    // its centreline by (1 - t), so the tip closes to a hair.
    const pos = geo.attributes.position;
    const c = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i <= tubular; i++) {
      const t = i / tubular;
      curve.getPointAt(t, c);
      const taper = Math.max(0.04, 1 - 0.95 * t);
      for (let j = 0; j <= radial; j++) {
        const idx = i * (radial + 1) + j;
        v.fromBufferAttribute(pos, idx);
        v.sub(c).multiplyScalar(taper).add(c);
        pos.setXYZ(idx, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
}

function Pistils({
  instances, spin,
}: { instances: ReturnType<typeof buildPistils>; spin: boolean }) {
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
    instances.forEach((p, i) => {
      d.position.set(p.pos[0], p.pos[1] + Y_CENTER, p.pos[2]);
      dir.set(p.dir[0], p.dir[1], p.dir[2]).normalize();
      q.setFromUnitVectors(UP, dir);
      d.quaternion.copy(q);
      d.rotateY(p.roll); // spin the curl about its own growth axis
      d.scale.setScalar(p.len); // uniform: keeps the thread fine + curl undistorted
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

/** A small serrated SUGAR-LEAF blade in the XY plane pointing +Y (so it orients
 * along the instance `dir`, like the pistils). A pointed leaf with a few teeth so
 * it reads as a frosted leaflet, not a paddle. */
function useSugarLeafGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    // Tip at +Y; a few zig-zag serrations down each side back to the base.
    s.moveTo(0, 1.0);
    s.lineTo(0.16, 0.74);
    s.lineTo(0.10, 0.66);
    s.lineTo(0.26, 0.44);
    s.lineTo(0.16, 0.36);
    s.lineTo(0.28, 0.12);
    s.lineTo(0.12, 0.0);
    s.lineTo(0, 0.04); // base notch
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

function SugarLeaves({
  instances, spin,
}: { instances: ReturnType<typeof buildSugarLeaves>; spin: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useSugarLeafGeometry();
  // Double-sided (flat blade), low-ish roughness + faint emissive so frosted
  // leaves catch light like the calyxes around them.
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
    instances.forEach((leaf, i) => {
      d.position.set(leaf.pos[0], leaf.pos[1] + Y_CENTER, leaf.pos[2]);
      dir.set(leaf.dir[0], leaf.dir[1], leaf.dir[2]).normalize();
      q.setFromUnitVectors(UP, dir);
      d.quaternion.copy(q);
      d.rotateY(leaf.roll); // spin the blade about its growth axis for variety
      d.scale.setScalar(leaf.scale);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, col.setRGB(leaf.color[0], leaf.color[1], leaf.color[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [instances]);
  useFrame((_, dt) => { if (spin && ref.current) ref.current.rotation.y += dt * 0.32; });
  return instances.length ? <instancedMesh key={`l${instances.length}`} ref={ref} args={[geom, mat, instances.length]} /> : null;
}

export function BudGL({
  dna, seed, budDev, ripe = 0, brown = 0, trich = 0, purple = 0, leaf = 0.8, reducedMotion = false, stage,
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
  /** 0..1 sugar-leaf amount (frosted leaflets poking through the cola). */
  leaf?: number;
  reducedMotion?: boolean;
  /** Current growth stage — drives the Arcade stage-unlock ring burst. */
  stage?: string;
}) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const cola = useMemo(() => buildCola(dna, seed, { budDev }), [dna, seed, budDev]);
  const frost = useMemo(
    // A single hero bud at close range can afford a dense capitate coat — cap far
    // higher than the whole-plant path so the cola reads truly caked in resin.
    () =>
      buildFrost(cola, {
        seed,
        density: dna.trichomeDensity * trich,
        ripe,
        amberBias: purple * 0.4,
        isMobile,
        budget: isMobile ? 900 : 2200,
        perScale: 1.1,
      }),
    [cola, seed, dna.trichomeDensity, trich, ripe, purple, isMobile],
  );
  const pistils = useMemo(
    () => buildPistils(cola, { seed, chance: dna.pistilChance, ripe, brown, magenta: purple, isMobile }),
    [cola, seed, dna.pistilChance, ripe, brown, purple, isMobile],
  );
  const sugarLeaves = useMemo(
    () => buildSugarLeaves(cola, { seed, amount: leaf * Math.max(0.4, budDev), frost: trich, isMobile }),
    [cola, seed, leaf, budDev, trich, isMobile],
  );
  const spin = !reducedMotion;

  // Arcade screen shake on the strongest boost (LIGHT_BLAST): the canvas wrapper
  // jolts for 200ms. Particles/rings live in the NutrientPop overlay. The Three.js
  // render loop is untouched — this is a CSS transform on the wrapper only.
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (reducedMotion) return;
    function onBoost(e: Event) {
      const detail = (e as CustomEvent<BoostApplyDetail>).detail;
      if (detail?.type !== "LIGHT_BLAST") return;
      setShake(true);
      window.setTimeout(() => setShake(false), 220);
    }
    window.addEventListener(BOOST_APPLIED_EVENT, onBoost);
    return () => window.removeEventListener(BOOST_APPLIED_EVENT, onBoost);
  }, [reducedMotion]);

  return (
    <div className={`absolute inset-0${shake ? " gpe-arcade-shake" : ""}`}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.05, 1.9], fov: 35 }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 4, 3]} intensity={1.4} color="#fff6e8" />
        <pointLight position={[-2, 1, 2]} intensity={18} distance={9} color="#6cf0ff" />
        <BudCore dna={dna} budDev={budDev} trich={trich} purple={purple} spin={spin} />
        <Calyxes cola={cola} frost={dna.trichomeDensity * trich} spin={spin} />
        <SugarLeaves instances={sugarLeaves} spin={spin} />
        <Pistils instances={pistils} spin={spin} />
        <Frost instances={frost} purple={purple} spin={spin} />
      </Canvas>
      {/* CSS-only FX overlay — no canvas, no draw-call impact. */}
      <NutrientPop stage={stage} reducedMotion={reducedMotion} />
    </div>
  );
}
